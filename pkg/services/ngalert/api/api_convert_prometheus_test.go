package api

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	prommodel "github.com/prometheus/common/model"
	"github.com/stretchr/testify/require"
	"gopkg.in/yaml.v3"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/log"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/datasources"
	dsfakes "github.com/grafana/grafana/pkg/services/datasources/fakes"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/folder/foldertest"
	acfakes "github.com/grafana/grafana/pkg/services/ngalert/accesscontrol/fakes"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/provisioning"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
	"github.com/grafana/grafana/pkg/services/ngalert/tests/fakes"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/web"
)

const (
	existingDSUID = "test-ds"
)

func TestRouteConvertPrometheusPostRuleGroup(t *testing.T) {
	simpleGroup := apimodels.PrometheusRuleGroup{
		Name:     "Test Group",
		Interval: prommodel.Duration(1 * time.Minute),
		Rules: []apimodels.PrometheusRule{
			{
				Alert: "TestAlert",
				Expr:  "up == 0",
				For:   util.Pointer(prommodel.Duration(5 * time.Minute)),
				Labels: map[string]string{
					"severity": "critical",
				},
			},
			{
				Record: "recorded-metric",
				Expr:   "vector(1)",
				Labels: map[string]string{
					"severity": "warning",
				},
			},
		},
	}

	t.Run("without datasource UID header should return 400", func(t *testing.T) {
		srv, _, _, _ := createConvertPrometheusSrv(t)
		rc := createRequestCtx()
		rc.Req.Header.Set(datasourceUIDHeader, "")

		response := srv.RouteConvertPrometheusPostRuleGroup(rc, "test", apimodels.PrometheusRuleGroup{})

		require.Equal(t, http.StatusBadRequest, response.Status())
		require.Contains(t, string(response.Body()), "Missing datasource UID header")
	})

	t.Run("with invalid datasource should return error", func(t *testing.T) {
		srv, _, _, _ := createConvertPrometheusSrv(t)
		rc := createRequestCtx()
		rc.Req.Header.Set(datasourceUIDHeader, "non-existing-ds")

		response := srv.RouteConvertPrometheusPostRuleGroup(rc, "test", apimodels.PrometheusRuleGroup{})

		require.Equal(t, http.StatusNotFound, response.Status())
	})

	t.Run("with rule group without evaluation interval should return 202", func(t *testing.T) {
		srv, _, _, _ := createConvertPrometheusSrv(t)
		rc := createRequestCtx()

		response := srv.RouteConvertPrometheusPostRuleGroup(rc, "test", simpleGroup)
		require.Equal(t, http.StatusAccepted, response.Status())
	})

	t.Run("should replace an existing rule group", func(t *testing.T) {
		provenanceStore := fakes.NewFakeProvisioningStore()
		srv, _, ruleStore, folderService := createConvertPrometheusSrv(t, withProvenanceStore(provenanceStore))

		// Create a folder in the root
		fldr := randFolder()
		fldr.ParentUID = ""
		folderService.ExpectedFolder = fldr
		folderService.ExpectedFolders = []*folder.Folder{fldr}
		ruleStore.Folders[1] = append(ruleStore.Folders[1], fldr)

		// And a rule
		rule := models.RuleGen.
			With(models.RuleGen.WithNamespaceUID(fldr.UID)).
			With(models.RuleGen.WithGroupName(simpleGroup.Name)).
			With(models.RuleGen.WithOrgID(1)).
			With(models.RuleGen.WithPrometheusOriginalRuleDefinition("123")).
			GenerateRef()
		ruleStore.PutRule(context.Background(), rule)

		rc := createRequestCtx()
		response := srv.RouteConvertPrometheusPostRuleGroup(rc, fldr.Title, simpleGroup)
		require.Equal(t, http.StatusAccepted, response.Status())

		// Get the rules
		remaining, err := ruleStore.ListAlertRules(context.Background(), &models.ListAlertRulesQuery{
			OrgID: 1,
		})
		require.NoError(t, err)
		require.Len(t, remaining, 2)

		// Create a map of rule titles to their expected definitions
		expectedRules := make(map[string]string)
		for _, rule := range simpleGroup.Rules {
			if rule.Alert != "" {
				promRuleYAML, err := yaml.Marshal(rule)
				require.NoError(t, err)
				expectedRules[rule.Alert] = string(promRuleYAML)
			} else if rule.Record != "" {
				promRuleYAML, err := yaml.Marshal(rule)
				require.NoError(t, err)
				expectedRules[rule.Record] = string(promRuleYAML)
			}
		}

		// Verify each rule matches its expected definition
		for _, r := range remaining {
			require.Equal(t, simpleGroup.Name, r.RuleGroup)
			expectedDef, exists := expectedRules[r.Title]
			require.True(t, exists, "unexpected rule title: %s", r.Title)

			promDefinition, err := r.PrometheusRuleDefinition()
			require.NoError(t, err)
			require.Equal(t, expectedDef, promDefinition)

			// Verify provenance was set to ProvenanceConvertedPrometheus
			prov, err := provenanceStore.GetProvenance(context.Background(), r, 1)
			require.NoError(t, err)
			require.Equal(t, models.ProvenanceConvertedPrometheus, prov)
		}
	})

	t.Run("should fail to replace a provisioned rule group", func(t *testing.T) {
		provenanceStore := fakes.NewFakeProvisioningStore()
		srv, _, ruleStore, folderService := createConvertPrometheusSrv(t, withProvenanceStore(provenanceStore))

		// Create a folder in the root
		fldr := randFolder()
		fldr.ParentUID = ""
		folderService.ExpectedFolder = fldr
		folderService.ExpectedFolders = []*folder.Folder{fldr}
		ruleStore.Folders[1] = append(ruleStore.Folders[1], fldr)

		rule := models.RuleGen.
			With(models.RuleGen.WithNamespaceUID(fldr.UID)).
			With(models.RuleGen.WithGroupName(simpleGroup.Name)).
			With(models.RuleGen.WithOrgID(1)).
			With(models.RuleGen.WithPrometheusOriginalRuleDefinition("123")).
			GenerateRef()
		ruleStore.PutRule(context.Background(), rule)
		// mark the rule as provisioned
		err := provenanceStore.SetProvenance(context.Background(), rule, 1, models.ProvenanceAPI)
		require.NoError(t, err)

		rc := createRequestCtx()
		response := srv.RouteConvertPrometheusPostRuleGroup(rc, fldr.Title, simpleGroup)
		require.Equal(t, http.StatusConflict, response.Status())

		// Verify the rule is still present
		remaining, err := ruleStore.GetAlertRuleByUID(context.Background(), &models.GetAlertRuleByUIDQuery{
			UID:   rule.UID,
			OrgID: rule.OrgID,
		})
		require.NoError(t, err)
		require.NotNil(t, remaining)
	})

	t.Run("with no access to the datasource should return 403", func(t *testing.T) {
		acFake := &acfakes.FakeRuleService{}
		srv, _, _, _ := createConvertPrometheusSrv(t, withFakeAccessControlRuleService(acFake))

		acFake.AuthorizeRuleChangesFunc = func(context.Context, identity.Requester, *store.GroupDelta) error {
			return datasources.ErrDataSourceAccessDenied
		}

		rc := createRequestCtx()
		response := srv.RouteConvertPrometheusPostRuleGroup(rc, "folder", simpleGroup)
		require.Equal(t, http.StatusForbidden, response.Status())
		require.Contains(t, string(response.Body()), "data source access denied")
	})

	t.Run("when alert rule quota limit exceeded", func(t *testing.T) {
		quotas := &provisioning.MockQuotaChecker{}
		quotas.EXPECT().LimitExceeded()

		srv, _, _, _ := createConvertPrometheusSrv(t, withQuotaChecker(quotas))

		rc := createRequestCtx()
		response := srv.RouteConvertPrometheusPostRuleGroup(rc, "folder", simpleGroup)
		require.Equal(t, http.StatusForbidden, response.Status())
		require.Contains(t, string(response.Body()), "quota has been exceeded")
	})

	t.Run("with valid pause header values should return 202", func(t *testing.T) {
		testCases := []struct {
			name        string
			headerName  string
			headerValue string
		}{
			{
				name:        "true recording rules pause value",
				headerName:  recordingRulesPausedHeader,
				headerValue: "true",
			},
			{
				name:        "false recording rules pause value",
				headerName:  recordingRulesPausedHeader,
				headerValue: "false",
			},
			{
				name:        "true alert rules pause value",
				headerName:  alertRulesPausedHeader,
				headerValue: "true",
			},
			{
				name:        "false alert rules pause value",
				headerName:  alertRulesPausedHeader,
				headerValue: "false",
			},
		}

		for _, tc := range testCases {
			t.Run(tc.name, func(t *testing.T) {
				srv, _, _, _ := createConvertPrometheusSrv(t)
				rc := createRequestCtx()
				rc.Req.Header.Set(tc.headerName, tc.headerValue)

				response := srv.RouteConvertPrometheusPostRuleGroup(rc, "test", simpleGroup)
				require.Equal(t, http.StatusAccepted, response.Status())
			})
		}
	})

	t.Run("with invalid pause header values should return 400", func(t *testing.T) {
		testCases := []struct {
			name          string
			headerName    string
			headerValue   string
			expectedError string
		}{
			{
				name:          "invalid recording rules pause value",
				headerName:    recordingRulesPausedHeader,
				headerValue:   "invalid",
				expectedError: "Invalid value for header X-Grafana-Alerting-Recording-Rules-Paused: must be 'true' or 'false'",
			},
			{
				name:          "invalid alert rules pause value",
				headerName:    alertRulesPausedHeader,
				headerValue:   "invalid",
				expectedError: "Invalid value for header X-Grafana-Alerting-Alert-Rules-Paused: must be 'true' or 'false'",
			},
		}

		for _, tc := range testCases {
			t.Run(tc.name, func(t *testing.T) {
				srv, _, _, _ := createConvertPrometheusSrv(t)
				rc := createRequestCtx()
				rc.Req.Header.Set(tc.headerName, tc.headerValue)

				response := srv.RouteConvertPrometheusPostRuleGroup(rc, "test", simpleGroup)
				require.Equal(t, http.StatusBadRequest, response.Status())
				require.Contains(t, string(response.Body()), tc.expectedError)
			})
		}
	})

	t.Run("with valid request should return 202", func(t *testing.T) {
		srv, _, _, _ := createConvertPrometheusSrv(t)
		rc := createRequestCtx()

		response := srv.RouteConvertPrometheusPostRuleGroup(rc, "test", simpleGroup)
		require.Equal(t, http.StatusAccepted, response.Status())
	})

	t.Run("with disabled recording rules", func(t *testing.T) {
		testCases := []struct {
			name                   string
			recordingRules         bool
			recordingRulesTargetDS bool
			expectedStatus         int
		}{
			{
				name:                   "when recording rules are enabled",
				recordingRules:         true,
				recordingRulesTargetDS: true,
				expectedStatus:         http.StatusAccepted,
			},
			{
				name:                   "when recording rules are disabled",
				recordingRules:         false,
				recordingRulesTargetDS: true,
				expectedStatus:         http.StatusBadRequest,
			},
			{
				name:                   "when target datasources for recording rules are disabled",
				recordingRules:         true,
				recordingRulesTargetDS: false,
				expectedStatus:         http.StatusBadRequest,
			},
			{
				name:                   "when both recording rules and target datasources are disabled",
				recordingRules:         false,
				recordingRulesTargetDS: false,
				expectedStatus:         http.StatusBadRequest,
			},
		}

		for _, tc := range testCases {
			t.Run(tc.name, func(t *testing.T) {
				var features featuremgmt.FeatureToggles
				if tc.recordingRulesTargetDS {
					features = featuremgmt.WithFeatures(featuremgmt.FlagGrafanaManagedRecordingRulesDatasources)
				} else {
					features = featuremgmt.WithFeatures()
				}

				srv, _, _, _ := createConvertPrometheusSrv(t, withFeatureToggles(features))
				srv.cfg.RecordingRules.Enabled = tc.recordingRules
				rc := createRequestCtx()

				response := srv.RouteConvertPrometheusPostRuleGroup(rc, "test", simpleGroup)
				require.Equal(t, tc.expectedStatus, response.Status())
			})
		}
	})

	t.Run("with disable provenance header should use ProvenanceNone", func(t *testing.T) {
		provenanceStore := fakes.NewFakeProvisioningStore()
		srv, _, ruleStore, folderService := createConvertPrometheusSrv(t, withProvenanceStore(provenanceStore))

		// Create a folder in the root
		fldr := randFolder()
		fldr.ParentUID = ""
		folderService.ExpectedFolder = fldr
		folderService.ExpectedFolders = []*folder.Folder{fldr}
		ruleStore.Folders[1] = append(ruleStore.Folders[1], fldr)

		// Create request with the X-Disable-Provenance header
		rc := createRequestCtx()
		rc.Req.Header.Set("X-Disable-Provenance", "true")

		response := srv.RouteConvertPrometheusPostRuleGroup(rc, fldr.Title, simpleGroup)
		require.Equal(t, http.StatusAccepted, response.Status())

		// Get the created rules
		rules, err := ruleStore.ListAlertRules(context.Background(), &models.ListAlertRulesQuery{
			OrgID: 1,
		})
		require.NoError(t, err)
		require.Len(t, rules, 2)

		// Verify provenance was set to ProvenanceNone
		for _, r := range rules {
			prov, err := provenanceStore.GetProvenance(context.Background(), r, 1)
			require.NoError(t, err)
			require.Equal(t, models.ProvenanceNone, prov, "Provenance should be ProvenanceNone when X-Disable-Provenance header is set")
			// Prometheus rule definition should not be saved when provenance is disabled
			require.Nil(t, r.Metadata.PrometheusStyleRule)
		}
	})

	t.Run("returns error when target datasource does not exist", func(t *testing.T) {
		srv, _, _, _ := createConvertPrometheusSrv(t)
		rc := createRequestCtx()
		rc.Req.Header.Set(targetDatasourceUIDHeader, "some-data-source")

		response := srv.RouteConvertPrometheusPostRuleGroup(rc, "test", simpleGroup)
		require.Equal(t, http.StatusNotFound, response.Status())
		require.Contains(t, string(response.Body()), "failed to get recording rules target datasource")
	})

	t.Run("uses target datasource for recording rules", func(t *testing.T) {
		srv, dsCache, ruleStore, _ := createConvertPrometheusSrv(t)
		rc := createRequestCtx()
		targetDSUID := util.GenerateShortUID()
		ds := &datasources.DataSource{
			UID:  targetDSUID,
			Type: datasources.DS_PROMETHEUS,
		}
		dsCache.DataSources = append(dsCache.DataSources, ds)
		rc.Req.Header.Set(targetDatasourceUIDHeader, targetDSUID)

		simpleGroup := apimodels.PrometheusRuleGroup{
			Name:     "Test Group",
			Interval: prommodel.Duration(1 * time.Minute),
			Rules: []apimodels.PrometheusRule{
				{
					Record: "recorded-metric",
					Expr:   "vector(1)",
					Labels: map[string]string{
						"severity": "warning",
					},
				},
			},
		}

		response := srv.RouteConvertPrometheusPostRuleGroup(rc, "test", simpleGroup)
		require.Equal(t, http.StatusAccepted, response.Status())

		remaining, err := ruleStore.ListAlertRules(context.Background(), &models.ListAlertRulesQuery{
			OrgID: 1,
		})
		require.NoError(t, err)
		require.Len(t, remaining, 1)
		require.NotNil(t, remaining[0].Record)
		require.Equal(t, targetDSUID, remaining[0].Record.TargetDatasourceUID)
	})
}

