package diagnostics

import (
	"encoding/json"
	"strings"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/expr/exprcapture"
	"github.com/grafana/grafana/pkg/infra/httpclient/harcapture"
)

// parseArtifact unmarshals a querydata.json blob into the artifact struct for assertions.
func parseArtifact(t *testing.T, raw []byte) queryDataArtifact {
	t.Helper()
	var a queryDataArtifact
	require.NoError(t, json.Unmarshal(raw, &a))
	return a
}

// twoStagePipeline is A (datasource) -> B (reduce), the DAG shared by the tests below.
func twoStagePipeline() []exprcapture.Stage {
	return []exprcapture.Stage{
		{RefID: "A", Type: "datasource", Command: "prometheus"},
		{RefID: "B", Type: "expression", Command: "reduce", InputRefIDs: []string{"A"}},
	}
}

// pipelineResponse is what the expression service returns for twoStagePipeline: every node under its
// own refID, which is where a stage's output lives.
func pipelineResponse(aValues []float64) *backend.QueryDataResponse {
	aFrame := data.NewFrame("A", data.NewField("value", data.Labels{"host": "a"}, aValues))
	aFrame.RefID = "A"
	bFrame := data.NewFrame("B", data.NewField("B", nil, []float64{1}))
	bFrame.RefID = "B"
	return &backend.QueryDataResponse{Responses: backend.Responses{
		"A": {Frames: data.Frames{aFrame}},
		"B": {Frames: data.Frames{bFrame}},
	}}
}

func stageByRefID(t *testing.T, stages []queryDataPipelineStage, refID string) queryDataPipelineStage {
	t.Helper()
	for _, s := range stages {
		if s.RefID == refID {
			return s
		}
	}
	t.Fatalf("no stage with refId %q in %v", refID, stages)
	return queryDataPipelineStage{}
}

func TestBundler_Build_recordsExpressionStages(t *testing.T) {
	// A (datasource) -> B ($A reduced/last, expression). The captured stages record the DAG edge
	// B<-A and each node's kind; the outputs they refer to live under "response", keyed by the same
	// refIds.
	resp := pipelineResponse([]float64{1})

	blob, err := NewBundler().Build(BundleInput{Resp: resp, HARBuffer: &harcapture.Buffer{}, ExpressionStages: twoStagePipeline()})
	require.NoError(t, err)

	files := readTarGz(t, blob)
	require.Contains(t, files, "querydata.json")

	a := parseArtifact(t, files["querydata.json"])
	require.Len(t, a.Pipeline, 2)

	require.Equal(t, "A", a.Pipeline[0].RefID)
	require.Equal(t, "datasource", a.Pipeline[0].Type)
	require.Equal(t, "prometheus", a.Pipeline[0].Command)
	require.Empty(t, a.Pipeline[0].InputRefIDs)

	require.Equal(t, "B", a.Pipeline[1].RefID)
	require.Equal(t, "expression", a.Pipeline[1].Type)
	require.Equal(t, "reduce", a.Pipeline[1].Command)
	require.Equal(t, []string{"A"}, a.Pipeline[1].InputRefIDs, "the DAG edge B<-A is recorded")

	// Every stage's refId resolves to a response entry -- that join is what gives a stage its output.
	var response struct {
		Results map[string]json.RawMessage `json:"results"`
	}
	require.NoError(t, json.Unmarshal(a.Response, &response))
	for _, stage := range a.Pipeline {
		require.Contains(t, response.Results, stage.RefID, "stage %s has no response entry to join to", stage.RefID)
	}

	require.False(t, a.Truncated)
	require.False(t, a.PipelineOmitted)
}

func TestMarshalQueryDataArtifact_stagesDoNotDuplicateResponse(t *testing.T) {
	// The expression service returns every node under its own refID, so "response" already carries
	// each stage's output frames. Capturing the DAG must not re-serialize them: doing so doubles
	// querydata.json and halves the effective size budget.
	values := make([]float64, 4096)
	for i := range values {
		values[i] = float64(i)
	}
	values[0] = 1234.5 // a distinctive value to count occurrences of
	resp := pipelineResponse(values)

	withoutStages, _, err := marshalQueryDataArtifactWithLimit(nil, resp, nil, maxQueryDataArtifactBytes)
	require.NoError(t, err)
	withStages, _, err := marshalQueryDataArtifactWithLimit(nil, resp, twoStagePipeline(), maxQueryDataArtifactBytes)
	require.NoError(t, err)

	require.Less(t, len(withStages), len(withoutStages)+1024,
		"the DAG is bounded by node count; it must not scale with frame values (got %d vs %d bytes)",
		len(withStages), len(withoutStages))
	require.Equal(t, 1, strings.Count(string(withStages), "1234.5"),
		"frame values must appear exactly once, under \"response\"")

	a := parseArtifact(t, withStages)
	require.Len(t, a.Pipeline, 2, "the DAG is still recorded")
}

func TestMarshalQueryDataArtifact_stagesSurviveResponseTruncation(t *testing.T) {
	// Over budget the response collapses to its per-refID summary, but the DAG is small and nothing
	// else in the bundle records it, so it survives intact.
	values := make([]float64, 4096)
	for i := range values {
		values[i] = float64(i)
	}
	resp := pipelineResponse(values)

	raw, truncated, err := marshalQueryDataArtifactWithLimit(nil, resp, twoStagePipeline(), 4096)
	require.NoError(t, err)
	require.True(t, truncated)

	a := parseArtifact(t, raw)
	require.True(t, a.Truncated)
	require.True(t, a.ResponseOmitted, "the frame values are dropped over budget")
	require.Empty(t, a.Response)
	require.NotEmpty(t, a.ResponseSummary, "per-refID row/field counts stand in for the values")

	require.False(t, a.PipelineOmitted)
	require.Len(t, a.Pipeline, 2, "the DAG survives the response's degradation")
	b := stageByRefID(t, a.Pipeline, "B")
	require.Equal(t, "reduce", b.Command)
	require.Equal(t, []string{"A"}, b.InputRefIDs)
	require.NotContains(t, string(raw), "4095", "individual frame values are not present when summarized")
}

