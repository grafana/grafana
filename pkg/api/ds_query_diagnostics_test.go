package api

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/infra/log"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/query"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/web"
)

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

func TestDiagnosticsRequestIncludeLogsDefaultsOff(t *testing.T) {
	var absent diagnosticsRequest
	require.NoError(t, json.Unmarshal([]byte(`{"queries":[]}`), &absent))
	require.False(t, absent.IncludeLogs)

	var enabled diagnosticsRequest
	require.NoError(t, json.Unmarshal([]byte(`{"queries":[],"includeLogs":true}`), &enabled))
	require.True(t, enabled.IncludeLogs)
}

func TestQueryDiagnosticsIncludesOptedInFilteredAndWindowLogs(t *testing.T) {
	setupOpenFeatureFlag(t, featuremgmt.FlagGrafanaOnDemandDiagnostics, true)
	require.NoError(t, log.SetupConsoleLogger("info"))

	fakeQuery := query.NewFakeQueryService(t)
	fakeQuery.On("QueryData", mock.Anything, mock.Anything, mock.Anything, mock.Anything).
		Run(func(_ mock.Arguments) {
			logger := log.New("diagnostics-capture-test")
			logger.Debug("target line", "dsUID", "prom")
			logger.Debug("decoy line", "dsUID", "other")
		}).
		Return(backend.NewQueryDataResponse(), nil).
		Twice()
	fakeQuery.On("QueryData", mock.Anything, mock.Anything, mock.Anything, mock.Anything).
		Run(func(_ mock.Arguments) {
			log.New("diagnostics-capture-test").Debug("preflight failure", "dsUID", "prom")
		}).
		Return(nil, errors.New("query failed before HTTP capture")).
		Once()
	fakeQuery.On("QueryData", mock.Anything, mock.Anything, mock.Anything, mock.Anything).
		Return(nil, errors.New("silent query failure before HTTP capture")).
		Once()
	typedPreflightFailures := []error{
		datasources.ErrDataSourceAccessDenied,
		datasources.ErrDataSourceNotFound,
	}
	for _, queryErr := range typedPreflightFailures {
		fakeQuery.On("QueryData", mock.Anything, mock.Anything, mock.Anything, mock.Anything).
			Return(nil, queryErr).
			Once()
	}
	hs := &HTTPServer{queryDataService: fakeQuery}

	request := func(includeLogs bool) response.Response {
		body := fmt.Sprintf(`{"from":"now-1h","to":"now","includeLogs":%t,"queries":[{"refId":"A","datasource":{"uid":"prom"}}]}`, includeLogs)
		req, err := http.NewRequest(http.MethodPost, "/api/ds/diagnostics", strings.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		ctx := &contextmodel.ReqContext{
			Context: &web.Context{
				Req:  req,
				Resp: web.NewResponseWriter(req.Method, httptest.NewRecorder()),
			},
			SignedInUser: &user.SignedInUser{OrgID: 1, UserUID: "u1"},
			Logger:       log.New("test"),
		}
		ctx.Req = req
		return hs.QueryDiagnostics(ctx)
	}

	withoutLogs := request(false)
	require.Equal(t, http.StatusOK, withoutLogs.Status())
	withoutFiles := readTarGzFiles(t, withoutLogs.Body())
	require.NotContains(t, withoutFiles, "query.log")
	require.NotContains(t, withoutFiles, "server-window.log")

	withLogs := request(true)
	require.Equal(t, http.StatusOK, withLogs.Status())
	files := readTarGzFiles(t, withLogs.Body())
	require.Contains(t, files, "query.log")
	require.Contains(t, string(files["query.log"]), "target line")
	require.NotContains(t, string(files["query.log"]), "decoy line")
	require.Contains(t, files, "server-window.log")
	require.Contains(t, string(files["server-window.log"]), "target line")
	require.Contains(t, string(files["server-window.log"]), "decoy line")

	failedWithLogs := request(true)
	require.Equal(t, http.StatusOK, failedWithLogs.Status())
	failedFiles := readTarGzFiles(t, failedWithLogs.Body())
	require.Contains(t, string(failedFiles["query-error.txt"]), "query failed before HTTP capture")
	require.Contains(t, string(failedFiles["query.log"]), "preflight failure")
	require.Contains(t, string(failedFiles["server-window.log"]), "preflight failure")

	silentFailureWithLogsEnabled := request(true)
	require.Equal(t, http.StatusOK, silentFailureWithLogsEnabled.Status())
	silentFailureFiles := readTarGzFiles(t, silentFailureWithLogsEnabled.Body())
	require.Contains(t, string(silentFailureFiles["query-error.txt"]), "silent query failure before HTTP capture")

	for _, queryErr := range typedPreflightFailures {
		t.Run(queryErr.Error(), func(t *testing.T) {
			failureWithLogsEnabled := request(true)
			require.Equal(t, http.StatusOK, failureWithLogsEnabled.Status())
			failureFiles := readTarGzFiles(t, failureWithLogsEnabled.Body())
			require.Contains(t, string(failureFiles["query-error.txt"]), queryErr.Error())
		})
	}
}