func TestRouteConvertPrometheusGetRuleGroup(t *testing.T) {
	promRule := apimodels.PrometheusRule{
		Alert: "test alert",
		Expr:  "vector(1) > 0",
		For:   util.Pointer(prommodel.Duration(5 * time.Minute)),
		Labels: map[string]string{
			"severity": "critical",
		},
		Annotations: map[string]string{
			"summary": "test alert",
		},
	}
	promRuleYAML, err := yaml.Marshal(promRule)
	require.NoError(t, err)

	t.Run("with non-existent folder should return 404", func(t *testing.T) {
		srv, _, _, _ := createConvertPrometheusSrv(t)
		rc := createRequestCtx()

		response := srv.RouteConvertPrometheusGetRuleGroup(rc, "non-existent", "test")
		require.Equal(t, http.StatusNotFound, response.Status(), string(response.Body()))
	})

	t.Run("with non-existent group should return 404", func(t *testing.T) {
		srv, _, _, _ := createConvertPrometheusSrv(t)
		rc := createRequestCtx()

		response := srv.RouteConvertPrometheusGetRuleGroup(rc, "test", "non-existent")
		require.Equal(t, http.StatusNotFound, response.Status(), string(response.Body()))
	})

	t.Run("with valid request should return 200", func(t *testing.T) {
		srv, _, ruleStore, folderService := createConvertPrometheusSrv(t)
		rc := createRequestCtx()

		// Create two folders in the root folder
		fldr := randFolder()
		fldr.ParentUID = ""
		folderService.ExpectedFolder = fldr
		folderService.ExpectedFolders = []*folder.Folder{fldr}
		ruleStore.Folders[1] = append(ruleStore.Folders[1], fldr)

		// Create rules in both folders
		groupKey := models.GenerateGroupKey(rc.OrgID)
		groupKey.NamespaceUID = fldr.UID
		groupKey.RuleGroup = "test-group"
		rule := models.RuleGen.
			With(models.RuleGen.WithGroupKey(groupKey)).
			With(models.RuleGen.WithTitle("TestAlert")).
			With(models.RuleGen.WithIntervalSeconds(60)).
			With(models.RuleGen.WithPrometheusOriginalRuleDefinition(string(promRuleYAML))).
			GenerateRef()
		ruleStore.PutRule(context.Background(), rule)

		// Create a rule in another group
		groupKeyNotFromProm := models.GenerateGroupKey(rc.OrgID)
		groupKeyNotFromProm.NamespaceUID = fldr.UID
		groupKeyNotFromProm.RuleGroup = "test-group-2"
		ruleInOtherFolder := models.RuleGen.
			With(models.RuleGen.WithGroupKey(groupKeyNotFromProm)).
			With(models.RuleGen.WithTitle("in another group")).
			With(models.RuleGen.WithIntervalSeconds(60)).
			GenerateRef()
		ruleStore.PutRule(context.Background(), ruleInOtherFolder)

		getResp := srv.RouteConvertPrometheusGetRuleGroup(rc, fldr.Title, groupKey.RuleGroup)
		require.Equal(t, http.StatusOK, getResp.Status())

		var respGroup apimodels.PrometheusRuleGroup
		err := yaml.Unmarshal(getResp.Body(), &respGroup)
		require.NoError(t, err)

		require.Equal(t, groupKey.RuleGroup, respGroup.Name)
		require.Equal(t, prommodel.Duration(time.Duration(rule.IntervalSeconds)*time.Second), respGroup.Interval)
		require.Len(t, respGroup.Rules, 1)
		require.Equal(t, promRule.Alert, respGroup.Rules[0].Alert)
	})
}

