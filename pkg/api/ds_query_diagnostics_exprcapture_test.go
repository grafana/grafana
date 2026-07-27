package api

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/expr/exprcapture"
	"github.com/grafana/grafana/pkg/infra/httpclient/harcapture"
	"github.com/grafana/grafana/pkg/infra/log"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/query"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/web"
)

// The seam these tests cover: a handler must attach the exprcapture buffer to the SAME context it
// hands to queryData. The expression service records stages into whatever buffer that context
// carries, so a buffer attached to the wrong context -- to ctx instead of the HAR-wrapped pctx, say --
// leaves every bundle with an empty pipeline. No unit test in pkg/expr or pkg/services/diagnostics
// would notice: both packages are correct in isolation, and the fake query service used elsewhere in
// this package doesn't care what the context holds.
//
// Both handlers are covered: QueryDiagnostics (single panel) and buildDashboardDiagnosticsArchive
// (per panel). They wire the two buffers up independently, so neither one's tests protect the other.
//
// recordTwoStages stands in for the expression service: it records into the buffer it finds in ctx,
// or fails the test if there is none.
//
// It also asserts the HAR buffer is still reachable. The wiring is two nested WithCapture calls, so
// the likely slip is chaining the second off the ORIGINAL ctx rather than the HAR-wrapped one --
// which leaves expression capture working and silently empties traffic.har. Asserting only the
// exprcapture buffer would pass straight through that.
func recordTwoStages(t *testing.T, ctx context.Context) *exprcapture.Buffer {
	t.Helper()
	buf := exprcapture.FromContext(ctx)
	require.NotNil(t, buf, "the context passed to queryData carries no exprcapture buffer")
	require.NotNil(t, harcapture.FromContext(ctx),
		"attaching the exprcapture buffer dropped the HAR buffer from the context handed to queryData")
	buf.Record([]exprcapture.Stage{
		{RefID: "A", Type: "datasource", Command: "prometheus"},
		{RefID: "B", Type: "expression", Command: "reduce", InputRefIDs: []string{"A"}},
	})
	return buf
}

// recordTwoStagesAndTraffic records a stage pair into ctx's exprcapture buffer AND one HTTP exchange
// into its harcapture buffer. Recording through both makes the resulting bundle prove the seam
// end-to-end: querydata.json's pipeline and traffic.har can only both be present if the two buffers
// the handler hands to Build are the same two the query saw in its context.
func recordTwoStagesAndTraffic(t *testing.T, ctx context.Context) {
	t.Helper()
	recordTwoStages(t, ctx)
	harcapture.FromContext(ctx).AddEntry(
		httptest.NewRequest(http.MethodGet, "http://ds.example/api/v1/query?query=up", nil),
		&http.Response{StatusCode: http.StatusOK, Header: http.Header{}, Body: http.NoBody},
		nil, time.Unix(0, 0), time.Millisecond,
	)
}

// diagnosticsReqContext builds the ReqContext QueryDiagnostics binds its request off. The body must
// carry at least one query or the handler short-circuits with 400 before any capture happens.
func diagnosticsReqContext(t *testing.T, queryV2 bool) *contextmodel.ReqContext {
	t.Helper()
	body := `{"from":"now-1h","to":"now","queries":[{"refId":"A","datasource":{"uid":"prom"}}],` +
		`"panel":{"id":7,"targets":[{"refId":"A","hide":true},{"refId":"B"}]}}`
	req, err := http.NewRequest(http.MethodPost, "/api/ds/diagnostics", strings.NewReader(body))
	require.NoError(t, err)
	req.Header.Set("Content-Type", "application/json")
	if queryV2 {
		req.Header.Set("X-Query-V2", "true")
	}
	return &contextmodel.ReqContext{
		Context: &web.Context{
			Req:  req,
			Resp: web.NewResponseWriter(req.Method, httptest.NewRecorder()),
		},
		SignedInUser: &user.SignedInUser{OrgID: 1, UserUID: "u1"},
		Logger:       log.New("test"),
	}
}

// TestQueryDiagnostics_capturesPipelineIntoBundle covers the single-panel handler's half of the seam.
// Both dispatch branches are exercised: the handler picks QueryData or QueryDataNew off the X-Query-V2
// header, and each is a separate call site that has to be handed captureCtx rather than the bare ctx.
func TestQueryDiagnostics_capturesPipelineIntoBundle(t *testing.T) {
	setupOpenFeatureFlag(t, featuremgmt.FlagGrafanaOnDemandDiagnostics, true)

	for _, tc := range []struct {
		name     string
		queryV2  bool
		method   string
		unwanted string
	}{
		{name: "v1 dispatch", queryV2: false, method: "QueryData", unwanted: "QueryDataNew"},
		{name: "v2 dispatch", queryV2: true, method: "QueryDataNew", unwanted: "QueryData"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			fakeQuery := query.NewFakeQueryService(t)
			fakeQuery.On(tc.method, mock.Anything, mock.Anything, mock.Anything, mock.Anything).
				Return(func(ctx context.Context, _ identity.Requester, _ bool, _ dtos.MetricRequest) (*backend.QueryDataResponse, error) {
					recordTwoStagesAndTraffic(t, ctx)
					return backend.NewQueryDataResponse(), nil
				})
			hs := &HTTPServer{queryDataService: fakeQuery}

			c := diagnosticsReqContext(t, tc.queryV2)
			resp := hs.QueryDiagnostics(c)
			require.Equal(t, http.StatusOK, resp.Status())
			fakeQuery.AssertNotCalled(t, tc.unwanted, mock.Anything, mock.Anything, mock.Anything, mock.Anything)

			// The handler forces a live query: a cache hit returns without a datasource round trip, so
			// capture would run on nothing and both artifacts below would be empty.
			require.True(t, c.SkipQueryCache, "diagnostics must bypass the query-result cache")

			files := readTarGzFiles(t, resp.Body())
			require.Contains(t, files, "traffic.har",
				"the HAR buffer handed to Build is not the one the query recorded into")

			require.Contains(t, files, "querydata.json")
			var artifact struct {
				Pipeline []struct {
					RefID       string   `json:"refId"`
					Type        string   `json:"type"`
					Command     string   `json:"command"`
					InputRefIDs []string `json:"inputRefIds"`
				} `json:"pipeline"`
			}
			require.NoError(t, json.Unmarshal(files["querydata.json"], &artifact))
			require.Len(t, artifact.Pipeline, 2, "querydata.json recorded no pipeline")
			require.Equal(t, "A", artifact.Pipeline[0].RefID)
			require.Equal(t, "datasource", artifact.Pipeline[0].Type)
			require.Equal(t, "reduce", artifact.Pipeline[1].Command)
			require.Equal(t, []string{"A"}, artifact.Pipeline[1].InputRefIDs,
				"the DAG edge B<-A reached the artifact")

			// panel.json still carries each target's hide flag, which is what lets a reader tell which
			// captured stages the panel actually drew now that hidden refIds stay in the response.
			require.Contains(t, files, "panel.json")
			require.Contains(t, string(files["panel.json"]), `"hide": true`)
		})
	}
}

