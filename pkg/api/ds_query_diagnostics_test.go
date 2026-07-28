package api

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	backend "github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/httpclient/harcapture"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/contexthandler"
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

// TestQueryDiagnostics_unparseableBody_returns400 is the other half of the pair above: the two 400s
// are distinct guards with distinct messages, so pinning both is what makes either assertion mean
// something.
func TestQueryDiagnostics_unparseableBody_returns400(t *testing.T) {
	setupOpenFeatureFlag(t, featuremgmt.FlagGrafanaOnDemandDiagnostics, true)
	hs := &HTTPServer{queryDataService: query.NewFakeQueryService(t)}
	c, rec := newDiagReqCtx(t, `{"queries":`, nil)

	resp := hs.QueryDiagnostics(c)
	require.Equal(t, http.StatusBadRequest, resp.Status())

	resp.WriteTo(c)
	require.Contains(t, rec.Body.String(), "bad request data")
}

func TestQueryDiagnostics_success_bundleHeadersAndSkipCache(t *testing.T) {
	setupOpenFeatureFlag(t, featuremgmt.FlagGrafanaOnDemandDiagnostics, true)
	fakeQuery := query.NewFakeQueryService(t)
	// SkipQueryCache is sampled from INSIDE the query, not after the handler returns: the caching
	// middleware reads it off the ReqContext while the query runs, so setting the flag after dispatching
	// would leave cache bypass broken — and a post-hoc `require.True(t, c.SkipQueryCache)` would still
	// pass. Capturing the ReqContext the query actually saw also pins the handler's claim that it is the
	// same pointer c, which is what makes mutating c here take effect for this request.
	var queryReqCtx *contextmodel.ReqContext
	var skipQueryCacheDuringQuery bool
	fakeQuery.On("QueryData", mock.Anything, mock.Anything, mock.Anything, mock.Anything).
		Return(func(ctx context.Context, _ identity.Requester, _ bool, _ dtos.MetricRequest) (*backend.QueryDataResponse, error) {
			queryReqCtx = contexthandler.FromContext(ctx)
			if queryReqCtx != nil {
				skipQueryCacheDuringQuery = queryReqCtx.SkipQueryCache
			}
			return diagHARResponse(), nil
		})
	hs := &HTTPServer{queryDataService: fakeQuery}
	c, rec := newDiagReqCtx(t, `{"queries":[{"refId":"A","datasource":{"uid":"prom"}}]}`, nil)

	resp := hs.QueryDiagnostics(c)
	require.Equal(t, http.StatusOK, resp.Status())
	require.Same(t, c, queryReqCtx, "the query context must carry the same ReqContext the caching middleware reads back")
	require.True(t, skipQueryCacheDuringQuery,
		"diagnostics must force a live query BEFORE dispatching, so HAR capture sees the wire")

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

// TestQueryDiagnostics_bundlesPanelAndDashboardJSON pins the passthrough that diagnosticsRequest
// exists for: the client posts the panel and dashboard definitions it already holds so the bundle
// doesn't need a dashboard-service lookup. Nothing else asserts these two reach the archive, and
// they are handed to Build as adjacent same-typed arguments — so a swap would silently ship the
// dashboard as panel.json and vice versa. The markers are distinct per file for exactly that reason:
// a shared marker would still match with the two transposed.
func TestQueryDiagnostics_bundlesPanelAndDashboardJSON(t *testing.T) {
	setupOpenFeatureFlag(t, featuremgmt.FlagGrafanaOnDemandDiagnostics, true)
	fakeQuery := query.NewFakeQueryService(t)
	returnFreshHARResponse(fakeQuery, "QueryData")
	hs := &HTTPServer{queryDataService: fakeQuery}
	c, rec := newDiagReqCtx(t, `{
		"queries":[{"refId":"A"}],
		"panel":{"id":7,"title":"panel-marker"},
		"dashboard":{"uid":"d1","title":"dashboard-marker"}
	}`, nil)

	resp := hs.QueryDiagnostics(c)
	require.Equal(t, http.StatusOK, resp.Status())

	resp.WriteTo(c)
	files := readTarGzFiles(t, rec.Body.Bytes())
	require.Contains(t, string(files["panel.json"]), "panel-marker", "the posted panel must land in panel.json")
	require.Contains(t, string(files["dashboard.json"]), "dashboard-marker", "the posted dashboard must land in dashboard.json")
	require.NotContains(t, string(files["panel.json"]), "dashboard-marker", "panel.json must not carry the dashboard")
	require.NotContains(t, string(files["dashboard.json"]), "panel-marker", "dashboard.json must not carry the panel")
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

// TestQueryDiagnostics_capturesInProcessTraffic pins the capture wiring for CORE datasources — the
// only capture path that works today, since collectHAR's __har__ frame path stays inert until the
// SDK-side capture middleware ships (see its doc comment). The handler must hand queryData the
// harcapture-wrapped context; passing the bare request context instead leaves the buffer empty and
// traffic.har silently dropped, which no test that supplies capture via a __har__ frame can see.
func TestQueryDiagnostics_capturesInProcessTraffic(t *testing.T) {
	setupOpenFeatureFlag(t, featuremgmt.FlagGrafanaOnDemandDiagnostics, true)
	fakeQuery := query.NewFakeQueryService(t)
	fakeQuery.On("QueryData", mock.Anything, mock.Anything, mock.Anything, mock.Anything).
		Return(func(ctx context.Context, _ identity.Requester, _ bool, _ dtos.MetricRequest) (*backend.QueryDataResponse, error) {
			// Stands in for the datasource's HTTP round trip: the real capture middleware finds the
			// buffer on the query context exactly this way.
			buf := harcapture.FromContext(ctx)
			require.NotNil(t, buf, "queryData must receive the harcapture-wrapped context")
			httpReq, err := http.NewRequest(http.MethodGet, "http://prom.example/api/v1/query?query=up", nil)
			require.NoError(t, err)
			buf.AddEntry(httpReq, &http.Response{StatusCode: http.StatusOK, Header: http.Header{}}, nil, time.Now(), time.Millisecond)

			r := backend.NewQueryDataResponse()
			r.Responses["A"] = backend.DataResponse{Frames: data.Frames{data.NewFrame("cpu")}}
			return r, nil
		})
	hs := &HTTPServer{queryDataService: fakeQuery}
	c, rec := newDiagReqCtx(t, `{"queries":[{"refId":"A"}]}`, nil)

	resp := hs.QueryDiagnostics(c)
	require.Equal(t, http.StatusOK, resp.Status())

	resp.WriteTo(c)
	files := readTarGzFiles(t, rec.Body.Bytes())
	require.Contains(t, string(files["traffic.har"]), "prom.example/api/v1/query",
		"the in-process buffer's entry must reach traffic.har")
}

// TestQueryDiagnostics_externalPluginSwallowedError_bundlesIt covers the second half of the handler's
// errors.Join: an externalized (gRPC) plugin returns NO per-refId error — its top-level failure is
// stashed on the __har__ frame so the captured traffic survives the wire (see
// diagnostics.PluginCaptureError). Folding in only ResponseError drops it from query-error.txt.
func TestQueryDiagnostics_externalPluginSwallowedError_bundlesIt(t *testing.T) {
	setupOpenFeatureFlag(t, featuremgmt.FlagGrafanaOnDemandDiagnostics, true)
	fakeQuery := query.NewFakeQueryService(t)
	fakeQuery.On("QueryData", mock.Anything, mock.Anything, mock.Anything, mock.Anything).
		Return(func(context.Context, identity.Requester, bool, dtos.MetricRequest) (*backend.QueryDataResponse, error) {
			r := diagHARResponse()
			r.Responses["__har__A"].Frames[0].Meta.Custom.(map[string]interface{})["queryError"] = "dial tcp: connection refused"
			return r, nil
		})
	hs := &HTTPServer{queryDataService: fakeQuery}
	c, rec := newDiagReqCtx(t, `{"queries":[{"refId":"A"}]}`, nil)

	resp := hs.QueryDiagnostics(c)
	require.Equal(t, http.StatusOK, resp.Status())

	resp.WriteTo(c)
	files := readTarGzFiles(t, rec.Body.Bytes())
	require.Contains(t, string(files["query-error.txt"]), "connection refused",
		"an external plugin's swallowed error must reach query-error.txt")
}

// TestQueryDiagnostics_queryV2Dispatch pins the header-driven dispatch. The handler compares
// X-Query-V2 against exactly "true", mirroring QueryMetricsV2, so the negative case is pinned too:
// loosening the check to any non-empty value would hand Query V2's per-query time ranges to a client
// that explicitly sent "false", and captured traffic would stop matching the panel.
//
// Only the expected method is stubbed per case; a dispatch to the other one fails the test on an
// unexpected mock call.
func TestQueryDiagnostics_queryV2Dispatch(t *testing.T) {
	for _, tc := range []struct {
		name       string
		header     string
		wantMethod string
	}{
		{name: `"true" dispatches to QueryDataNew`, header: "true", wantMethod: "QueryDataNew"},
		{name: "any other value keeps QueryData", header: "false", wantMethod: "QueryData"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			setupOpenFeatureFlag(t, featuremgmt.FlagGrafanaOnDemandDiagnostics, true)
			fakeQuery := query.NewFakeQueryService(t)
			returnFreshHARResponse(fakeQuery, tc.wantMethod)
			hs := &HTTPServer{queryDataService: fakeQuery}
			c, _ := newDiagReqCtx(t, `{"queries":[{"refId":"A"}]}`, map[string]string{"X-Query-V2": tc.header})

			require.Equal(t, http.StatusOK, hs.QueryDiagnostics(c).Status())
			fakeQuery.AssertCalled(t, tc.wantMethod, mock.Anything, mock.Anything, mock.Anything, mock.Anything)
		})
	}
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

func TestQueryDiagnostics_bundlesPanelData(t *testing.T) {
	setupOpenFeatureFlag(t, featuremgmt.FlagGrafanaOnDemandDiagnostics, true)
	fakeQuery := query.NewFakeQueryService(t)
	returnFreshHARResponse(fakeQuery, "QueryData")
	hs := &HTTPServer{queryDataService: fakeQuery}
	c, rec := newDiagReqCtx(t, `{
		"queries":[{"refId":"A"}],
		"panelData":{"version":1,"frames":[{"schema":{"name":"frontend-marker"}}]}
	}`, nil)

	resp := hs.QueryDiagnostics(c)
	require.Equal(t, http.StatusOK, resp.Status())

	resp.WriteTo(c)
	files := readTarGzFiles(t, rec.Body.Bytes())
	// The frontend's frames land in their own artifact, so they can be diffed against querydata.json
	// (the backend's response) to localise data lost inside the plugin's frontend code.
	require.Contains(t, string(files["paneldata.json"]), "frontend-marker")
	require.NotContains(t, string(files["querydata.json"]), "frontend-marker")
}