func TestRouteConvertPrometheusGetNamespace(t *testing.T) {
	promRule1 := apimodels.PrometheusRule{
		Alert: "test alert",
		Expr:  "vector(1) > 0",
		For:   util.Pointer(prommodel.Duration(5 * time.Minute)),
		Labels: map[string]string{
			"severity": "critical",
		},
		Annotations: map[string]string{
			"summary": "test alert",
		},
	}

	promRule2 := apimodels.PrometheusRule{
		Alert: "test alert 2",
		Expr:  "vector(1) > 0",
		For:   util.Pointer(prommodel.Duration(5 * time.Minute)),
		Labels: map[string]string{
			"severity": "also critical",
		},
		Annotations: map[string]string{
			"summary": "test alert 2",
		},
	}

	promGroup1 := apimodels.PrometheusRuleGroup{
		Name:     "Test Group",
		Interval: prommodel.Duration(1 * time.Minute),
		Rules: []apimodels.PrometheusRule{
			promRule1,
		},
	}
	promGroup2 := apimodels.PrometheusRuleGroup{
		Name:     "Test Group 2",
		Interval: prommodel.Duration(1 * time.Minute),
		Rules: []apimodels.PrometheusRule{
			promRule2,
		},
	}

	t.Run("with non-existent folder should return 404", func(t *testing.T) {
		srv, _, _, _ := createConvertPrometheusSrv(t)
		rc := createRequestCtx()

		response := srv.RouteConvertPrometheusGetNamespace(rc, "non-existent")
		require.Equal(t, http.StatusNotFound, response.Status())
	})

	t.Run("with valid request should return 200", func(t *testing.T) {
		srv, _, ruleStore, folderService := createConvertPrometheusSrv(t)
		rc := createRequestCtx()

		// Create two folders in the root folder
		fldr := randFolder()
		fldr.ParentUID = ""
		fldr2 := randFolder()
		fldr2.ParentUID = ""
		folderService.ExpectedFolders = []*folder.Folder{fldr, fldr2}
		ruleStore.Folders[1] = append(ruleStore.Folders[1], fldr, fldr2)

		// Create a Grafana rule for each Prometheus rule
		for _, promGroup := range []apimodels.PrometheusRuleGroup{promGroup1, promGroup2} {
			groupKey := models.GenerateGroupKey(rc.OrgID)
			groupKey.NamespaceUID = fldr.UID
			groupKey.RuleGroup = promGroup.Name
			promRuleYAML, err := yaml.Marshal(promGroup.Rules[0])
			require.NoError(t, err)
			rule := models.RuleGen.
				With(models.RuleGen.WithGroupKey(groupKey)).
				With(models.RuleGen.WithTitle(promGroup.Rules[0].Alert)).
				With(models.RuleGen.WithIntervalSeconds(60)).
				With(models.RuleGen.WithPrometheusOriginalRuleDefinition(string(promRuleYAML))).
				GenerateRef()
			ruleStore.PutRule(context.Background(), rule)
		}

		response := srv.RouteConvertPrometheusGetNamespace(rc, fldr.Title)
		require.Equal(t, http.StatusOK, response.Status())

		var respNamespaces map[string][]apimodels.PrometheusRuleGroup
		err := yaml.Unmarshal(response.Body(), &respNamespaces)
		require.NoError(t, err)

		require.Len(t, respNamespaces, 1)
		require.Contains(t, respNamespaces, fldr.Title)
		require.ElementsMatch(t, respNamespaces[fldr.Title], []apimodels.PrometheusRuleGroup{promGroup1, promGroup2})
	})
}

