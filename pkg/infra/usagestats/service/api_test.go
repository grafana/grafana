package service

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path"
	"testing"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"
	"github.com/stretchr/testify/require"
)

func TestApi_getUsageStats(t *testing.T) {
	type getUsageStatsTestCase struct {
		desc           string
		expectedStatus int
		expectedCall   bool
		IsGrafanaAdmin bool
		enabled        bool
	}
	tests := []getUsageStatsTestCase{
		{
			desc:           "expect usage stats",
			enabled:        true,
			IsGrafanaAdmin: true,
			expectedCall:   true,
			expectedStatus: 200,
		},
		{
			desc:           "expect usage stat preview still there after disabling",
			enabled:        false,
			IsGrafanaAdmin: true,
			expectedCall:   true,
			expectedStatus: 200,
		},
		{
			desc:           "expect http status 403 when not admin",
			enabled:        false,
			IsGrafanaAdmin: false,
			expectedCall:   false,
			expectedStatus: 403,
		},
	}

	uss := createService(t, setting.Cfg{})
	uss.registerAPIEndpoints()
	getSystemStatsWasCalled := false

	uss.Bus.AddHandler(func(ctx context.Context, query *models.GetSystemStatsQuery) error {
		query.Result = &models.SystemStats{}
		getSystemStatsWasCalled = true
		return nil
	})

	uss.Bus.AddHandler(func(ctx context.Context, query *models.GetDataSourceStatsQuery) error {
		query.Result = []*models.DataSourceStats{}
		return nil
	})

	uss.Bus.AddHandler(func(ctx context.Context, query *models.GetDataSourcesByTypeQuery) error {
		query.Result = []*models.DataSource{}
		return nil
	})

	uss.Bus.AddHandler(func(ctx context.Context, query *models.GetDataSourceAccessStatsQuery) error {
		query.Result = []*models.DataSourceAccessStats{}
		return nil
	})

	uss.Bus.AddHandler(func(ctx context.Context, query *models.GetAlertNotifierUsageStatsQuery) error {
		query.Result = []*models.NotifierUsageStats{}
		return nil
	})

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			getSystemStatsWasCalled = false
			uss.Cfg.ReportingEnabled = tt.enabled
			server := setupTestServer(t, &models.SignedInUser{OrgId: 1, IsGrafanaAdmin: tt.IsGrafanaAdmin}, uss)

			usageStats, recorder := getUsageStats(t, server)
			require.Equal(t, tt.expectedCall, getSystemStatsWasCalled)
			require.Equal(t, tt.expectedStatus, recorder.Code)

			if tt.expectedStatus == http.StatusOK {
				require.NotNil(t, usageStats)
			}
		})
	}
}

func getUsageStats(t *testing.T, server *web.Mux) (*models.SystemStats, *httptest.ResponseRecorder) {
	req, err := http.NewRequest(http.MethodGet, "/api/admin/usage-report-preview", http.NoBody)
	require.NoError(t, err)
	recorder := httptest.NewRecorder()
	server.ServeHTTP(recorder, req)

	var usageStats *models.SystemStats
	if recorder.Code == http.StatusOK {
		require.NoError(t, json.NewDecoder(recorder.Body).Decode(&usageStats))
	}
	return usageStats, recorder
}

func setupTestServer(t *testing.T, user *models.SignedInUser, service *UsageStats) *web.Mux {
	server := web.New()
	server.UseMiddleware(web.Renderer(path.Join(setting.StaticRootPath, "views"), "[[", "]]"))
	server.Use(contextProvider(&testContext{user}))
	service.RouteRegister.Register(server)
	return server
}

type testContext struct {
	user *models.SignedInUser
}

func contextProvider(tc *testContext) web.Handler {
	return func(c *web.Context) {
		signedIn := tc.user != nil
		reqCtx := &models.ReqContext{
			Context:      c,
			SignedInUser: tc.user,
			IsSignedIn:   signedIn,
			SkipCache:    true,
			Logger:       log.New("test"),
		}
		c.Map(reqCtx)
	}
}
