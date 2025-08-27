package api

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	amconfig "github.com/prometheus/alertmanager/config"
	"github.com/prometheus/alertmanager/pkg/labels"
	prommodel "github.com/prometheus/common/model"
	"github.com/stretchr/testify/mock"
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
		srv, _, _ := createConvertPrometheusSrv(t)
		rc := createRequestCtx()
		rc.Req.Header.Set(datasourceUIDHeader, "")

		response := srv.RouteConvertPrometheusPostRuleGroup(rc, "test", apimodels.PrometheusRuleGroup{})

		require.Equal(t, http.StatusBadRequest, response.Status())
		require.Contains(t, string(response.Body()), "Missing datasource UID header")
	})

	t.Run("with invalid datasource should return error", func(t *testing.T) {
		srv, _, _ := createConvertPrometheusSrv(t)
		rc := createRequestCtx()
		rc.Req.Header.Set(datasourceUIDHeader, "non-existing-ds")

		response := srv.RouteConvertPrometheusPostRuleGroup(rc, "test", apimodels.PrometheusRuleGroup{})

		require.Equal(t, http.StatusNotFound, response.Status())
	})

	t.Run("with rule group without evaluation interval should return 202", func(t *testing.T) {
		srv, _, _ := createConvertPrometheusSrv(t)
		rc := createRequestCtx()

		response := srv.RouteConvertPrometheusPostRuleGroup(rc, "test", simpleGroup)
		require.Equal(t, http.StatusAccepted, response.Status())
	})

	t.Run("should replace an existing rule group", func(t *testing.T) {
		provenanceStore := fakes.NewFakeProvisioningStore()
		folderService := foldertest.NewFakeService()
		srv, _, ruleStore := createConvertPrometheusSrv(t, withProvenanceStore(provenanceStore), withFolderService(folderService))

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
		folderService := foldertest.NewFakeService()
		srv, _, ruleStore := createConvertPrometheusSrv(t, withProvenanceStore(provenanceStore), withFolderService(folderService))

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
		srv, _, _ := createConvertPrometheusSrv(t, withFakeAccessControlRuleService(acFake))

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

		srv, _, _ := createConvertPrometheusSrv(t, withQuotaChecker(quotas))

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
				srv, _, _ := createConvertPrometheusSrv(t)
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
				srv, _, _ := createConvertPrometheusSrv(t)
				rc := createRequestCtx()
				rc.Req.Header.Set(tc.headerName, tc.headerValue)

				response := srv.RouteConvertPrometheusPostRuleGroup(rc, "test", simpleGroup)
				require.Equal(t, http.StatusBadRequest, response.Status())
				require.Contains(t, string(response.Body()), tc.expectedError)
			})
		}
	})

	t.Run("with extra labels header should apply labels to all rules", func(t *testing.T) {
		srv, _, ruleStore := createConvertPrometheusSrv(t)
		rc := createRequestCtx()
		rc.Req.Header.Set(extraLabelsHeader, "environment=production,team=alerting")

		response := srv.RouteConvertPrometheusPostRuleGroup(rc, "test", simpleGroup)
		require.Equal(t, http.StatusAccepted, response.Status())

		rules, err := ruleStore.ListAlertRules(context.Background(), &models.ListAlertRulesQuery{
			OrgID: 1,
		})
		require.NoError(t, err)
		require.Len(t, rules, 2)

		for _, rule := range rules {
			require.Equal(t, "production", rule.Labels["environment"])
			require.Equal(t, "alerting", rule.Labels["team"])
		}

		// Original labels must be preserved
		alertRule := rules[0]
		if alertRule.Title == "recorded-metric" {
			alertRule = rules[1]
		}
		require.Equal(t, "critical", alertRule.Labels["severity"])
	})

	t.Run("with extra labels that conflict with rule labels", func(t *testing.T) {
		srv, _, ruleStore := createConvertPrometheusSrv(t)
		rc := createRequestCtx()
		// rules in the simpleGroup already have a severity label, so
		// it should not be overwritten by the label from the header
		rc.Req.Header.Set(extraLabelsHeader, "environment=production,severity=low")

		response := srv.RouteConvertPrometheusPostRuleGroup(rc, "test", simpleGroup)
		require.Equal(t, http.StatusAccepted, response.Status())

		rules, err := ruleStore.ListAlertRules(context.Background(), &models.ListAlertRulesQuery{
			OrgID: 1,
		})
		require.NoError(t, err)
		require.Len(t, rules, 2)

		for _, rule := range rules {
			require.Equal(t, "production", rule.Labels["environment"])
			require.NotEqual(t, "low", rule.Labels["severity"])
		}
	})

	t.Run("with invalid extra labels header should return 400", func(t *testing.T) {
		testCases := []struct {
			name          string
			headerValue   string
			expectedError string
		}{
			{
				name:          "missing equals sign",
				headerValue:   "environment,team=platform",
				expectedError: "Invalid value for header X-Grafana-Alerting-Extra-Labels: format should be 'key=value,key2=value2'",
			},
			{
				name:          "empty key",
				headerValue:   "=production,team=platform",
				expectedError: "Invalid value for header X-Grafana-Alerting-Extra-Labels: keys and values cannot be empty",
			},
			{
				name:          "empty value",
				headerValue:   "environment=,team=platform",
				expectedError: "Invalid value for header X-Grafana-Alerting-Extra-Labels: keys and values cannot be empty",
			},
		}

		for _, tc := range testCases {
			t.Run(tc.name, func(t *testing.T) {
				srv, _, _ := createConvertPrometheusSrv(t)
				rc := createRequestCtx()
				rc.Req.Header.Set(extraLabelsHeader, tc.headerValue)

				response := srv.RouteConvertPrometheusPostRuleGroup(rc, "test", simpleGroup)
				require.Equal(t, http.StatusBadRequest, response.Status())
				require.Contains(t, string(response.Body()), tc.expectedError)
			})
		}
	})

	t.Run("with empty rule group name should return 400", func(t *testing.T) {
		srv, _, _ := createConvertPrometheusSrv(t)
		rc := createRequestCtx()

		emptyNameGroup := apimodels.PrometheusRuleGroup{
			Name:     "",
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

		response := srv.RouteConvertPrometheusPostRuleGroup(rc, "test", emptyNameGroup)
		require.Equal(t, http.StatusBadRequest, response.Status())
		require.Contains(t, string(response.Body()), "rule group name must not be empty")
	})

	t.Run("with valid request should return 202", func(t *testing.T) {
		srv, _, _ := createConvertPrometheusSrv(t)
		rc := createRequestCtx()

		response := srv.RouteConvertPrometheusPostRuleGroup(rc, "test", simpleGroup)
		require.Equal(t, http.StatusAccepted, response.Status())
	})

	t.Run("with disabled recording rules", func(t *testing.T) {
		testCases := []struct {
			name           string
			recordingRules bool
			expectedStatus int
		}{
			{
				name:           "when recording rules are enabled",
				recordingRules: true,
				expectedStatus: http.StatusAccepted,
			},
			{
				name:           "when recording rules are disabled",
				recordingRules: false,
				expectedStatus: http.StatusBadRequest,
			},
		}

		for _, tc := range testCases {
			t.Run(tc.name, func(t *testing.T) {
				features := featuremgmt.WithFeatures()

				srv, _, _ := createConvertPrometheusSrv(t, withFeatureToggles(features))
				srv.cfg.RecordingRules.Enabled = tc.recordingRules
				rc := createRequestCtx()

				response := srv.RouteConvertPrometheusPostRuleGroup(rc, "test", simpleGroup)
				require.Equal(t, tc.expectedStatus, response.Status())
			})
		}
	})

	t.Run("with disable provenance header should use ProvenanceNone", func(t *testing.T) {
		provenanceStore := fakes.NewFakeProvisioningStore()
		folderService := foldertest.NewFakeService()
		srv, _, ruleStore := createConvertPrometheusSrv(t, withProvenanceStore(provenanceStore), withFolderService(folderService))

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
		srv, _, _ := createConvertPrometheusSrv(t)
		rc := createRequestCtx()
		rc.Req.Header.Set(targetDatasourceUIDHeader, "some-data-source")

		response := srv.RouteConvertPrometheusPostRuleGroup(rc, "test", simpleGroup)
		require.Equal(t, http.StatusNotFound, response.Status())
		require.Contains(t, string(response.Body()), "failed to get recording rules target datasource")
	})

	t.Run("uses target datasource for recording rules", func(t *testing.T) {
		srv, dsCache, ruleStore := createConvertPrometheusSrv(t)
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

	t.Run("sets notification settings for rules if specified", func(t *testing.T) {
		srv, _, ruleStore := createConvertPrometheusSrv(t)
		rc := createRequestCtx()

		receiver := "test-receiver"
		groupBy := []string{"cluster", "pod"}
		settings := apimodels.AlertRuleNotificationSettings{
			Receiver: receiver,
			GroupBy:  groupBy,
		}
		settingsJSON, err := json.Marshal(settings)
		require.NoError(t, err)
		rc.Req.Header.Set(notificationSettingsHeader, string(settingsJSON))

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

		response := srv.RouteConvertPrometheusPostRuleGroup(rc, "test", simpleGroup)
		require.Equal(t, http.StatusAccepted, response.Status())

		createdRules, err := ruleStore.ListAlertRules(context.Background(), &models.ListAlertRulesQuery{
			OrgID: 1,
		})
		require.NoError(t, err)
		require.Len(t, createdRules, 1)
		require.Len(t, createdRules[0].NotificationSettings, 1)
		require.Equal(t, receiver, createdRules[0].NotificationSettings[0].Receiver)
		require.Equal(t, groupBy, createdRules[0].NotificationSettings[0].GroupBy)
	})

	t.Run("returns error when notification settings header contains invalid JSON", func(t *testing.T) {
		srv, _, _ := createConvertPrometheusSrv(t)
		rc := createRequestCtx()

		rc.Req.Header.Set(notificationSettingsHeader, "{invalid json")

		simpleGroup := apimodels.PrometheusRuleGroup{
			Name:     "Test Group",
			Interval: prommodel.Duration(1 * time.Minute),
			Rules: []apimodels.PrometheusRule{
				{
					Alert: "TestAlert",
					Expr:  "up == 0",
				},
			},
		}

		response := srv.RouteConvertPrometheusPostRuleGroup(rc, "test", simpleGroup)
		require.Equal(t, http.StatusBadRequest, response.Status())
		require.Contains(t, string(response.Body()), "Invalid value for header X-Grafana-Alerting-Notification-Settings")
	})

	t.Run("returns error when notification settings contain invalid values", func(t *testing.T) {
		srv, _, _ := createConvertPrometheusSrv(t)
		rc := createRequestCtx()

		settings := apimodels.AlertRuleNotificationSettings{
			Receiver: "", // empty receiver is invalid
		}
		settingsJSON, err := json.Marshal(settings)
		require.NoError(t, err)
		rc.Req.Header.Set(notificationSettingsHeader, string(settingsJSON))

		simpleGroup := apimodels.PrometheusRuleGroup{
			Name:     "Test Group",
			Interval: prommodel.Duration(1 * time.Minute),
			Rules: []apimodels.PrometheusRule{
				{
					Alert: "TestAlert",
					Expr:  "up == 0",
				},
			},
		}

		response := srv.RouteConvertPrometheusPostRuleGroup(rc, "test", simpleGroup)
		require.Equal(t, http.StatusBadRequest, response.Status())
		require.Contains(t, string(response.Body()), "Invalid value for header X-Grafana-Alerting-Notification-Settings")
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
		srv, _, _ := createConvertPrometheusSrv(t)
		rc := createRequestCtx()

		response := srv.RouteConvertPrometheusGetRuleGroup(rc, "non-existent", "test")
		require.Equal(t, http.StatusNotFound, response.Status(), string(response.Body()))
	})

	t.Run("with non-existent group should return 404", func(t *testing.T) {
		srv, _, _ := createConvertPrometheusSrv(t)
		rc := createRequestCtx()

		response := srv.RouteConvertPrometheusGetRuleGroup(rc, "test", "non-existent")
		require.Equal(t, http.StatusNotFound, response.Status(), string(response.Body()))
	})

	t.Run("with valid request should return 200", func(t *testing.T) {
		folderService := foldertest.NewFakeService()
		srv, _, ruleStore := createConvertPrometheusSrv(t, withFolderService(folderService))
		rc := createRequestCtx()

		// Create two folders in the root folder
		fldr := randFolder()
		fldr.ParentUID = ""
		folderService.ExpectedFolder = fldr
		folderService.ExpectedFolders = []*folder.Folder{fldr}
		folderService.AddFolder(fldr)
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

		t.Run("YAML response", func(t *testing.T) {
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

		t.Run("JSON response", func(t *testing.T) {
			rc.Req.Header.Set("Accept", "application/json")
			getResp := srv.RouteConvertPrometheusGetRuleGroup(rc, fldr.Title, groupKey.RuleGroup)
			require.Equal(t, http.StatusOK, getResp.Status())

			var jsonGroup apimodels.PrometheusRuleGroup
			err := json.Unmarshal(getResp.Body(), &jsonGroup)
			require.NoError(t, err)

			require.Equal(t, groupKey.RuleGroup, jsonGroup.Name)
			require.Equal(t, prommodel.Duration(time.Duration(rule.IntervalSeconds)*time.Second), jsonGroup.Interval)
			require.Len(t, jsonGroup.Rules, 1)
			require.Equal(t, promRule.Alert, jsonGroup.Rules[0].Alert)
		})
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
		srv, _, _ := createConvertPrometheusSrv(t)
		rc := createRequestCtx()

		response := srv.RouteConvertPrometheusGetNamespace(rc, "non-existent")
		require.Equal(t, http.StatusNotFound, response.Status())
	})

	t.Run("with valid request should return 200", func(t *testing.T) {
		folderService := foldertest.NewFakeService()
		srv, _, ruleStore := createConvertPrometheusSrv(t, withFolderService(folderService))
		rc := createRequestCtx()

		// Create two folders in the root folder
		fldr := randFolder()
		fldr.ParentUID = ""
		fldr2 := randFolder()
		fldr2.ParentUID = ""
		folderService.ExpectedFolders = []*folder.Folder{fldr, fldr2}
		folderService.AddFolder(fldr)
		folderService.AddFolder(fldr2)
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

		t.Run("YAML response", func(t *testing.T) {
			response := srv.RouteConvertPrometheusGetNamespace(rc, fldr.Title)
			require.Equal(t, http.StatusOK, response.Status())

			var respNamespaces map[string][]apimodels.PrometheusRuleGroup
			err := yaml.Unmarshal(response.Body(), &respNamespaces)
			require.NoError(t, err)

			require.Len(t, respNamespaces, 1)
			require.Contains(t, respNamespaces, fldr.Title)
			require.ElementsMatch(t, respNamespaces[fldr.Title], []apimodels.PrometheusRuleGroup{promGroup1, promGroup2})
		})

		t.Run("JSON response", func(t *testing.T) {
			rc.Req.Header.Set("Accept", "application/json")
			response := srv.RouteConvertPrometheusGetNamespace(rc, fldr.Title)
			require.Equal(t, http.StatusOK, response.Status())

			var jsonNamespaces map[string][]apimodels.PrometheusRuleGroup
			err := json.Unmarshal(response.Body(), &jsonNamespaces)
			require.NoError(t, err)

			require.Len(t, jsonNamespaces, 1)
			require.Contains(t, jsonNamespaces, fldr.Title)
			require.ElementsMatch(t, jsonNamespaces[fldr.Title], []apimodels.PrometheusRuleGroup{promGroup1, promGroup2})
		})
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
			srv, _, _ := createConvertPrometheusSrv(t)
			assertEmptyResponse(t, srv, rc)
		})

		t.Run("for existing folder with no children should return empty response", func(t *testing.T) {
			folderService := foldertest.NewFakeService()
			srv, _, ruleStore := createConvertPrometheusSrv(t, withFolderService(folderService))

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
		folderService := foldertest.NewFakeService()
		srv, _, ruleStore := createConvertPrometheusSrv(t, withFolderService(folderService))
		rc := createRequestCtx()

		// Create a folder in the root
		fldr := randFolder()
		fldr.ParentUID = ""
		folderService.AddFolder(fldr)
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

		t.Run("YAML response", func(t *testing.T) {
			response := srv.RouteConvertPrometheusGetRules(rc)
			require.Equal(t, http.StatusOK, response.Status())

			var respNamespaces map[string][]apimodels.PrometheusRuleGroup
			err := yaml.Unmarshal(response.Body(), &respNamespaces)
			require.NoError(t, err)

			require.Len(t, respNamespaces, 1)
			require.Contains(t, respNamespaces, fldr.Title)
			require.ElementsMatch(t, respNamespaces[fldr.Title], []apimodels.PrometheusRuleGroup{promGroup1, promGroup2})
		})

		t.Run("JSON response", func(t *testing.T) {
			rc.Req.Header.Set("Accept", "application/json")
			response := srv.RouteConvertPrometheusGetRules(rc)
			require.Equal(t, http.StatusOK, response.Status())

			var jsonNamespaces map[string][]apimodels.PrometheusRuleGroup
			err := json.Unmarshal(response.Body(), &jsonNamespaces)
			require.NoError(t, err)

			require.Len(t, jsonNamespaces, 1)
			require.Contains(t, jsonNamespaces, fldr.Title)
			require.ElementsMatch(t, jsonNamespaces[fldr.Title], []apimodels.PrometheusRuleGroup{promGroup1, promGroup2})
		})
	})
}

func TestConvertPrometheusResponse(t *testing.T) {
	testData := map[string][]apimodels.PrometheusRuleGroup{
		"test": {
			{
				Name: "test-group",
				Rules: []apimodels.PrometheusRule{
					{
						Alert: "TestAlert",
						Expr:  "up == 0",
					},
				},
			},
		},
	}

	testCases := []struct {
		name          string
		acceptHeader  string
		expectedType  string
		checkResponse func(t *testing.T, body []byte)
	}{
		{
			name:         "by default returns YAML",
			expectedType: "text/yaml",
			checkResponse: func(t *testing.T, body []byte) {
				require.True(t, strings.Contains(string(body), "test-group"))
				require.True(t, strings.Contains(string(body), "TestAlert"))
				var result map[string][]apimodels.PrometheusRuleGroup
				err := yaml.Unmarshal(body, &result)
				require.NoError(t, err)
			},
		},
		{
			name:         "with application/json Accept header returns JSON",
			acceptHeader: "application/json",
			expectedType: "application/json",
			checkResponse: func(t *testing.T, body []byte) {
				require.True(t, strings.Contains(string(body), "test-group"))
				require.True(t, strings.Contains(string(body), "TestAlert"))
				var result map[string][]apimodels.PrometheusRuleGroup
				err := json.Unmarshal(body, &result)
				require.NoError(t, err)
			},
		},
		{
			name:         "with application/yaml accept header returns YAML",
			acceptHeader: "application/yaml",
			expectedType: "text/yaml",
			checkResponse: func(t *testing.T, body []byte) {
				require.True(t, strings.Contains(string(body), "test-group"))
				require.True(t, strings.Contains(string(body), "TestAlert"))
				var result map[string][]apimodels.PrometheusRuleGroup
				err := yaml.Unmarshal(body, &result)
				require.NoError(t, err)
			},
		},
		{
			name:         "with a header with both json and yaml returns JSON",
			acceptHeader: "application/yaml, application/json",
			expectedType: "application/json",
			checkResponse: func(t *testing.T, body []byte) {
				require.True(t, strings.Contains(string(body), "test-group"))
				require.True(t, strings.Contains(string(body), "TestAlert"))
				var result map[string][]apimodels.PrometheusRuleGroup
				err := json.Unmarshal(body, &result)
				require.NoError(t, err)
			},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			rc := createRequestCtx()
			if tc.acceptHeader != "" {
				rc.Req.Header.Set("Accept", tc.acceptHeader)
			}

			response := convertPrometheusResponse(rc, http.StatusOK, testData)

			require.Equal(t, http.StatusOK, response.Status())
			tc.checkResponse(t, response.Body())
		})
	}
}

func TestRouteConvertPrometheusDeleteNamespace(t *testing.T) {
	t.Run("for non-existent folder should return 404", func(t *testing.T) {
		srv, _, _ := createConvertPrometheusSrv(t)
		rc := createRequestCtx()

		response := srv.RouteConvertPrometheusDeleteNamespace(rc, "non-existent")
		require.Equal(t, http.StatusNotFound, response.Status())
	})

	t.Run("for existing folder with no groups should return 404", func(t *testing.T) {
		folderService := foldertest.NewFakeService()
		srv, _, ruleStore := createConvertPrometheusSrv(t, withFolderService(folderService))
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
			folderService := foldertest.NewFakeService()
			srv, _, ruleStore := createConvertPrometheusSrv(t, append(opts, withFolderService(folderService))...)

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
		srv, _, _ := createConvertPrometheusSrv(t)
		rc := createRequestCtx()

		response := srv.RouteConvertPrometheusDeleteRuleGroup(rc, "non-existent", "test-group")
		require.Equal(t, http.StatusNotFound, response.Status())
	})

	t.Run("for existing folder with no group should return 404", func(t *testing.T) {
		folderService := foldertest.NewFakeService()
		srv, _, ruleStore := createConvertPrometheusSrv(t, withFolderService(folderService))
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
			folderService := foldertest.NewFakeService()
			srv, _, ruleStore := createConvertPrometheusSrv(t, append(opts, withFolderService(folderService))...)

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
	folderService := foldertest.NewFakeService()
	srv, _, ruleStore := createConvertPrometheusSrv(t, withFolderService(folderService))

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
		Labels: map[string]string{
			"group_label": "group_value",
		},
	}

	queryOffset := prommodel.Duration(5 * time.Minute)
	promGroup2 := apimodels.PrometheusRuleGroup{
		Name:        "TestGroup2",
		Interval:    prommodel.Duration(1 * time.Minute),
		Rules:       []apimodels.PrometheusRule{promAlertRule},
		QueryOffset: &queryOffset,
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
				require.Equal(t, "group_value", rule.Labels["group_label"])
			case "TestGroup2":
				require.Equal(t, "TestAlert", rule.Title)
				require.Equal(t, "critical", rule.Labels["severity"])
				require.Equal(t, 5*time.Minute, rule.For)
				require.Equal(t, models.Duration(queryOffset), rule.Data[0].RelativeTimeRange.To)
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
	alertmanager                 Alertmanager
	folderService                folder.Service
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

func withAlertmanager(am Alertmanager) convertPrometheusSrvOptionsFunc {
	return func(opts *convertPrometheusSrvOptions) {
		opts.alertmanager = am
	}
}

func withFolderService(f folder.Service) convertPrometheusSrvOptionsFunc {
	return func(opts *convertPrometheusSrvOptions) {
		opts.folderService = f
	}
}

func createConvertPrometheusSrv(t *testing.T, opts ...convertPrometheusSrvOptionsFunc) (*ConvertPrometheusSrv, *dsfakes.FakeCacheService, *fakes.RuleStore) {
	t.Helper()

	// By default the quota checker will allow the operation
	quotas := &provisioning.MockQuotaChecker{}
	quotas.EXPECT().LimitOK()

	options := convertPrometheusSrvOptions{
		provenanceStore:              fakes.NewFakeProvisioningStore(),
		fakeAccessControlRuleService: &acfakes.FakeRuleService{},
		quotaChecker:                 quotas,
		folderService:                foldertest.NewFakeService(),
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

	alertRuleService := provisioning.NewAlertRuleService(
		ruleStore,
		options.provenanceStore,
		options.folderService,
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

	srv := NewConvertPrometheusSrv(cfg, log.NewNopLogger(), ruleStore, dsCache, alertRuleService, options.featureToggles, options.alertmanager)

	return srv, dsCache, ruleStore
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

type mockAlertmanager struct {
	mock.Mock
}

func (m *mockAlertmanager) SaveAndApplyExtraConfiguration(ctx context.Context, org int64, extraConfig apimodels.ExtraConfiguration) error {
	args := m.Called(ctx, org, extraConfig)
	return args.Error(0)
}

func (m *mockAlertmanager) GetAlertmanagerConfiguration(ctx context.Context, org int64, withAutogen bool) (apimodels.GettableUserConfig, error) {
	args := m.Called(ctx, org, withAutogen)
	return args.Get(0).(apimodels.GettableUserConfig), args.Error(1)
}

func (m *mockAlertmanager) DeleteExtraConfiguration(ctx context.Context, org int64, identifier string) error {
	args := m.Called(ctx, org, identifier)
	return args.Error(0)
}

func TestRouteConvertPrometheusPostAlertmanagerConfig(t *testing.T) {
	const identifier = "test-config"
	mockAM := &mockAlertmanager{}

	ft := featuremgmt.WithFeatures(featuremgmt.FlagAlertingImportAlertmanagerAPI)
	srv, _, _ := createConvertPrometheusSrv(t, withAlertmanager(mockAM), withFeatureToggles(ft))

	t.Run("should parse headers and call SaveAndApplyExtraConfiguration", func(t *testing.T) {
		mockAM.On("SaveAndApplyExtraConfiguration", mock.Anything, int64(1), mock.MatchedBy(func(extraConfig apimodels.ExtraConfiguration) bool {
			return extraConfig.Identifier == identifier &&
				len(extraConfig.MergeMatchers) == 2 &&
				len(extraConfig.TemplateFiles) == 1 &&
				extraConfig.TemplateFiles["test.tmpl"] == "{{ define \"test\" }}Hello{{ end }}"
		})).Return(nil).Once()

		rc := createRequestCtx()
		rc.Req.Header.Set(configIdentifierHeader, identifier)
		rc.Req.Header.Set(mergeMatchersHeader, "environment=production,team=backend")

		amCfg := apimodels.AlertmanagerUserConfig{
			AlertmanagerConfig: `{
				"route": {
					"receiver": "default"
				},
				"receivers": [
					{
						"name": "default"
					}
				]
			}`,
			TemplateFiles: map[string]string{
				"test.tmpl": "{{ define \"test\" }}Hello{{ end }}",
			},
		}

		response := srv.RouteConvertPrometheusPostAlertmanagerConfig(rc, amCfg)

		require.Equal(t, http.StatusAccepted, response.Status())
		mockAM.AssertExpectations(t)
	})

	t.Run("should use default identifier when header is missing", func(t *testing.T) {
		rc := createRequestCtx()
		rc.Req.Header.Set(mergeMatchersHeader, "test=value")
		mockAM := &mockAlertmanager{}
		mockAM.On("SaveAndApplyExtraConfiguration", mock.Anything, int64(1), mock.MatchedBy(func(extraConfig apimodels.ExtraConfiguration) bool {
			return extraConfig.Identifier == defaultConfigIdentifier
		})).Return(nil)

		ft := featuremgmt.WithFeatures(featuremgmt.FlagAlertingImportAlertmanagerAPI)
		srv, _, _ := createConvertPrometheusSrv(t, withAlertmanager(mockAM), withFeatureToggles(ft))

		amCfg := apimodels.AlertmanagerUserConfig{
			AlertmanagerConfig: `{
				"route": {
					"receiver": "default"
				},
				"receivers": [
					{
						"name": "default"
					}
				]
			}`,
		}
		response := srv.RouteConvertPrometheusPostAlertmanagerConfig(rc, amCfg)

		require.Equal(t, http.StatusAccepted, response.Status())
		mockAM.AssertExpectations(t)
	})

	t.Run("should return error when merge matchers header has invalid format", func(t *testing.T) {
		rc := createRequestCtx()
		rc.Req.Header.Set(configIdentifierHeader, identifier)
		rc.Req.Header.Set(mergeMatchersHeader, "invalid-format")

		amCfg := apimodels.AlertmanagerUserConfig{}
		response := srv.RouteConvertPrometheusPostAlertmanagerConfig(rc, amCfg)

		require.Equal(t, http.StatusBadRequest, response.Status())
		require.Contains(t, string(response.Body()), "format should be 'key=value,key2=value2'")
	})

	t.Run("should return error when alertmanager config has empty route", func(t *testing.T) {
		rc := createRequestCtx()
		rc.Req.Header.Set(configIdentifierHeader, identifier)
		rc.Req.Header.Set(mergeMatchersHeader, "env=prod")

		amCfg := apimodels.AlertmanagerUserConfig{
			AlertmanagerConfig: `{
				"receivers": [
					{
						"name": "default"
					}
				]
			}`,
		}
		response := srv.RouteConvertPrometheusPostAlertmanagerConfig(rc, amCfg)

		require.Equal(t, http.StatusBadRequest, response.Status())
		require.Contains(t, string(response.Body()), "failed to parse alertmanager config")
	})
}

func TestRouteConvertPrometheusGetAlertmanagerConfig(t *testing.T) {
	const identifier = "test-config"
	const orgID = int64(1)

	t.Run("without feature flag should return 501", func(t *testing.T) {
		ft := featuremgmt.WithFeatures()
		srv, _, _ := createConvertPrometheusSrv(t, withFeatureToggles(ft))

		rc := createRequestCtx()
		rc.Req.Header.Set(configIdentifierHeader, identifier)
		response := srv.RouteConvertPrometheusGetAlertmanagerConfig(rc)

		require.Equal(t, http.StatusNotImplemented, response.Status())
	})

	t.Run("without config identifier header should use default identifier", func(t *testing.T) {
		mockAM := &mockAlertmanager{}
		mockAM.On("GetAlertmanagerConfiguration", mock.Anything, orgID, false).Return(apimodels.GettableUserConfig{
			ExtraConfigs: []apimodels.ExtraConfiguration{
				{
					Identifier: defaultConfigIdentifier,
					AlertmanagerConfig: `route:
  receiver: default
receivers:
  - name: default`,
				},
			},
		}, nil)
		ft := featuremgmt.WithFeatures(featuremgmt.FlagAlertingImportAlertmanagerAPI)
		srv, _, _ := createConvertPrometheusSrv(t, withAlertmanager(mockAM), withFeatureToggles(ft))

		rc := createRequestCtx()
		response := srv.RouteConvertPrometheusGetAlertmanagerConfig(rc)

		require.Equal(t, http.StatusOK, response.Status())
		mockAM.AssertExpectations(t)
	})

	t.Run("with empty config identifier header should use default identifier", func(t *testing.T) {
		mockAM := &mockAlertmanager{}
		mockAM.On("GetAlertmanagerConfiguration", mock.Anything, orgID, false).Return(apimodels.GettableUserConfig{
			ExtraConfigs: []apimodels.ExtraConfiguration{
				{
					Identifier: defaultConfigIdentifier,
					AlertmanagerConfig: `route:
  receiver: default
receivers:
  - name: default`,
				},
			},
		}, nil)
		ft := featuremgmt.WithFeatures(featuremgmt.FlagAlertingImportAlertmanagerAPI)
		srv, _, _ := createConvertPrometheusSrv(t, withAlertmanager(mockAM), withFeatureToggles(ft))

		rc := createRequestCtx()
		rc.Req.Header.Set(configIdentifierHeader, "")
		response := srv.RouteConvertPrometheusGetAlertmanagerConfig(rc)

		require.Equal(t, http.StatusOK, response.Status())
		mockAM.AssertExpectations(t)
	})

	t.Run("should return config when it is found", func(t *testing.T) {
		mockAM := &mockAlertmanager{}
		ft := featuremgmt.WithFeatures(featuremgmt.FlagAlertingImportAlertmanagerAPI)
		srv, _, _ := createConvertPrometheusSrv(t, withAlertmanager(mockAM), withFeatureToggles(ft))

		// Create a config with secrets to check that they will be hided in the response.
		expectedConfig := apimodels.GettableUserConfig{
			ExtraConfigs: []apimodels.ExtraConfiguration{
				{
					Identifier: identifier,
					TemplateFiles: map[string]string{
						"test.tmpl": "{{ define \"test\" }}Hello{{ end }}",
					},
					AlertmanagerConfig: `route:
  receiver: webhook
receivers:
  - name: webhook
    webhook_configs:
      - url: "http://localhost/webhook"
        http_config:
          bearer_token: "some-token"
`,
				},
			},
		}

		mockAM.On("GetAlertmanagerConfiguration", mock.Anything, int64(1), false).Return(expectedConfig, nil).Once()

		rc := createRequestCtx()
		rc.Req.Header.Set(configIdentifierHeader, identifier)
		response := srv.RouteConvertPrometheusGetAlertmanagerConfig(rc)

		require.Equal(t, http.StatusOK, response.Status())

		expectedResponse := `alertmanager_config: |
  route:
      receiver: webhook
      continue: false
  receivers:
      - name: webhook
        webhook_configs:
          - send_resolved: true
            http_config:
              authorization:
                  type: Bearer
                  credentials: <secret>
              follow_redirects: true
              enable_http2: true
            url: <secret>
            url_file: ""
            max_alerts: 0
            timeout: 0s
  templates: []
template_files:
  test.tmpl: '{{ define "test" }}Hello{{ end }}'`

		require.YAMLEq(t, expectedResponse, string(response.Body()))
		mockAM.AssertExpectations(t)
	})

	t.Run("when config not found should return 404", func(t *testing.T) {
		mockAM := &mockAlertmanager{}
		ft := featuremgmt.WithFeatures(featuremgmt.FlagAlertingImportAlertmanagerAPI)
		srv, _, _ := createConvertPrometheusSrv(t, withAlertmanager(mockAM), withFeatureToggles(ft))

		expectedConfig := apimodels.GettableUserConfig{
			ExtraConfigs: []apimodels.ExtraConfiguration{
				{
					Identifier: "other-config",
					TemplateFiles: map[string]string{
						"test.tmpl": "{{ define \"test\" }}Hello{{ end }}",
					},
					AlertmanagerConfig: `route:
  receiver: default
receivers:
  - name: default`,
				},
			},
		}

		mockAM.On("GetAlertmanagerConfiguration", mock.Anything, orgID, false).Return(expectedConfig, nil).Once()

		rc := createRequestCtx()
		rc.Req.Header.Set(configIdentifierHeader, identifier)
		response := srv.RouteConvertPrometheusGetAlertmanagerConfig(rc)

		require.Equal(t, http.StatusNotFound, response.Status())
		mockAM.AssertExpectations(t)
	})

	t.Run("should return error when GetAlertmanagerConfiguration fails", func(t *testing.T) {
		mockAM := &mockAlertmanager{}
		ft := featuremgmt.WithFeatures(featuremgmt.FlagAlertingImportAlertmanagerAPI)
		srv, _, _ := createConvertPrometheusSrv(t, withAlertmanager(mockAM), withFeatureToggles(ft))

		mockAM.On("GetAlertmanagerConfiguration", mock.Anything, orgID, false).Return(apimodels.GettableUserConfig{}, errors.New("config error")).Once()

		rc := createRequestCtx()
		rc.Req.Header.Set(configIdentifierHeader, identifier)
		response := srv.RouteConvertPrometheusGetAlertmanagerConfig(rc)

		require.Equal(t, http.StatusInternalServerError, response.Status())
		mockAM.AssertExpectations(t)
	})
}

func TestParseMergeMatchersHeader(t *testing.T) {
	testCases := []struct {
		name             string
		headerValue      string
		expectedError    bool
		expectedMatchers amconfig.Matchers
	}{
		{
			name:          "empty header should return error",
			headerValue:   "",
			expectedError: true,
		},
		{
			name:          "single matcher should parse correctly",
			headerValue:   "env=prod",
			expectedError: false,
			expectedMatchers: amconfig.Matchers{
				{Type: labels.MatchEqual, Name: "env", Value: "prod"},
			},
		},
		{
			name:          "multiple matchers should be parsed correctly",
			headerValue:   "env=prod,team=alerting",
			expectedError: false,
			expectedMatchers: amconfig.Matchers{
				{Type: labels.MatchEqual, Name: "env", Value: "prod"},
				{Type: labels.MatchEqual, Name: "team", Value: "alerting"},
			},
		},
		{
			name:          "matchers with spaces should be parsed correctly",
			headerValue:   " env = prod , team = alerting ",
			expectedError: false,
			expectedMatchers: amconfig.Matchers{
				{Type: labels.MatchEqual, Name: "env", Value: "prod"},
				{Type: labels.MatchEqual, Name: "team", Value: "alerting"},
			},
		},
		{
			name:          "invalid format without equals should return error",
			headerValue:   "env:prod",
			expectedError: true,
		},
		{
			name:          "empty key should return error",
			headerValue:   "=prod",
			expectedError: true,
		},
		{
			name:          "empty value should return error",
			headerValue:   "env=",
			expectedError: true,
		},
		{
			name:          "missing value should return error",
			headerValue:   "env",
			expectedError: true,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			rc := createRequestCtx()
			rc.Req.Header.Set(mergeMatchersHeader, tc.headerValue)

			matchers, err := parseMergeMatchersHeader(rc)

			if tc.expectedError {
				require.Error(t, err)
			} else {
				require.NoError(t, err)
				require.ElementsMatch(t, tc.expectedMatchers, matchers)
			}
		})
	}
}

func TestParseConfigIdentifierHeader(t *testing.T) {
	testCases := []struct {
		name          string
		headerValue   string
		expectedValue string
		expectedError bool
	}{
		{
			name:          "valid identifier should parse correctly",
			headerValue:   "test-config",
			expectedValue: "test-config",
			expectedError: false,
		},
		{
			name:          "identifier with spaces should be trimmed",
			headerValue:   "  test-config  ",
			expectedValue: "test-config",
			expectedError: false,
		},
		{
			name:          "empty identifier should return the default value",
			headerValue:   "",
			expectedValue: defaultConfigIdentifier,
		},
		{
			name:          "whitespace only identifier should return the default value",
			headerValue:   "   ",
			expectedValue: defaultConfigIdentifier,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			rc := createRequestCtx()
			rc.Req.Header.Set(configIdentifierHeader, tc.headerValue)

			identifier := parseConfigIdentifierHeader(rc)
			require.Equal(t, tc.expectedValue, identifier)
		})
	}
}

func TestFormatMergeMatchers(t *testing.T) {
	t.Run("empty matchers should return empty string", func(t *testing.T) {
		result := formatMergeMatchers(nil)
		require.Equal(t, "", result)
	})

	t.Run("single matcher should format correctly", func(t *testing.T) {
		matchers := amconfig.Matchers{
			&labels.Matcher{
				Type:  labels.MatchEqual,
				Name:  "env",
				Value: "prod",
			},
		}
		result := formatMergeMatchers(matchers)
		require.Equal(t, "env=prod", result)
	})

	t.Run("multiple matchers should format correctly", func(t *testing.T) {
		matchers := amconfig.Matchers{
			&labels.Matcher{
				Type:  labels.MatchEqual,
				Name:  "env",
				Value: "prod",
			},
			&labels.Matcher{
				Type:  labels.MatchEqual,
				Name:  "team",
				Value: "backend",
			},
		}
		result := formatMergeMatchers(matchers)
		require.Equal(t, "env=prod,team=backend", result)
	})
}

func TestRouteConvertPrometheusDeleteAlertmanagerConfig(t *testing.T) {
	const identifier = "test-config"
	const orgID = int64(1)

	mockAM := &mockAlertmanager{}
	ft := featuremgmt.WithFeatures(featuremgmt.FlagAlertingImportAlertmanagerAPI)
	srv, _, _ := createConvertPrometheusSrv(t, withAlertmanager(mockAM), withFeatureToggles(ft))

	t.Run("should parse identifier header and call DeleteExtraConfiguration", func(t *testing.T) {
		mockAM.On("DeleteExtraConfiguration", mock.Anything, orgID, identifier).Return(nil).Once()

		rc := createRequestCtx()
		rc.Req.Header.Set(configIdentifierHeader, identifier)

		response := srv.RouteConvertPrometheusDeleteAlertmanagerConfig(rc)

		require.Equal(t, http.StatusAccepted, response.Status())
		mockAM.AssertExpectations(t)
	})

	t.Run("should use default identifier when header is missing", func(t *testing.T) {
		mockAM.On("DeleteExtraConfiguration", mock.Anything, orgID, defaultConfigIdentifier).Return(nil).Once()
		rc := createRequestCtx()

		response := srv.RouteConvertPrometheusDeleteAlertmanagerConfig(rc)

		require.Equal(t, http.StatusAccepted, response.Status())
		mockAM.AssertExpectations(t)
	})

	t.Run("should return error when DeleteExtraConfiguration fails", func(t *testing.T) {
		mockAM.On("DeleteExtraConfiguration", mock.Anything, orgID, identifier).Return(errors.New("delete error")).Once()

		rc := createRequestCtx()
		rc.Req.Header.Set(configIdentifierHeader, identifier)

		response := srv.RouteConvertPrometheusDeleteAlertmanagerConfig(rc)

		require.Equal(t, http.StatusInternalServerError, response.Status())
		mockAM.AssertExpectations(t)
	})

	t.Run("should return not implemented when feature toggle is disabled", func(t *testing.T) {
		ft := featuremgmt.WithFeatures()
		srv, _, _ := createConvertPrometheusSrv(t, withAlertmanager(mockAM), withFeatureToggles(ft))

		rc := createRequestCtx()
		rc.Req.Header.Set(configIdentifierHeader, identifier)

		response := srv.RouteConvertPrometheusDeleteAlertmanagerConfig(rc)

		require.Equal(t, http.StatusNotImplemented, response.Status())
	})

	t.Run("should use default identifier for empty identifier header", func(t *testing.T) {
		mockAM.On("DeleteExtraConfiguration", mock.Anything, orgID, defaultConfigIdentifier).Return(nil).Once()
		rc := createRequestCtx()
		rc.Req.Header.Set(configIdentifierHeader, "")

		response := srv.RouteConvertPrometheusDeleteAlertmanagerConfig(rc)

		require.Equal(t, http.StatusAccepted, response.Status())
		mockAM.AssertExpectations(t)
	})
}