func TestRouteConvertPrometheusGetRules(t *testing.T) {
	promRule1 := apimodels.PrometheusRule{
		Alert: "test alert",
		Expr:  "vector(1) > 0",
		For:   util.Pointer(prommodel.Duration(5 * time.Minute)),
		Labels: map[string]string{
			"severity": "critical",
		},
		Annotations: map[string]string{
			"summary": "test alert",
		},
	}

	promRule2 := apimodels.PrometheusRule{
		Alert: "test alert 2",
		Expr:  "vector(1) > 0",
		For:   util.Pointer(prommodel.Duration(5 * time.Minute)),
		Labels: map[string]string{
			"severity": "also critical",
		},
		Annotations: map[string]string{
			"summary": "test alert 2",
		},
	}

	promGroup1 := apimodels.PrometheusRuleGroup{
		Name:     "Test Group",
		Interval: prommodel.Duration(1 * time.Minute),
		Rules: []apimodels.PrometheusRule{
			promRule1,
		},
	}
	promGroup2 := apimodels.PrometheusRuleGroup{
		Name:     "Test Group 2",
		Interval: prommodel.Duration(1 * time.Minute),
		Rules: []apimodels.PrometheusRule{
			promRule2,
		},
	}

	assertEmptyResponse := func(t *testing.T, srv *ConvertPrometheusSrv, reqCtx *contextmodel.ReqContext) {
		t.Helper()

		response := srv.RouteConvertPrometheusGetRules(reqCtx)
		require.Equal(t, http.StatusOK, response.Status())

		var respNamespaces map[string][]apimodels.PrometheusRuleGroup
		err := yaml.Unmarshal(response.Body(), &respNamespaces)
		require.NoError(t, err)
		require.Empty(t, respNamespaces)
	}

	// testForEmptyResponses tests that RouteConvertPrometheusGetRules returns an empty response
	// when there are no rules in the folder or the folder does not exist.
	testForEmptyResponses := func(t *testing.T, withCustomFolderHeader bool) {
		rc := createRequestCtx()
		unknownFolderUID := "some unknown folder"
		rootFolderUID := ""
		if withCustomFolderHeader {
			rootFolderUID = unknownFolderUID
			rc.Req.Header.Set(folderUIDHeader, unknownFolderUID)
		}

		t.Run("for non-existent folder should return empty response", func(t *testing.T) {
			srv, _, _, _ := createConvertPrometheusSrv(t)
			assertEmptyResponse(t, srv, rc)
		})

		t.Run("for existing folder with no children should return empty response", func(t *testing.T) {
			srv, _, ruleStore, folderService := createConvertPrometheusSrv(t)

			fldr := randFolder()
			fldr.UID = unknownFolderUID
			fldr.ParentUID = rootFolderUID
			folderService.ExpectedFolders = []*folder.Folder{fldr}
			ruleStore.Folders[1] = append(ruleStore.Folders[1], fldr)

			assertEmptyResponse(t, srv, rc)
		})
	}

	t.Run("without custom root folder", func(t *testing.T) {
		testForEmptyResponses(t, false)
	})

	t.Run("with custom root folder", func(t *testing.T) {
		testForEmptyResponses(t, true)
	})

	t.Run("with rules should return 200 with rules", func(t *testing.T) {
		srv, _, ruleStore, folderService := createConvertPrometheusSrv(t)
		rc := createRequestCtx()

		// Create a folder in the root
		fldr := randFolder()
		fldr.ParentUID = ""
		folderService.ExpectedFolders = []*folder.Folder{fldr}
		ruleStore.Folders[1] = append(ruleStore.Folders[1], fldr)

		// Create a Grafana rule for each Prometheus rule
		for _, promGroup := range []apimodels.PrometheusRuleGroup{promGroup1, promGroup2} {
			groupKey := models.GenerateGroupKey(rc.OrgID)
			groupKey.NamespaceUID = fldr.UID
			groupKey.RuleGroup = promGroup.Name
			promRuleYAML, err := yaml.Marshal(promGroup.Rules[0])
			require.NoError(t, err)
			rule := models.RuleGen.
				With(models.RuleGen.WithGroupKey(groupKey)).
				With(models.RuleGen.WithTitle(promGroup.Rules[0].Alert)).
				With(models.RuleGen.WithIntervalSeconds(60)).
				With(models.RuleGen.WithPrometheusOriginalRuleDefinition(string(promRuleYAML))).
				GenerateRef()
			ruleStore.PutRule(context.Background(), rule)
		}

		response := srv.RouteConvertPrometheusGetRules(rc)
		require.Equal(t, http.StatusOK, response.Status())

		var respNamespaces map[string][]apimodels.PrometheusRuleGroup
		err := yaml.Unmarshal(response.Body(), &respNamespaces)
		require.NoError(t, err)

		require.Len(t, respNamespaces, 1)
		require.Contains(t, respNamespaces, fldr.Title)
		require.ElementsMatch(t, respNamespaces[fldr.Title], []apimodels.PrometheusRuleGroup{promGroup1, promGroup2})
	})
}

