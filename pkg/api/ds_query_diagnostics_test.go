package api

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	backend "github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/kvstore"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/usagestats"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/diagnostics"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/query"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/web"
)

func TestQueryDiagnosticsRecordsSuccessfulRun(t *testing.T) {
	setupOpenFeatureFlag(t, featuremgmt.FlagGrafanaOnDemandDiagnostics, true)

	fakeQuery := query.NewFakeQueryService(t)
	fakeQuery.On("QueryData", mock.Anything, mock.Anything, mock.Anything, mock.Anything).
		Return(backend.NewQueryDataResponse(), nil)
	usage := &usagestats.UsageStatsMock{T: t}
	metrics := newTestDiagnosticsMetrics(t, usage)
	hs := &HTTPServer{queryDataService: fakeQuery, diagnosticsMetrics: metrics}

	body := `{"from":"now-1h","to":"now","queries":[{"refId":"A","datasource":{"uid":"prom"}}]}`
	req, err := http.NewRequest(http.MethodPost, "/api/ds/diagnostics", strings.NewReader(body))
	require.NoError(t, err)
	req.Header.Set("Content-Type", "application/json")
	c := &contextmodel.ReqContext{
		Context: &web.Context{
			Req:  req,
			Resp: web.NewResponseWriter(req.Method, httptest.NewRecorder()),
		},
		SignedInUser: &user.SignedInUser{OrgID: 1, UserUID: "u1"},
		Logger:       log.New("test"),
	}

	resp := hs.QueryDiagnostics(c)
	require.Equal(t, http.StatusOK, resp.Status())
	report, err := usage.GetUsageReport(req.Context())
	require.NoError(t, err)
	require.Equal(t, int64(1), report.Metrics["stats.ds_diagnostics.panel_runs.count"])
}

func TestQueryDiagnosticsRecordsFailedRun(t *testing.T) {
	setupOpenFeatureFlag(t, featuremgmt.FlagGrafanaOnDemandDiagnostics, true)

	fakeQuery := query.NewFakeQueryService(t)
	fakeQuery.On("QueryData", mock.Anything, mock.Anything, mock.Anything, mock.Anything).
		Return(nil, errors.New("query failed"))
	usage := &usagestats.UsageStatsMock{T: t}
	metrics := newTestDiagnosticsMetrics(t, usage)
	hs := &HTTPServer{queryDataService: fakeQuery, diagnosticsMetrics: metrics}

	body := `{"from":"now-1h","to":"now","queries":[{"refId":"A","datasource":{"uid":"prom"}}]}`
	req, err := http.NewRequest(http.MethodPost, "/api/ds/diagnostics", strings.NewReader(body))
	require.NoError(t, err)
	req.Header.Set("Content-Type", "application/json")
	c := &contextmodel.ReqContext{
		Context:      &web.Context{Req: req, Resp: web.NewResponseWriter(req.Method, httptest.NewRecorder())},
		SignedInUser: &user.SignedInUser{OrgID: 1, UserUID: "u1"},
		Logger:       log.New("test"),
	}

	resp := hs.QueryDiagnostics(c)
	require.Equal(t, http.StatusInternalServerError, resp.Status())
	report, err := usage.GetUsageReport(req.Context())
	require.NoError(t, err)
	require.Equal(t, int64(1), report.Metrics["stats.ds_diagnostics.panel_runs.count"])
	require.Equal(t, int64(1), report.Metrics["stats.ds_diagnostics.panel_errors.count"])
}

func TestQueryDiagnosticsDoesNotCountRejectedInput(t *testing.T) {
	setupOpenFeatureFlag(t, featuremgmt.FlagGrafanaOnDemandDiagnostics, true)
	usage := &usagestats.UsageStatsMock{T: t}
	hs := &HTTPServer{diagnosticsMetrics: newTestDiagnosticsMetrics(t, usage)}

	req, err := http.NewRequest(http.MethodPost, "/api/ds/diagnostics", strings.NewReader(`{"queries":[]}`))
	require.NoError(t, err)
	req.Header.Set("Content-Type", "application/json")
	c := &contextmodel.ReqContext{
		Context:      &web.Context{Req: req, Resp: web.NewResponseWriter(req.Method, httptest.NewRecorder())},
		SignedInUser: &user.SignedInUser{OrgID: 1, UserUID: "u1"},
		Logger:       log.New("test"),
	}

	resp := hs.QueryDiagnostics(c)
	require.Equal(t, http.StatusBadRequest, resp.Status())
	report, err := usage.GetUsageReport(req.Context())
	require.NoError(t, err)
	require.Equal(t, int64(0), report.Metrics["stats.ds_diagnostics.panel_runs.count"])
}

func newTestDiagnosticsMetrics(t *testing.T, usage usagestats.Service) *diagnostics.Metrics {
	t.Helper()
	sqlStore := db.InitTestDB(t)
	require.NoError(t, sqlStore.WithDbSession(context.Background(), func(session *db.Session) error {
		_, err := session.Where("namespace = ?", "datasource-diagnostics").Delete(&kvstore.Item{})
		return err
	}))
	return diagnostics.NewMetrics(sqlStore, usage, prometheus.NewPedanticRegistry())
}

// TestDiagnosticsNoCaptureError guards the status mapping used when a query fails and no HAR was
// captured: a per-refId (bad-query) failure must surface as 400 like QueryMetricsV2, NOT 500, while
// top-level errors keep their typed status.
func TestDiagnosticsNoCaptureError(t *testing.T) {
	hs := &HTTPServer{}

	t.Run("per-refId failure is a client error (400), not 500", func(t *testing.T) {
		r := hs.diagnosticsNoCaptureError(nil, errors.New("bad promql"))
		require.NotNil(t, r)
		require.Equal(t, http.StatusBadRequest, r.Status())
	})

	t.Run("generic top-level error is 500", func(t *testing.T) {
		r := hs.diagnosticsNoCaptureError(errors.New("boom"), nil)
		require.Equal(t, http.StatusInternalServerError, r.Status())
	})

	t.Run("typed top-level errors keep their status", func(t *testing.T) {
		require.Equal(t, http.StatusForbidden,
			hs.diagnosticsNoCaptureError(datasources.ErrDataSourceAccessDenied, nil).Status())
		require.Equal(t, http.StatusNotFound,
			hs.diagnosticsNoCaptureError(datasources.ErrDataSourceNotFound, nil).Status())
	})

	t.Run("top-level error takes precedence over per-refId", func(t *testing.T) {
		r := hs.diagnosticsNoCaptureError(errors.New("boom"), errors.New("bad promql"))
		require.Equal(t, http.StatusInternalServerError, r.Status())
	})

	t.Run("no failure proceeds to bundle assembly (nil)", func(t *testing.T) {
		require.Nil(t, hs.diagnosticsNoCaptureError(nil, nil))
	})
}