func TestFitQueryDataArtifact_dropsStagesAtTheFloor(t *testing.T) {
	// A budget too small even for the response summary walks the ladder to the bottom. The stages go
	// after the summary -- last of the variable-size content -- and leave a marker behind.
	resp := pipelineResponse([]float64{1, 2, 3})

	raw, _, err := marshalQueryDataArtifactWithLimit(nil, resp, twoStagePipeline(), minQueryDataArtifactBytes)
	require.NoError(t, err)
	require.LessOrEqual(t, len(raw), minQueryDataArtifactBytes)

	a := parseArtifact(t, raw)
	require.Empty(t, a.Pipeline)
	require.True(t, a.PipelineOmitted, "the marker records that a DAG was captured and dropped")
	require.False(t, a.PipelineErrorsOmitted, "pipelineOmitted subsumes the error marker")
	require.Empty(t, a.ResponseSummary)
	require.True(t, a.ResponseOmitted)
}

func TestFitQueryDataArtifact_dropsStageErrorsBeforeTheStages(t *testing.T) {
	// Stage errors are the only free-form text on a stage, and responseSummary[refId].error carries the
	// same string, so on a budget too small for both they go first -- losing the error text but keeping
	// the DAG, which nothing else in the bundle records.
	stages := []exprcapture.Stage{
		{RefID: "A", Type: "datasource", Command: "prometheus", Error: errStub(strings.Repeat("x", 600))},
		{RefID: "B", Type: "expression", Command: "reduce", InputRefIDs: []string{"A"}, Error: errStub(strings.Repeat("y", 600))},
	}
	resp := pipelineResponse([]float64{1, 2, 3})

	// Sized between "the DAG with its error text" and "the DAG alone".
	raw, truncated, err := marshalQueryDataArtifactWithLimit(nil, resp, stages, 700)
	require.NoError(t, err)
	require.True(t, truncated)

	a := parseArtifact(t, raw)
	require.Len(t, a.Pipeline, 2, "the DAG outlives its own error text")
	require.True(t, a.PipelineErrorsOmitted, "the marker records that error text was dropped")
	require.False(t, a.PipelineOmitted)

	b := stageByRefID(t, a.Pipeline, "B")
	require.Equal(t, "reduce", b.Command)
	require.Equal(t, []string{"A"}, b.InputRefIDs, "the DAG edge survives")
	for _, s := range a.Pipeline {
		require.Empty(t, s.Error, "stage %s kept its error text", s.RefID)
	}
	require.NotContains(t, string(raw), "xxxxx")
}

func TestFitQueryDataArtifact_clearingStageErrorsDoesNotMutateCaller(t *testing.T) {
	// fitQueryDataArtifact takes the artifact by value, but its Pipeline slice shares a backing array
	// with the caller's, so the error-dropping rung must clone before clearing.
	stages := buildPipelineStages([]exprcapture.Stage{
		{RefID: "A", Type: "datasource", Error: errStub(strings.Repeat("x", 600))},
	})
	require.NotEmpty(t, stages[0].Error)

	_, err := fitQueryDataArtifact(queryDataArtifact{Version: queryDataArtifactVersion, Pipeline: stages}, nil, 200)
	require.NoError(t, err)
	require.NotEmpty(t, stages[0].Error, "the caller's stages were cleared in place")
}

func TestMarshalQueryDataArtifact_recordsStageError(t *testing.T) {
	// A stage's error is duplicated from its response entry on purpose, so "which stage failed" is
	// answerable from the DAG alone.
	stages := []exprcapture.Stage{
		{RefID: "A", Type: "datasource", Error: errStub("upstream 500")},
		{RefID: "B", Type: "expression", Command: "math", InputRefIDs: []string{"A"}, Error: errStub("dependency error")},
	}
	raw, err := marshalQueryDataArtifact(nil, nil, stages)
	require.NoError(t, err)

	a := parseArtifact(t, raw)
	require.Len(t, a.Pipeline, 2)
	require.Equal(t, "upstream 500", a.Pipeline[0].Error)
	require.Equal(t, "dependency error", a.Pipeline[1].Error)
}

func TestBuildDashboard_recordsExpressionStagesWithoutResponse(t *testing.T) {
	// A panel that captured a DAG but produced neither a response nor a serializable request must
	// still get a querydata.json -- the per-panel gate matches Build's.
	panels := []DashboardPanel{{
		ID:               1,
		Title:            "expressions",
		ExpressionStages: twoStagePipeline(),
	}}

	blob, err := NewBundler().BuildDashboard(nil, panels)
	require.NoError(t, err)

	files := readTarGz(t, blob)
	var found string
	for name := range files {
		if strings.HasSuffix(name, "/querydata.json") {
			found = name
		}
	}
	require.NotEmpty(t, found, "the panel's captured stages are recorded, got files %v", files)

	a := parseArtifact(t, files[found])
	require.Len(t, a.Pipeline, 2)
}

type errStub string

func (e errStub) Error() string { return string(e) }

var _ error = errStub("")