func TestRouteConvertPrometheusDeleteNamespace(t *testing.T) {
	t.Run("for non-existent folder should return 404", func(t *testing.T) {
		srv, _, _, _ := createConvertPrometheusSrv(t)
		rc := createRequestCtx()

		response := srv.RouteConvertPrometheusDeleteNamespace(rc, "non-existent")
		require.Equal(t, http.StatusNotFound, response.Status())
	})

	t.Run("for existing folder with no groups should return 404", func(t *testing.T) {
		srv, _, ruleStore, folderService := createConvertPrometheusSrv(t)
		rc := createRequestCtx()

		fldr := randFolder()
		fldr.ParentUID = ""
		folderService.ExpectedFolder = fldr
		folderService.ExpectedFolders = []*folder.Folder{fldr}
		ruleStore.Folders[1] = append(ruleStore.Folders[1], fldr)

		response := srv.RouteConvertPrometheusDeleteNamespace(rc, "non-existent")
		require.Equal(t, http.StatusNotFound, response.Status())
	})

	t.Run("valid request should delete rules", func(t *testing.T) {
		initNamespace := func(promDefinition string, opts ...convertPrometheusSrvOptionsFunc) (*ConvertPrometheusSrv, *fakes.RuleStore, *folder.Folder, *models.AlertRule) {
			srv, _, ruleStore, folderService := createConvertPrometheusSrv(t, opts...)

			// Create a folder in the root
			fldr := randFolder()
			fldr.ParentUID = ""
			folderService.ExpectedFolder = fldr
			folderService.ExpectedFolders = []*folder.Folder{fldr}
			ruleStore.Folders[1] = append(ruleStore.Folders[1], fldr)

			rule := models.RuleGen.
				With(models.RuleGen.WithNamespaceUID(fldr.UID)).
				With(models.RuleGen.WithOrgID(1)).
				With(models.RuleGen.WithPrometheusOriginalRuleDefinition(promDefinition)).
				GenerateRef()
			ruleStore.PutRule(context.Background(), rule)

			return srv, ruleStore, fldr, rule
		}

		t.Run("valid request should delete rules", func(t *testing.T) {
			srv, ruleStore, fldr, rule := initNamespace("prometheus definition")

			// Create another rule group in a different namespace that should not be deleted
			otherGroupName := "other-group"
			otherRule := models.RuleGen.
				With(models.RuleGen.WithOrgID(1)).
				With(models.RuleGen.WithGroupName(otherGroupName)).
				With(models.RuleGen.WithPrometheusOriginalRuleDefinition("other prometheus definition")).
				GenerateRef()
			ruleStore.PutRule(context.Background(), otherRule)

			rc := createRequestCtx()

			response := srv.RouteConvertPrometheusDeleteNamespace(rc, fldr.Title)
			require.Equal(t, http.StatusAccepted, response.Status())

			// Verify the rule in the specified group was deleted
			remaining, err := ruleStore.GetAlertRuleByUID(context.Background(), &models.GetAlertRuleByUIDQuery{
				UID:   rule.UID,
				OrgID: rule.OrgID,
			})
			require.Error(t, err)
			require.Nil(t, remaining)

			// Verify the rule in the other group still exists
			remainingOther, err := ruleStore.GetAlertRuleByUID(context.Background(), &models.GetAlertRuleByUIDQuery{
				UID:   otherRule.UID,
				OrgID: otherRule.OrgID,
			})
			require.NoError(t, err)
			require.NotNil(t, remainingOther)
		})

		t.Run("fails to delete rules when they are provisioned", func(t *testing.T) {
			provenanceStore := fakes.NewFakeProvisioningStore()
			srv, ruleStore, fldr, rule := initNamespace("", withProvenanceStore(provenanceStore))
			rc := createRequestCtx()

			// Create a provisioned rule
			rule2 := models.RuleGen.
				With(models.RuleGen.WithNamespaceUID(fldr.UID)).
				With(models.RuleGen.WithOrgID(1)).
				With(models.RuleGen.WithPrometheusOriginalRuleDefinition("prometheus definition")).
				GenerateRef()
			ruleStore.PutRule(context.Background(), rule2)
			err := provenanceStore.SetProvenance(context.Background(), rule2, 1, models.ProvenanceAPI)
			require.NoError(t, err)

			response := srv.RouteConvertPrometheusDeleteNamespace(rc, fldr.Title)
			require.Equal(t, http.StatusConflict, response.Status())

			// Verify the rule is still present
			remaining, err := ruleStore.GetAlertRuleByUID(context.Background(), &models.GetAlertRuleByUIDQuery{
				UID:   rule.UID,
				OrgID: rule.OrgID,
			})
			require.NoError(t, err)
			require.NotNil(t, remaining)
		})

		t.Run("with disable provenance header should still be able to delete rules", func(t *testing.T) {
			provenanceStore := fakes.NewFakeProvisioningStore()
			srv, ruleStore, fldr, rule := initNamespace("prometheus definition", withProvenanceStore(provenanceStore))

			// Mark the rule as provisioned with API provenance
			err := provenanceStore.SetProvenance(context.Background(), rule, 1, models.ProvenanceConvertedPrometheus)
			require.NoError(t, err)

			rc := createRequestCtx()
			rc.Req.Header.Set("X-Disable-Provenance", "true")

			response := srv.RouteConvertPrometheusDeleteNamespace(rc, fldr.Title)
			require.Equal(t, http.StatusAccepted, response.Status())

			// Verify the rule was deleted
			remaining, err := ruleStore.GetAlertRuleByUID(context.Background(), &models.GetAlertRuleByUIDQuery{
				UID:   rule.UID,
				OrgID: rule.OrgID,
			})
			require.Error(t, err)
			require.Nil(t, remaining)
		})
	})
}

