package api

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	backend "github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/contexthandler/ctxkey"
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

// newDiagReqCtx builds a ReqContext posting body to /api/ds/diagnostics, wired into its own request
// context via ctxkey.Key{} exactly as the real ContextHandler middleware does. Returns the recorder
// backing c.Resp so a WriteTo can be inspected for headers + body.
func newDiagReqCtx(t *testing.T, body string, headers map[string]string) (*contextmodel.ReqContext, *httptest.ResponseRecorder) {
	t.Helper()
	req, err := http.NewRequest(http.MethodPost, "/api/ds/diagnostics", strings.NewReader(body))
	require.NoError(t, err)
	req.Header.Set("Content-Type", "application/json")
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	rec := httptest.NewRecorder()
	c := &contextmodel.ReqContext{
		Context: &web.Context{
			Req:  req,
			Resp: web.NewResponseWriter(req.Method, rec),
		},
		SignedInUser: &user.SignedInUser{OrgID: 1, UserUID: "u1"},
		Logger:       log.New("test"),
	}
	req = req.WithContext(context.WithValue(req.Context(), ctxkey.Key{}, c))
	c.Req = req
	return c, rec
}

// diagHARResponse is a QueryData result with a normal refID A frame plus a synthetic __har__ frame
// carrying a parseable HAR with one entry — so HasCapturedHAR is true and traffic.har is non-empty.
//
// Built fresh per call rather than shared: collectHAR consumes the capture response by deleting it
// from the map, so handing the same value to two calls would leave the second with no HAR at all.
func diagHARResponse() *backend.QueryDataResponse {
	r := backend.NewQueryDataResponse()
	r.Responses["A"] = backend.DataResponse{Frames: data.Frames{data.NewFrame("cpu", data.NewField("v", nil, []float64{1}))}}
	capture := data.NewFrame("")
	capture.Meta = &data.FrameMeta{Custom: map[string]interface{}{
		"har": `{"log":{"entries":[{"request":{"method":"GET","url":"http://x/api"},"response":{"status":200}}]}}`,
	}}
	r.Responses["__har__A"] = backend.DataResponse{Frames: data.Frames{capture}}
	return r
}

// returnFreshHARResponse stubs method to hand every call its own diagHARResponse, so a second
// dispatch can't silently observe a capture frame the first one already consumed.
func returnFreshHARResponse(fake *query.FakeQueryService, method string) {
	fake.On(method, mock.Anything, mock.Anything, mock.Anything, mock.Anything).
		Return(func(context.Context, identity.Requester, bool, dtos.MetricRequest) (*backend.QueryDataResponse, error) {
			return diagHARResponse(), nil
		})
}

func TestQueryDiagnostics_flagOff_returns404(t *testing.T) {
	setupOpenFeatureFlag(t, featuremgmt.FlagGrafanaOnDemandDiagnostics, false)
	hs := &HTTPServer{queryDataService: query.NewFakeQueryService(t)}
	c, _ := newDiagReqCtx(t, `{"queries":[{"refId":"A"}]}`, nil)
	require.Equal(t, http.StatusNotFound, hs.QueryDiagnostics(c).Status())
}

func TestQueryDiagnostics_noQueries_returns400(t *testing.T) {
	setupOpenFeatureFlag(t, featuremgmt.FlagGrafanaOnDemandDiagnostics, true)
	hs := &HTTPServer{queryDataService: query.NewFakeQueryService(t)}
	c, rec := newDiagReqCtx(t, `{"queries":[]}`, nil)

	resp := hs.QueryDiagnostics(c)
	require.Equal(t, http.StatusBadRequest, resp.Status())

	// Assert the message, not just the status: a binding failure is also a 400, so a bare status check
	// would pass even if the body never bound and the empty-queries guard was never reached.
	resp.WriteTo(c)
	require.Contains(t, rec.Body.String(), "at least one query is required")
}

