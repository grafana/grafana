package api

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/expr/exprcapture"
	"github.com/grafana/grafana/pkg/infra/httpclient/harcapture"
	"github.com/grafana/grafana/pkg/services/query"
	"github.com/grafana/grafana/pkg/services/user"
)

// The seam these tests cover: a handler must attach the exprcapture buffer to the SAME context it
// hands to queryData. The expression service records stages into whatever buffer that context
// carries, so a buffer attached to the wrong context -- to ctx instead of the HAR-wrapped pctx, say --
// leaves every bundle with an empty pipeline. No unit test in pkg/expr or pkg/services/diagnostics
// would notice: both packages are correct in isolation, and the fake query service used elsewhere in
// this package doesn't care what the context holds.
//
// Only the dashboard handler is covered here: QueryDiagnostics has no test harness in this package
// (nothing invokes it -- it needs the OpenFeature gate, a ReqContext and web.Bind), so its identical
// two-line wiring is still unguarded. Worth closing when that harness lands.
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