func TestRouteConvertPrometheusDeleteRuleGroup(t *testing.T) {
	t.Run("for non-existent folder should return 404", func(t *testing.T) {
		srv, _, _, _ := createConvertPrometheusSrv(t)
		rc := createRequestCtx()

		response := srv.RouteConvertPrometheusDeleteRuleGroup(rc, "non-existent", "test-group")
		require.Equal(t, http.StatusNotFound, response.Status())
	})

	t.Run("for existing folder with no group should return 404", func(t *testing.T) {
		srv, _, ruleStore, folderService := createConvertPrometheusSrv(t)
		rc := createRequestCtx()

		fldr := randFolder()
		fldr.ParentUID = ""
		folderService.ExpectedFolder = fldr
		folderService.ExpectedFolders = []*folder.Folder{fldr}
		ruleStore.Folders[1] = append(ruleStore.Folders[1], fldr)

		response := srv.RouteConvertPrometheusDeleteRuleGroup(rc, fldr.Title, "test-group")
		require.Equal(t, http.StatusNotFound, response.Status())
	})

	const groupName = "test-group"

	t.Run("valid request should delete rules", func(t *testing.T) {
		initGroup := func(promDefinition string, groupName string, opts ...convertPrometheusSrvOptionsFunc) (*ConvertPrometheusSrv, *fakes.RuleStore, *folder.Folder, *models.AlertRule) {
			srv, _, ruleStore, folderService := createConvertPrometheusSrv(t, opts...)

			// Create a folder in the root
			fldr := randFolder()
			fldr.ParentUID = ""
			folderService.ExpectedFolder = fldr
			folderService.ExpectedFolders = []*folder.Folder{fldr}
			ruleStore.Folders[1] = append(ruleStore.Folders[1], fldr)

			rule := models.RuleGen.
				With(models.RuleGen.WithNamespaceUID(fldr.UID)).
				With(models.RuleGen.WithOrgID(1)).
				With(models.RuleGen.WithGroupName(groupName)).
				With(models.RuleGen.WithPrometheusOriginalRuleDefinition(promDefinition)).
				GenerateRef()
			ruleStore.PutRule(context.Background(), rule)

			return srv, ruleStore, fldr, rule
		}

		t.Run("valid request should delete rules", func(t *testing.T) {
			srv, ruleStore, fldr, rule := initGroup("prometheus definition", groupName)
			rc := createRequestCtx()

			// Create another rule in a different group that should not be deleted
			otherGroupName := "other-group"
			otherRule := models.RuleGen.
				With(models.RuleGen.WithNamespaceUID(fldr.UID)).
				With(models.RuleGen.WithOrgID(1)).
				With(models.RuleGen.WithGroupName(otherGroupName)).
				With(models.RuleGen.WithPrometheusOriginalRuleDefinition("other prometheus definition")).
				GenerateRef()
			ruleStore.PutRule(context.Background(), otherRule)

			response := srv.RouteConvertPrometheusDeleteRuleGroup(rc, fldr.Title, groupName)
			require.Equal(t, http.StatusAccepted, response.Status())

			// Verify the rule was deleted
			remaining, err := ruleStore.GetAlertRuleByUID(context.Background(), &models.GetAlertRuleByUIDQuery{
				UID:   rule.UID,
				OrgID: rule.OrgID,
			})
			require.Error(t, err)
			require.Nil(t, remaining)

			// Verify the otherRule from the "other-group" is still present
			otherRuleRefreshed, err := ruleStore.GetAlertRuleByUID(context.Background(), &models.GetAlertRuleByUIDQuery{
				UID:   otherRule.UID,
				OrgID: otherRule.OrgID,
			})
			require.NoError(t, err)
			require.NotNil(t, otherRuleRefreshed)
		})

		t.Run("fails to delete rules when they are provisioned", func(t *testing.T) {
			provenanceStore := fakes.NewFakeProvisioningStore()
			srv, ruleStore, fldr, rule := initGroup("", groupName, withProvenanceStore(provenanceStore))
			rc := createRequestCtx()

			// Create a provisioned rule
			rule2 := models.RuleGen.
				With(models.RuleGen.WithNamespaceUID(fldr.UID)).
				With(models.RuleGen.WithOrgID(1)).
				With(models.RuleGen.WithGroupName(groupName)).
				With(models.RuleGen.WithPrometheusOriginalRuleDefinition("prometheus definition")).
				GenerateRef()
			ruleStore.PutRule(context.Background(), rule2)
			err := provenanceStore.SetProvenance(context.Background(), rule2, 1, models.ProvenanceAPI)
			require.NoError(t, err)

			response := srv.RouteConvertPrometheusDeleteRuleGroup(rc, fldr.Title, groupName)
			require.Equal(t, http.StatusConflict, response.Status())

			// Verify the rule is still present
			remaining, err := ruleStore.GetAlertRuleByUID(context.Background(), &models.GetAlertRuleByUIDQuery{
				UID:   rule.UID,
				OrgID: rule.OrgID,
			})
			require.NoError(t, err)
			require.NotNil(t, remaining)
		})

		t.Run("with disable provenance header should still be able to delete rules", func(t *testing.T) {
			provenanceStore := fakes.NewFakeProvisioningStore()
			srv, ruleStore, fldr, rule := initGroup("", groupName, withProvenanceStore(provenanceStore))

			// Mark the rule as provisioned with API provenance
			err := provenanceStore.SetProvenance(context.Background(), rule, 1, models.ProvenanceConvertedPrometheus)
			require.NoError(t, err)

			rc := createRequestCtx()
			rc.Req.Header.Set("X-Disable-Provenance", "true")

			response := srv.RouteConvertPrometheusDeleteRuleGroup(rc, fldr.Title, groupName)
			require.Equal(t, http.StatusAccepted, response.Status())

			// Verify the rule was deleted
			remaining, err := ruleStore.GetAlertRuleByUID(context.Background(), &models.GetAlertRuleByUIDQuery{
				UID:   rule.UID,
				OrgID: rule.OrgID,
			})
			require.Error(t, err)
			require.Nil(t, remaining)
		})
	})
}

