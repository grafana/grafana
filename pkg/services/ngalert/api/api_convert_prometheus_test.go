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

func createConvertPrometheusSrv(t *testing.T) (*ConvertPrometheusSrv, datasources.CacheService, *fakes.RuleStore, *foldertest.FakeService) {
	t.Helper()

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
		fakes.NewFakeProvisioningStore(),
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