func TestBuildDashboardDiagnosticsArchive_capturesPipelinePerPanel(t *testing.T) {
	var seen []*exprcapture.Buffer
	fakeQuery := query.NewFakeQueryService(t)
	fakeQuery.On("QueryData", mock.Anything, mock.Anything, mock.Anything, mock.Anything).
		Return(func(ctx context.Context, _ identity.Requester, _ bool, _ dtos.MetricRequest) (*backend.QueryDataResponse, error) {
			seen = append(seen, recordTwoStages(t, ctx))
			return backend.NewQueryDataResponse(), nil
		})
	hs := &HTTPServer{queryDataService: fakeQuery}

	panel := func(id int64, title string) panelDiagnosticsSpec {
		return panelDiagnosticsSpec{
			ID:    id,
			Title: title,
			MetricRequest: dtos.MetricRequest{
				Queries: []*simplejson.Json{simplejson.NewFromAny(map[string]any{"refId": "A"})},
			},
		}
	}
	reqDTO := dashboardDiagnosticsRequest{Panels: []panelDiagnosticsSpec{panel(1, "one"), panel(2, "two")}}

	archive, err := hs.buildDashboardDiagnosticsArchive(context.Background(), &user.SignedInUser{OrgID: 1, UserUID: "u1"}, false, false, reqDTO, "job-pipeline")
	require.NoError(t, err)

	require.Len(t, seen, 2)
	require.NotSame(t, seen[0], seen[1], "each panel must capture into its own buffer, or panels would pool stages")

	files := readTarGzFiles(t, archive)
	for _, dir := range []string{"panels/1-one", "panels/2-two"} {
		name := dir + "/querydata.json"
		require.Contains(t, files, name)

		var artifact struct {
			Pipeline []struct {
				RefID       string   `json:"refId"`
				Type        string   `json:"type"`
				Command     string   `json:"command"`
				InputRefIDs []string `json:"inputRefIds"`
			} `json:"pipeline"`
		}
		require.NoError(t, json.Unmarshal(files[name], &artifact))
		require.Len(t, artifact.Pipeline, 2, "%s recorded no pipeline", name)
		require.Equal(t, "A", artifact.Pipeline[0].RefID)
		require.Equal(t, "datasource", artifact.Pipeline[0].Type)
		require.Equal(t, "reduce", artifact.Pipeline[1].Command)
		require.Equal(t, []string{"A"}, artifact.Pipeline[1].InputRefIDs, "the DAG edge B<-A reached the artifact")
	}
}

// TestBuildDashboardDiagnosticsArchive_skippedPanelCapturesNothing pins the other half of the
// per-panel contract: a non-data panel is never executed, so it must not inherit a neighbour's DAG.
func TestBuildDashboardDiagnosticsArchive_skippedPanelCapturesNothing(t *testing.T) {
	fakeQuery := query.NewFakeQueryService(t)
	fakeQuery.On("QueryData", mock.Anything, mock.Anything, mock.Anything, mock.Anything).
		Return(func(ctx context.Context, _ identity.Requester, _ bool, _ dtos.MetricRequest) (*backend.QueryDataResponse, error) {
			recordTwoStages(t, ctx)
			return backend.NewQueryDataResponse(), nil
		})
	hs := &HTTPServer{queryDataService: fakeQuery}

	reqDTO := dashboardDiagnosticsRequest{Panels: []panelDiagnosticsSpec{
		{
			ID:    1,
			Title: "with queries",
			MetricRequest: dtos.MetricRequest{
				Queries: []*simplejson.Json{simplejson.NewFromAny(map[string]any{"refId": "A"})},
			},
		},
		{ID: 2, Title: "text panel"}, // no queries -> skipped, never executed
	}}

	archive, err := hs.buildDashboardDiagnosticsArchive(context.Background(), &user.SignedInUser{OrgID: 1, UserUID: "u1"}, false, false, reqDTO, "job-skipped")
	require.NoError(t, err)

	files := readTarGzFiles(t, archive)
	require.Contains(t, files, "panels/1-with-queries/querydata.json")
	for name := range files {
		require.NotContains(t, name, "2-text-panel", "a skipped panel must produce no query-data artifact")
	}
}