func TestRouteConvertPrometheusPostRuleGroups(t *testing.T) {
	srv, _, ruleStore, folderService := createConvertPrometheusSrv(t)

	req := createRequestCtx()
	req.Req.Header.Set(datasourceUIDHeader, existingDSUID)

	// Create test prometheus rules
	promAlertRule := apimodels.PrometheusRule{
		Alert: "TestAlert",
		Expr:  "up == 0",
		For:   util.Pointer(prommodel.Duration(5 * time.Minute)),
		Labels: map[string]string{
			"severity": "critical",
		},
	}

	promRecordingRule := apimodels.PrometheusRule{
		Record: "TestRecordingRule",
		Expr:   "up == 0",
	}

	promGroup1 := apimodels.PrometheusRuleGroup{
		Name:     "TestGroup1",
		Interval: prommodel.Duration(1 * time.Minute),
		Rules:    []apimodels.PrometheusRule{promAlertRule},
	}

	promGroup2 := apimodels.PrometheusRuleGroup{
		Name:     "TestGroup2",
		Interval: prommodel.Duration(1 * time.Minute),
		Rules:    []apimodels.PrometheusRule{promAlertRule},
	}

	promGroup3 := apimodels.PrometheusRuleGroup{
		Name:     "TestGroup3",
		Interval: prommodel.Duration(1 * time.Minute),
		Rules:    []apimodels.PrometheusRule{promAlertRule, promRecordingRule},
	}

	promGroups := map[string][]apimodels.PrometheusRuleGroup{
		"namespace1": {promGroup1, promGroup2},
		"namespace2": {promGroup3},
	}

	t.Run("should convert prometheus rules to Grafana rules", func(t *testing.T) {
		// Call the endpoint
		response := srv.RouteConvertPrometheusPostRuleGroups(req, promGroups)
		require.Equal(t, http.StatusAccepted, response.Status())

		// Verify the rules were created
		rules, err := ruleStore.ListAlertRules(req.Req.Context(), &models.ListAlertRulesQuery{
			OrgID: req.GetOrgID(),
		})
		require.NoError(t, err)
		require.Len(t, rules, 4)

		// Verify rule content
		for _, rule := range rules {
			require.Equal(t, int64(60), rule.IntervalSeconds) // 1 minute interval

			// Check that the rule matches one of our original prometheus rules
			switch rule.RuleGroup {
			case "TestGroup1":
				require.Equal(t, "TestAlert", rule.Title)
				require.Equal(t, "critical", rule.Labels["severity"])
				require.Equal(t, 5*time.Minute, rule.For)
			case "TestGroup2":
				require.Equal(t, "TestAlert", rule.Title)
				require.Equal(t, "critical", rule.Labels["severity"])
				require.Equal(t, 5*time.Minute, rule.For)
			case "TestGroup3":
				switch rule.Title {
				case "TestAlert":
					require.Equal(t, "critical", rule.Labels["severity"])
					require.Equal(t, 5*time.Minute, rule.For)
				case "TestRecordingRule":
					require.Equal(t, "TestRecordingRule", rule.Record.Metric)
				default:
					t.Fatalf("unexpected rule title: %s", rule.Title)
				}
			default:
				t.Fatalf("unexpected rule group: %s", rule.RuleGroup)
			}
		}
	})

	t.Run("should convert Prometheus rules to Grafana rules but pause recording rules", func(t *testing.T) {
		clear(ruleStore.Rules)

		req.Req.Header.Set(alertRulesPausedHeader, "false")
		req.Req.Header.Set(recordingRulesPausedHeader, "true")

		// Call the endpoint
		response := srv.RouteConvertPrometheusPostRuleGroups(req, promGroups)
		require.Equal(t, http.StatusAccepted, response.Status())

		// Verify the rules were created
		rules, err := ruleStore.ListAlertRules(req.Req.Context(), &models.ListAlertRulesQuery{
			OrgID: req.GetOrgID(),
		})
		require.NoError(t, err)
		require.Len(t, rules, 4)

		// Verify the recording rule is paused
		for _, rule := range rules {
			if rule.Record != nil {
				require.True(t, rule.IsPaused)
			}
		}
	})

	t.Run("should convert Prometheus rules to Grafana rules but pause alert rules", func(t *testing.T) {
		clear(ruleStore.Rules)

		req.Req.Header.Set(alertRulesPausedHeader, "true")
		req.Req.Header.Set(recordingRulesPausedHeader, "false")

		// Call the endpoint
		response := srv.RouteConvertPrometheusPostRuleGroups(req, promGroups)
		require.Equal(t, http.StatusAccepted, response.Status())

		// Verify the rules were created
		rules, err := ruleStore.ListAlertRules(req.Req.Context(), &models.ListAlertRulesQuery{
			OrgID: req.GetOrgID(),
		})
		require.NoError(t, err)
		require.Len(t, rules, 4)

		// Verify the alert rule is paused
		for _, rule := range rules {
			if rule.Record == nil {
				require.True(t, rule.IsPaused)
			}
		}
	})

	t.Run("should convert Prometheus rules to Grafana rules but pause both alert and recording rules", func(t *testing.T) {
		clear(ruleStore.Rules)

		req.Req.Header.Set(recordingRulesPausedHeader, "true")
		req.Req.Header.Set(alertRulesPausedHeader, "true")

		// Call the endpoint
		response := srv.RouteConvertPrometheusPostRuleGroups(req, promGroups)
		require.Equal(t, http.StatusAccepted, response.Status())

		// Verify the rules were created
		rules, err := ruleStore.ListAlertRules(req.Req.Context(), &models.ListAlertRulesQuery{
			OrgID: req.GetOrgID(),
		})
		require.NoError(t, err)
		require.Len(t, rules, 4)

		// Verify the alert rule is paused
		for _, rule := range rules {
			require.True(t, rule.IsPaused)
		}
	})

	t.Run("convert Prometheus rules to Grafana rules into a specified target folder", func(t *testing.T) {
		clear(ruleStore.Rules)

		// Create a target folder to move the rules into
		fldr := randFolder()
		fldr.ParentUID = ""
		folderService.ExpectedFolder = fldr
		folderService.ExpectedFolders = []*folder.Folder{fldr}
		ruleStore.Folders[1] = append(ruleStore.Folders[1], fldr)

		req.Req.Header.Del(recordingRulesPausedHeader)
		req.Req.Header.Del(alertRulesPausedHeader)
		req.Req.Header.Set(folderUIDHeader, fldr.UID)

		// Call the endpoint
		response := srv.RouteConvertPrometheusPostRuleGroups(req, promGroups)
		require.Equal(t, http.StatusAccepted, response.Status())

		// Verify the rules were created
		rules, err := ruleStore.ListAlertRules(req.Req.Context(), &models.ListAlertRulesQuery{
			OrgID: req.GetOrgID(),
		})

		require.NoError(t, err)
		require.Len(t, rules, 4)

		for _, rule := range rules {
			parentFolders, err := folderService.GetParents(context.Background(), folder.GetParentsQuery{UID: rule.NamespaceUID, OrgID: 1})
			require.NoError(t, err)
			require.Len(t, parentFolders, 1)
			require.Equal(t, fldr.UID, parentFolders[0].UID)
		}
	})
}

type convertPrometheusSrvOptions struct {
	provenanceStore              provisioning.ProvisioningStore
	fakeAccessControlRuleService *acfakes.FakeRuleService
	quotaChecker                 *provisioning.MockQuotaChecker
	featureToggles               featuremgmt.FeatureToggles
}

type convertPrometheusSrvOptionsFunc func(*convertPrometheusSrvOptions)

func withProvenanceStore(store provisioning.ProvisioningStore) convertPrometheusSrvOptionsFunc {
	return func(opts *convertPrometheusSrvOptions) {
		opts.provenanceStore = store
	}
}

func withFakeAccessControlRuleService(service *acfakes.FakeRuleService) convertPrometheusSrvOptionsFunc {
	return func(opts *convertPrometheusSrvOptions) {
		opts.fakeAccessControlRuleService = service
	}
}

