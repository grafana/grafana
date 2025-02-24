package api

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	prommodel "github.com/prometheus/common/model"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/datasources"
	dsfakes "github.com/grafana/grafana/pkg/services/datasources/fakes"
	"github.com/grafana/grafana/pkg/services/folder/foldertest"
	acfakes "github.com/grafana/grafana/pkg/services/ngalert/accesscontrol/fakes"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
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
		srv, _ := createConvertPrometheusSrv(t)
		rc := createRequestCtx()
		rc.Req.Header.Set(datasourceUIDHeader, "")

		response := srv.RouteConvertPrometheusPostRuleGroup(rc, "test", apimodels.PrometheusRuleGroup{})

		require.Equal(t, http.StatusBadRequest, response.Status())
		require.Contains(t, string(response.Body()), "Missing datasource UID header")
	})

	t.Run("with invalid datasource should return error", func(t *testing.T) {
		srv, _ := createConvertPrometheusSrv(t)
		rc := createRequestCtx()
		rc.Req.Header.Set(datasourceUIDHeader, "non-existing-ds")

		response := srv.RouteConvertPrometheusPostRuleGroup(rc, "test", apimodels.PrometheusRuleGroup{})

		require.Equal(t, http.StatusNotFound, response.Status())
	})

	t.Run("with rule group without evaluation interval should return 202", func(t *testing.T) {
		srv, _ := createConvertPrometheusSrv(t)
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
				srv, _ := createConvertPrometheusSrv(t)
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
				srv, _ := createConvertPrometheusSrv(t)
				rc := createRequestCtx()
				rc.Req.Header.Set(tc.headerName, tc.headerValue)

				response := srv.RouteConvertPrometheusPostRuleGroup(rc, "test", simpleGroup)
				require.Equal(t, http.StatusBadRequest, response.Status())
				require.Contains(t, string(response.Body()), tc.expectedError)
			})
		}
	})

	t.Run("with valid request should return 202", func(t *testing.T) {
		srv, _ := createConvertPrometheusSrv(t)
		rc := createRequestCtx()

		response := srv.RouteConvertPrometheusPostRuleGroup(rc, "test", simpleGroup)
		require.Equal(t, http.StatusAccepted, response.Status())
	})
}

func createConvertPrometheusSrv(t *testing.T) (*ConvertPrometheusSrv, datasources.CacheService) {
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

	return srv, dsCache
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