func TestQueryDiagnostics_success_bundleHeadersAndSkipCache(t *testing.T) {
	setupOpenFeatureFlag(t, featuremgmt.FlagGrafanaOnDemandDiagnostics, true)
	fakeQuery := query.NewFakeQueryService(t)
	returnFreshHARResponse(fakeQuery, "QueryData")
	hs := &HTTPServer{queryDataService: fakeQuery}
	c, rec := newDiagReqCtx(t, `{"queries":[{"refId":"A","datasource":{"uid":"prom"}}]}`, nil)

	resp := hs.QueryDiagnostics(c)
	require.Equal(t, http.StatusOK, resp.Status())
	require.True(t, c.SkipQueryCache, "diagnostics must force a live query so HAR capture sees the wire")

	resp.WriteTo(c)
	require.Equal(t, "application/tar+gzip", rec.Header().Get("Content-Type"))
	require.Regexp(t, `^attachment; filename="diagnostics-\d{8}-\d{6}\.tar\.gz"$`, rec.Header().Get("Content-Disposition"))

	files := readTarGzFiles(t, rec.Body.Bytes())
	require.Contains(t, files, "querydata.json")
	require.Contains(t, string(files["traffic.har"]), "http://x/api", "the captured entry must reach traffic.har")
	// Assert on the datasource uid, not the refID: the mocked response carries refID "A" too, so a
	// `"A"` match would still pass if the handler dropped the submitted request entirely. "prom" only
	// appears in the request the client posted.
	require.Contains(t, string(files["querydata.json"]), `"uid": "prom"`, "the submitted request must be recorded")
}

// TestQueryDiagnostics_capturedTrafficWithQueryError_stillBundles covers the fall-through the
// no-capture guard exists to allow: a query that failed AFTER reaching the wire leaves captured
// traffic, and that captured failure is exactly what the bundle is for — so it must ship as a 200
// bundle with query-error.txt, not the bare 400 the no-capture path returns.
func TestQueryDiagnostics_capturedTrafficWithQueryError_stillBundles(t *testing.T) {
	setupOpenFeatureFlag(t, featuremgmt.FlagGrafanaOnDemandDiagnostics, true)
	fakeQuery := query.NewFakeQueryService(t)
	fakeQuery.On("QueryData", mock.Anything, mock.Anything, mock.Anything, mock.Anything).
		Return(func(context.Context, identity.Requester, bool, dtos.MetricRequest) (*backend.QueryDataResponse, error) {
			r := diagHARResponse()
			// Same per-refID failure as the no-capture case, but this time traffic was captured.
			r.Responses["A"] = backend.DataResponse{Error: errors.New("bad promql")}
			return r, nil
		})
	hs := &HTTPServer{queryDataService: fakeQuery}
	c, rec := newDiagReqCtx(t, `{"queries":[{"refId":"A"}]}`, nil)

	resp := hs.QueryDiagnostics(c)
	require.Equal(t, http.StatusOK, resp.Status(), "a failure that hit the wire must still ship its captured traffic")

	resp.WriteTo(c)
	files := readTarGzFiles(t, rec.Body.Bytes())
	require.Contains(t, string(files["traffic.har"]), "http://x/api")
	require.Contains(t, string(files["query-error.txt"]), "bad promql", "the failure must be recorded in the bundle")
}

func TestQueryDiagnostics_queryV2Dispatch(t *testing.T) {
	setupOpenFeatureFlag(t, featuremgmt.FlagGrafanaOnDemandDiagnostics, true)
	fakeQuery := query.NewFakeQueryService(t)
	// Only QueryDataNew is stubbed; had the handler dispatched to QueryData the mock would fail the test.
	returnFreshHARResponse(fakeQuery, "QueryDataNew")
	hs := &HTTPServer{queryDataService: fakeQuery}
	c, _ := newDiagReqCtx(t, `{"queries":[{"refId":"A"}]}`, map[string]string{"X-Query-V2": "true"})

	require.Equal(t, http.StatusOK, hs.QueryDiagnostics(c).Status())
	fakeQuery.AssertCalled(t, "QueryDataNew", mock.Anything, mock.Anything, mock.Anything, mock.Anything)
}

func TestQueryDiagnostics_noCapturePerRefIDError_returns400(t *testing.T) {
	setupOpenFeatureFlag(t, featuremgmt.FlagGrafanaOnDemandDiagnostics, true)
	fakeQuery := query.NewFakeQueryService(t)
	errResp := backend.NewQueryDataResponse()
	errResp.Responses["A"] = backend.DataResponse{Error: errors.New("bad promql")}
	fakeQuery.On("QueryData", mock.Anything, mock.Anything, mock.Anything, mock.Anything).
		Return(errResp, nil)
	hs := &HTTPServer{queryDataService: fakeQuery}
	c, _ := newDiagReqCtx(t, `{"queries":[{"refId":"A"}]}`, nil)

	// No HAR captured + a per-refID error -> bare 400, no bundle (matches QueryMetricsV2's per-refID handling).
	require.Equal(t, http.StatusBadRequest, hs.QueryDiagnostics(c).Status())
}
