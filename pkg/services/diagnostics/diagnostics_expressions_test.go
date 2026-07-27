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

func stageOutputFrameNames(t *testing.T, stage queryDataExpressionStage) []string {
	t.Helper()
	var dr struct {
		Frames []struct {
			Schema struct {
				Name string `json:"name"`
			} `json:"schema"`
		} `json:"frames"`
	}
	require.NoError(t, json.Unmarshal(stage.Output, &dr))
	names := make([]string, 0, len(dr.Frames))
	for _, f := range dr.Frames {
		names = append(names, f.Schema.Name)
	}
	return names
}

func TestBundler_Build_recordsExpressionStages(t *testing.T) {
	// A (datasource, 2 series) -> B ($A reduced/last, expression). The captured stages record the DAG
	// edge B<-A and each node's output so a reader can localize which stage changed the data.
	dsFrame := data.NewFrame("A",
		data.NewField("value", data.Labels{"host": "a"}, []float64{1}),
	)
	bFrame := data.NewFrame("B", data.NewField("B", nil, []float64{1}))
	bFrame.RefID = "B"

	stages := []exprcapture.Stage{
		{RefID: "A", Type: "datasource", Command: "prometheus", Frames: data.Frames{dsFrame}},
		{RefID: "B", Type: "expression", Command: "reduce", InputRefIDs: []string{"A"}, Frames: data.Frames{bFrame}},
	}

	blob, err := NewBundler().Build(nil, &harcapture.Buffer{}, nil, nil, nil, stages, nil, nil)
	require.NoError(t, err)

	files := readTarGz(t, blob)
	require.Contains(t, files, "querydata.json")

	a := parseArtifact(t, files["querydata.json"])
	require.Len(t, a.Expressions, 2)

	require.Equal(t, "A", a.Expressions[0].RefID)
	require.Equal(t, "datasource", a.Expressions[0].Type)
	require.Empty(t, a.Expressions[0].InputRefIDs)

	require.Equal(t, "B", a.Expressions[1].RefID)
	require.Equal(t, "expression", a.Expressions[1].Type)
	require.Equal(t, "reduce", a.Expressions[1].Command)
	require.Equal(t, []string{"A"}, a.Expressions[1].InputRefIDs, "the DAG edge B<-A is recorded")

	require.NotEmpty(t, a.Expressions[0].Output, "each stage carries its output frames")
	require.NotEmpty(t, a.Expressions[1].Output)
	require.False(t, a.Truncated)
	require.False(t, a.ExpressionsOmitted)
}

func TestBuildExpressionStages_excludesCaptureFrames(t *testing.T) {
	// A datasource node's output frames may include the synthetic __har__ carrier frame; it must not
	// leak into the expression-stage output.
	realFrame := data.NewFrame("real", data.NewField("value", nil, []float64{1}))
	harFrame := data.NewFrame("__har__test")
	harFrame.RefID = "__har__test"

	stages := []exprcapture.Stage{
		{RefID: "A", Type: "datasource", Frames: data.Frames{realFrame, harFrame}},
	}

	out, err := buildExpressionStages(stages)
	require.NoError(t, err)
	require.Len(t, out, 1)

	names := stageOutputFrameNames(t, out[0])
	require.Contains(t, names, "real")
	require.NotContains(t, names, "__har__test", "capture carrier frames are filtered out")
}

func TestMarshalQueryDataArtifact_expressionStagesDegradeToSummary(t *testing.T) {
	// A stage carrying a large frame that pushes the artifact over budget must degrade to a per-stage
	// summary (row/field counts) with the frame values omitted, not silently drop the stage.
	values := make([]float64, 4096)
	for i := range values {
		values[i] = float64(i)
	}
	big := data.NewFrame("big", data.NewField("value", nil, values))
	stages := []exprcapture.Stage{
		{RefID: "A", Type: "datasource", Frames: data.Frames{big}},
		{RefID: "B", Type: "expression", Command: "reduce", InputRefIDs: []string{"A"}, Frames: data.Frames{
			data.NewFrame("B", data.NewField("B", nil, []float64{1})),
		}},
	}

	// A budget below the full frame values but above the compact per-stage summary forces the middle
	// (summary) degrade tier.
	raw, truncated, err := marshalQueryDataArtifactWithLimit(nil, nil, stages, 4096)
	require.NoError(t, err)
	require.True(t, truncated)

	a := parseArtifact(t, raw)
	require.True(t, a.Truncated)
	require.True(t, a.ExpressionsOmitted, "full expression frames are omitted over budget")
	require.Empty(t, a.Expressions, "no full-frame expressions when truncated")
	require.Len(t, a.ExpressionsSummary, 2, "each stage still appears in the summary")

	// The summary preserves the DAG edge and node metadata even without frame values.
	var bSummary queryDataExpressionStage
	for _, s := range a.ExpressionsSummary {
		if s.RefID == "B" {
			bSummary = s
		}
	}
	require.Equal(t, "reduce", bSummary.Command)
	require.Equal(t, []string{"A"}, bSummary.InputRefIDs)
	require.NotEmpty(t, bSummary.Output, "the summary lists per-frame row/field counts")
	require.NotContains(t, string(raw), "\"4095\"", "individual large-frame values are not present when summarized")
}

func TestMarshalQueryDataArtifact_recordsStageError(t *testing.T) {
	stages := []exprcapture.Stage{
		{RefID: "A", Type: "datasource", Error: errStub("upstream 500")},
		{RefID: "B", Type: "expression", Command: "math", InputRefIDs: []string{"A"}, Error: errStub("dependency error")},
	}
	raw, err := marshalQueryDataArtifact(nil, nil, stages)
	require.NoError(t, err)

	a := parseArtifact(t, raw)
	require.Len(t, a.Expressions, 2)
	require.Equal(t, "upstream 500", a.Expressions[0].Error)
	require.Equal(t, "dependency error", a.Expressions[1].Error)
	require.True(t, strings.Contains(string(a.Expressions[1].Output), "dependency error"),
		"the stage output object also carries the error")
}

type errStub string

func (e errStub) Error() string { return string(e) }

var _ error = errStub("")

// ensure backend import is used even if assertions above change.
var _ = backend.NewQueryDataResponse
