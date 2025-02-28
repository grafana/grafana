package api

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	prommodel "github.com/prometheus/common/model"
	"github.com/stretchr/testify/require"
	"gopkg.in/yaml.v3"

	"github.com/grafana/grafana/pkg/infra/log"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/datasources"
	dsfakes "github.com/grafana/grafana/pkg/services/datasources/fakes"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/folder/foldertest"
	acfakes "github.com/grafana/grafana/pkg/services/ngalert/accesscontrol/fakes"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/provisioning"
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

		// Get the updated rule
		remaining, err := ruleStore.ListAlertRules(context.Background(), &models.ListAlertRulesQuery{
			OrgID: 1,
		})
		require.NoError(t, err)
		require.Len(t, remaining, 1)

		require.Equal(t, simpleGroup.Name, remaining[0].RuleGroup)
		require.Equal(t, fmt.Sprintf("[%s] %s", simpleGroup.Name, simpleGroup.Rules[0].Alert), remaining[0].Title)
		promRuleYAML, err := yaml.Marshal(simpleGroup.Rules[0])
		require.NoError(t, err)
		require.Equal(t, string(promRuleYAML), remaining[0].PrometheusRuleDefinition())
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
		groupKey := models.GenerateGroupKey(rc.SignedInUser.OrgID)
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
		groupKeyNotFromProm := models.GenerateGroupKey(rc.SignedInUser.OrgID)
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
			groupKey := models.GenerateGroupKey(rc.SignedInUser.OrgID)
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
		require.Contains(t, respNamespaces, fldr.Fullpath)
		require.ElementsMatch(t, respNamespaces[fldr.Fullpath], []apimodels.PrometheusRuleGroup{promGroup1, promGroup2})
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

	t.Run("with no rules should return empty response", func(t *testing.T) {
		srv, _, _, _ := createConvertPrometheusSrv(t)
		rc := createRequestCtx()

		response := srv.RouteConvertPrometheusGetRules(rc)
		require.Equal(t, http.StatusOK, response.Status())

		var respNamespaces map[string][]apimodels.PrometheusRuleGroup
		err := yaml.Unmarshal(response.Body(), &respNamespaces)
		require.NoError(t, err)
		require.Empty(t, respNamespaces)
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
			groupKey := models.GenerateGroupKey(rc.SignedInUser.OrgID)
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
		require.Contains(t, respNamespaces, fldr.Fullpath)
		require.ElementsMatch(t, respNamespaces[fldr.Fullpath], []apimodels.PrometheusRuleGroup{promGroup1, promGroup2})
	})
}

func TestRouteConvertPrometheusDeleteNamespace(t *testing.T) {
	t.Run("for non-existent folder should return 404", func(t *testing.T) {
		srv, _, _, _ := createConvertPrometheusSrv(t)
		rc := createRequestCtx()

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
	})
}

func TestRouteConvertPrometheusDeleteRuleGroup(t *testing.T) {
	t.Run("for non-existent folder should return 404", func(t *testing.T) {
		srv, _, _, _ := createConvertPrometheusSrv(t)
		rc := createRequestCtx()

		response := srv.RouteConvertPrometheusDeleteRuleGroup(rc, "non-existent", "test-group")
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
	})
}

type convertPrometheusSrvOptions struct {
	provenanceStore provisioning.ProvisioningStore
}

type convertPrometheusSrvOptionsFunc func(*convertPrometheusSrvOptions)

func withProvenanceStore(store provisioning.ProvisioningStore) convertPrometheusSrvOptionsFunc {
	return func(opts *convertPrometheusSrvOptions) {
		opts.provenanceStore = store
	}
}

func createConvertPrometheusSrv(t *testing.T, opts ...convertPrometheusSrvOptionsFunc) (*ConvertPrometheusSrv, datasources.CacheService, *fakes.RuleStore, *foldertest.FakeService) {
	t.Helper()

	options := convertPrometheusSrvOptions{
		provenanceStore: fakes.NewFakeProvisioningStore(),
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

	quotas := &provisioning.MockQuotaChecker{}
	quotas.EXPECT().LimitOK()

	folderService := foldertest.NewFakeService()

	alertRuleService := provisioning.NewAlertRuleService(
		ruleStore,
		options.provenanceStore,
		folderService,
		quotas,
		&provisioning.NopTransactionManager{},
		60,
		10,
		100,
		log.New("test"),
		&provisioning.NotificationSettingsValidatorProviderFake{},
		&acfakes.FakeRuleService{},
	)

	cfg := &setting.UnifiedAlertingSettings{
		DefaultRuleEvaluationInterval: 1 * time.Minute,
	}

	srv := NewConvertPrometheusSrv(cfg, log.NewNopLogger(), ruleStore, dsCache, alertRuleService)

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