func withQuotaChecker(checker *provisioning.MockQuotaChecker) convertPrometheusSrvOptionsFunc {
	return func(opts *convertPrometheusSrvOptions) {
		opts.quotaChecker = checker
	}
}

func withFeatureToggles(toggles featuremgmt.FeatureToggles) convertPrometheusSrvOptionsFunc {
	return func(opts *convertPrometheusSrvOptions) {
		opts.featureToggles = toggles
	}
}

func createConvertPrometheusSrv(t *testing.T, opts ...convertPrometheusSrvOptionsFunc) (*ConvertPrometheusSrv, *dsfakes.FakeCacheService, *fakes.RuleStore, *foldertest.FakeService) {
	t.Helper()

	// By default the quota checker will allow the operation
	quotas := &provisioning.MockQuotaChecker{}
	quotas.EXPECT().LimitOK()

	options := convertPrometheusSrvOptions{
		provenanceStore:              fakes.NewFakeProvisioningStore(),
		fakeAccessControlRuleService: &acfakes.FakeRuleService{},
		quotaChecker:                 quotas,
		featureToggles:               featuremgmt.WithFeatures(featuremgmt.FlagGrafanaManagedRecordingRulesDatasources),
	}

	for _, opt := range opts {
		opt(&options)
	}

	ruleStore := fakes.NewRuleStore(t)
	folder := randFolder()
	ruleStore.Folders[1] = append(ruleStore.Folders[1], folder)

	dsCache := &dsfakes.FakeCacheService{}
	ds := &datasources.DataSource{
		UID:  existingDSUID,
		Type: datasources.DS_PROMETHEUS,
	}
	dsCache.DataSources = append(dsCache.DataSources, ds)

	folderService := foldertest.NewFakeService()

	alertRuleService := provisioning.NewAlertRuleService(
		ruleStore,
		options.provenanceStore,
		folderService,
		options.quotaChecker,
		&provisioning.NopTransactionManager{},
		60,
		10,
		100,
		log.New("test"),
		&provisioning.NotificationSettingsValidatorProviderFake{},
		options.fakeAccessControlRuleService,
	)

	cfg := &setting.UnifiedAlertingSettings{
		DefaultRuleEvaluationInterval: 1 * time.Minute,
		RecordingRules: setting.RecordingRuleSettings{
			Enabled: true,
		},
	}

	srv := NewConvertPrometheusSrv(cfg, log.NewNopLogger(), ruleStore, dsCache, alertRuleService, options.featureToggles)

	return srv, dsCache, ruleStore, folderService
}

func createRequestCtx() *contextmodel.ReqContext {
	req := httptest.NewRequest("GET", "http://localhost", nil)
	req.Header.Set(datasourceUIDHeader, existingDSUID)

	return &contextmodel.ReqContext{
		Context: &web.Context{
			Req:  req,
			Resp: web.NewResponseWriter("GET", httptest.NewRecorder()),
		},
		SignedInUser: &user.SignedInUser{OrgID: 1},
	}
}

// Test parseBooleanHeader function which handles boolean header values
func TestParseBooleanHeader(t *testing.T) {
	headerName := "X-Test-Header"

	t.Run("should return false when header is not present", func(t *testing.T) {
		result, err := parseBooleanHeader("", headerName)
		require.NoError(t, err)
		require.False(t, result)
	})

	t.Run("should return true when header is 'true'", func(t *testing.T) {
		result, err := parseBooleanHeader("true", headerName)
		require.NoError(t, err)
		require.True(t, result)
	})

	t.Run("should return false when header is 'false'", func(t *testing.T) {
		result, err := parseBooleanHeader("false", headerName)
		require.NoError(t, err)
		require.False(t, result)
	})

	t.Run("should return true when header is 'TRUE' (case insensitive)", func(t *testing.T) {
		result, err := parseBooleanHeader("TRUE", headerName)
		require.NoError(t, err)
		require.True(t, result)
	})

	t.Run("should return error when header has invalid value", func(t *testing.T) {
		_, err := parseBooleanHeader("invalid", headerName)
		require.Error(t, err)
		require.ErrorContains(t, err, "Invalid value for header")
	})

	t.Run("should return error when header is numeric but not 0/1", func(t *testing.T) {
		_, err := parseBooleanHeader("2", headerName)
		require.Error(t, err)
	})
}

func TestGetWorkingFolderUID(t *testing.T) {
	t.Run("should return root folder UID when header is not present", func(t *testing.T) {
		rc := createRequestCtx()
		rc.Req.Header.Del(folderUIDHeader)

		folderUID := getWorkingFolderUID(rc)
		require.Equal(t, folder.RootFolderUID, folderUID)
	})

	t.Run("should return specified folder UID when header is present", func(t *testing.T) {
		rc := createRequestCtx()
		specifiedFolderUID := "specified-folder-uid"
		rc.Req.Header.Set(folderUIDHeader, specifiedFolderUID)

		folderUID := getWorkingFolderUID(rc)
		require.Equal(t, specifiedFolderUID, folderUID)
	})

	t.Run("should return root folder UID when header is empty", func(t *testing.T) {
		rc := createRequestCtx()
		rc.Req.Header.Set(folderUIDHeader, "")

		folderUID := getWorkingFolderUID(rc)
		require.Equal(t, folder.RootFolderUID, folderUID)
	})

	t.Run("should trim whitespace from header value", func(t *testing.T) {
		rc := createRequestCtx()
		specifiedFolderUID := "specified-folder-uid"
		rc.Req.Header.Set(folderUIDHeader, "  "+specifiedFolderUID+"  ")

		folderUID := getWorkingFolderUID(rc)
		require.Equal(t, specifiedFolderUID, folderUID)
	})
}

func TestGetProvenance(t *testing.T) {
	t.Run("should return ProvenanceConvertedPrometheus when header is not present", func(t *testing.T) {
		rc := createRequestCtx()
		// Ensure the header is not present
		rc.Req.Header.Del(disableProvenanceHeaderName)

		provenance := getProvenance(rc)
		require.Equal(t, models.ProvenanceConvertedPrometheus, provenance)
	})

	t.Run("should return ProvenanceNone when header is present", func(t *testing.T) {
		rc := createRequestCtx()
		// Set the disable provenance header
		rc.Req.Header.Set(disableProvenanceHeaderName, "true")

		provenance := getProvenance(rc)
		require.Equal(t, models.ProvenanceNone, provenance)
	})

	t.Run("should return ProvenanceNone when header is present with any value", func(t *testing.T) {
		rc := createRequestCtx()
		// Set the disable provenance header with an empty value
		rc.Req.Header.Set(disableProvenanceHeaderName, "")

		provenance := getProvenance(rc)
		require.Equal(t, models.ProvenanceNone, provenance)
	})
}
