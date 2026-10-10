package expr

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/stretchr/testify/require"
)

type parityFixture struct {
	name   string
	inputs []data.Frames // inputs[i] is the response for refID "A", "B", ...
	// transformations is a JSON array of DataTransformerConfig.
	transformations string
	timezone        string
}

var parityStart = time.Date(2026, 1, 15, 12, 0, 0, 0, time.UTC)

func parityTimes(minutes ...int) []time.Time {
	out := make([]time.Time, len(minutes))
	for i, m := range minutes {
		out[i] = parityStart.Add(time.Duration(m) * time.Minute)
	}
	return out
}

func parityTable() *data.Frame {
	return data.NewFrame("",
		data.NewField("time", nil, parityTimes(0, 1, 2, 3)),
		data.NewField("svc", nil, []string{"api", "api", "worker", "idle"}),
		data.NewField("latency", nil, []*float64{new(100.0), new(260.0), new(40.0), nil}),
		data.NewField("requests", nil, []int64{10, 20, 5, 0}),
		data.NewField("up", nil, []bool{true, true, false, true}),
	)
}

func paritySeries(pod string, minutes []int, values []float64) *data.Frame {
	frame := data.NewFrame("",
		data.NewField("time", nil, parityTimes(minutes...)),
		data.NewField("value", data.Labels{"pod": pod, "job": "app"}, values),
	)
	frame.Meta = &data.FrameMeta{Type: data.FrameTypeTimeSeriesMulti, TypeVersion: data.FrameTypeVersion{0, 1}}
	return frame
}

func parityMultiSeries() data.Frames {
	return data.Frames{
		paritySeries("a", []int{0, 1, 2}, []float64{1, 2, 3}),
		paritySeries("b", []int{1, 2, 3}, []float64{20, 30, 40}),
	}
}

func parityFixtures() []parityFixture {
	table := func() []data.Frames { return []data.Frames{{parityTable()}} }
	series := func() []data.Frames { return []data.Frames{parityMultiSeries()} }

	nanInf := data.NewFrame("",
		data.NewField("a", nil, []float64{1, math.NaN(), 3}),
		data.NewField("b", nil, []float64{math.Inf(1), 2, math.Inf(-1)}),
	)
	bigInts := data.NewFrame("",
		data.NewField("id", nil, []int64{1 << 53, (1 << 53) + 1, 2}),
		data.NewField("name", nil, []string{"x", "y", "z"}),
	)
	nullableStrings := data.NewFrame("",
		data.NewField("svc", nil, []*string{new("api"), nil, new("api"), nil}),
		data.NewField("v", nil, []float64{1, 2, 3, 4}),
	)
	wideSeries := data.NewFrame("",
		data.NewField("time", nil, parityTimes(0, 1, 2, 3, 4, 5, 6, 7)),
		data.NewField("cpu", data.Labels{"host": "a"}, []float64{1, 5, 2, 8, 3, 9, 4, 7}),
		data.NewField("mem", data.Labels{"host": "a"}, []float64{10, 12, 11, 15, 13, 14, 12, 16}),
	)
	wideSeries.Meta = &data.FrameMeta{Type: data.FrameTypeTimeSeriesWide, TypeVersion: data.FrameTypeVersion{0, 1}}
	unicode := data.NewFrame("",
		data.NewField("name", nil, []*string{new("café"), new("日本語"), nil, new("🚀 launch"), new("plain")}),
		data.NewField("v", nil, []float64{3, 1, 5, 2, 4}),
	)
	withMeta := paritySeries("a", []int{0, 1}, []float64{1, 2})
	withMeta.Meta.ExecutedQueryString = "up{job=\"app\"}"
	withMeta.Meta.PreferredVisualization = data.VisTypeGraph
	withMeta.Meta.Custom = map[string]any{"resultType": "matrix"}
	withMeta.Meta.Notices = []data.Notice{{Severity: data.NoticeSeverityWarning, Text: "partial data"}}
	withConfig := parityTable()
	withConfig.Fields[2].Config = &data.FieldConfig{
		DisplayName: "Latency",
		Unit:        "ms",
		Decimals:    new(uint16(1)),
		Min:         new(data.ConfFloat64(0)),
		Max:         new(data.ConfFloat64(500)),
		Links:       []data.DataLink{{Title: "details", URL: "/d/abc?var-svc=${__data.fields.svc}"}},
	}

	return []parityFixture{
		{name: "calculateField-binary", inputs: table(), transformations: `[{"id":"calculateField","options":{"mode":"binary","binary":{"left":{"matcher":{"id":"byName","options":"latency"}},"operator":"*","right":{"fixed":"2"}},"alias":"double"}}]`},
		{name: "calculateField-reduceRow-nan-inf", inputs: []data.Frames{{nanInf}}, transformations: `[{"id":"calculateField","options":{"mode":"reduceRow","reduce":{"reducer":"sum"},"alias":"total"}}]`},
		{name: "concatenate", inputs: series(), transformations: `[{"id":"concatenate","options":{}}]`},
		{name: "convertFieldType-int-to-string", inputs: table(), transformations: `[{"id":"convertFieldType","options":{"conversions":[{"targetField":"requests","destinationType":"string"}]}}]`},
		{name: "convertFieldType-string-to-enum", inputs: table(), transformations: `[{"id":"convertFieldType","options":{"conversions":[{"targetField":"svc","destinationType":"enum","enumConfig":{"text":["api","worker","idle"]}}]}}]`},
		{name: "convertFrameType-to-exemplar", inputs: series(), transformations: `[{"id":"convertFrameType","options":{"targetType":"exemplar"}}]`},
		{name: "ensureColumns", inputs: series(), transformations: `[{"id":"ensureColumns","options":{}}]`},
		{name: "filterByRefId", inputs: []data.Frames{{parityTable()}, parityMultiSeries()}, transformations: `[{"id":"filterByRefId","options":{"include":"B"}}]`},
		{name: "filterByValue", inputs: table(), transformations: `[{"id":"filterByValue","options":{"filters":[{"fieldName":"latency","config":{"id":"greater","options":{"value":50}}}],"type":"include","match":"any"}}]`},
		{name: "filterFields", inputs: table(), transformations: `[{"id":"filterFields","options":{"exclude":{"id":"byName","options":"up"}}}]`},
		{name: "filterFieldsByName", inputs: table(), transformations: `[{"id":"filterFieldsByName","options":{"include":{"names":["svc","latency"]}}}]`},
		{name: "filterFrames", inputs: []data.Frames{{parityTable()}, parityMultiSeries()}, transformations: `[{"id":"filterFrames","options":{"exclude":{"id":"byRefId","options":"A"}}}]`},
		{name: "formatString", inputs: table(), transformations: `[{"id":"formatString","options":{"stringField":"svc","outputFormat":"Upper Case"}}]`},
		{name: "formatTime-option-timezone", inputs: table(), transformations: `[{"id":"formatTime","options":{"timeField":"time","outputFormat":"YYYY-MM-DD HH:mm","timezone":"America/Chicago"}}]`},
		{name: "formatTime-request-timezone", inputs: table(), timezone: "Asia/Tokyo", transformations: `[{"id":"formatTime","options":{"timeField":"time","outputFormat":"YYYY-MM-DD HH:mm"}}]`},
		{name: "groupBy", inputs: table(), transformations: `[{"id":"groupBy","options":{"fields":{"svc":{"operation":"groupby","aggregations":[]},"latency":{"operation":"aggregate","aggregations":["mean","max"]},"requests":{"operation":"aggregate","aggregations":["sum"]}}}}]`},
		{name: "groupBy-null-keys", inputs: []data.Frames{{nullableStrings}}, transformations: `[{"id":"groupBy","options":{"fields":{"svc":{"operation":"groupby","aggregations":[]},"v":{"operation":"aggregate","aggregations":["sum"]}}}}]`},
		{name: "groupToNestedTable", inputs: table(), transformations: `[{"id":"groupToNestedTable","options":{"fields":{"svc":{"operation":"groupby","aggregations":[]}}}}]`},
		{name: "groupingToMatrix", inputs: table(), transformations: `[{"id":"groupingToMatrix","options":{"columnField":"svc","rowField":"time","valueField":"latency"}}]`},
		{name: "histogram", inputs: table(), transformations: `[{"id":"histogram","options":{"bucketCount":3,"fields":{}}}]`},
		{name: "joinByField-outer-misaligned", inputs: series(), transformations: `[{"id":"joinByField","options":{"mode":"outer"}}]`},
		{name: "joinByField-inner", inputs: series(), transformations: `[{"id":"joinByField","options":{"mode":"inner"}}]`},
		{name: "labelsToFields-columns", inputs: series(), transformations: `[{"id":"labelsToFields","options":{}}]`},
		{name: "labelsToFields-rows", inputs: series(), transformations: `[{"id":"labelsToFields","options":{"mode":"rows"}}]`},
		{name: "limit", inputs: table(), transformations: `[{"id":"limit","options":{"limitField":2}}]`},
		{name: "merge", inputs: series(), transformations: `[{"id":"merge","options":{}}]`},
		{name: "noop", inputs: table(), transformations: `[{"id":"noop","options":{}}]`},
		{name: "order", inputs: table(), transformations: `[{"id":"order","options":{"indexByName":{"latency":0,"svc":1}}}]`},
		{name: "organize", inputs: table(), transformations: `[{"id":"organize","options":{"excludeByName":{"up":true},"indexByName":{"latency":0},"renameByName":{"svc":"service"}}}]`},
		{name: "reduce-series-to-rows", inputs: series(), transformations: `[{"id":"reduce","options":{"reducers":["max","mean","last"]}}]`},
		{name: "reduce-nan-inf", inputs: []data.Frames{{nanInf}}, transformations: `[{"id":"reduce","options":{"reducers":["sum","max","min","mean"]}}]`},
		{name: "rename", inputs: table(), transformations: `[{"id":"rename","options":{"renameByName":{"latency":"lat"}}}]`},
		{name: "renameByRegex", inputs: table(), transformations: `[{"id":"renameByRegex","options":{"regex":"(.*)ency","renamePattern":"$1"}}]`},
		{name: "seriesToRows", inputs: series(), transformations: `[{"id":"seriesToRows","options":{}}]`},
		{name: "sortBy-big-int64", inputs: []data.Frames{{bigInts}}, transformations: `[{"id":"sortBy","options":{"sort":[{"field":"id"}]}}]`},
		{name: "transpose", inputs: table(), transformations: `[{"id":"transpose","options":{}}]`},
		{name: "roundtrip-frame-meta", inputs: []data.Frames{{withMeta}}, transformations: `[{"id":"limit","options":{"limitField":1}}]`},
		{name: "heatmap", inputs: series(), transformations: `[{"id":"heatmap","options":{}}]`},
		{name: "joinByLabels", inputs: series(), transformations: `[{"id":"joinByLabels","options":{"value":"pod"}}]`},
		{name: "partitionByValues", inputs: table(), transformations: `[{"id":"partitionByValues","options":{"fields":["svc"],"keepFields":false}}]`},
		{name: "prepareTimeSeries-wide-to-multi", inputs: []data.Frames{{wideSeries}}, transformations: `[{"id":"prepareTimeSeries","options":{"format":"multi"}}]`},
		{name: "prepareTimeSeries-multi-to-long", inputs: series(), transformations: `[{"id":"prepareTimeSeries","options":{"format":"long"}}]`},
		{name: "smoothing", inputs: []data.Frames{{wideSeries}}, transformations: `[{"id":"smoothing","options":{"resolution":5}}]`},
		{name: "timeSeriesTable", inputs: series(), transformations: `[{"id":"timeSeriesTable","options":{}}]`},
		{name: "roundtrip-unicode-strings", inputs: []data.Frames{{unicode}}, transformations: `[{"id":"sortBy","options":{"sort":[{"field":"v"}]}}]`},
		{name: "roundtrip-unicode-nested-json", inputs: []data.Frames{{unicode}}, transformations: `[{"id":"groupToNestedTable","options":{"fields":{"name":{"operation":"groupby","aggregations":[]}}}}]`},
		{name: "roundtrip-field-config", inputs: []data.Frames{{withConfig}}, transformations: `[{"id":"sortBy","options":{"sort":[{"field":"Latency"}]}}]`},
	}
}

// TestTransformParityFixtures writes, for each fixture, the frames a browser would receive from
// the data source (input) and the frames returned by a transform expression through the sidecar
// (output). scripts/transform-sidecar/parity compares them with running the same transformations
// in-process, which is what a panel does today.
func TestTransformParityFixtures(t *testing.T) {
	url := os.Getenv("TRANSFORM_SIDECAR_URL")
	outDir := os.Getenv("TRANSFORM_PARITY_OUT")
	if url == "" || outDir == "" {
		t.Skip("TRANSFORM_SIDECAR_URL and TRANSFORM_PARITY_OUT are not set")
	}
	require.NoError(t, os.MkdirAll(outDir, 0o750))

	for _, fx := range parityFixtures() {
		t.Run(fx.name, func(t *testing.T) {
			responses := map[string]backend.DataResponse{}
			refIDs := make([]string, 0, len(fx.inputs))
			input := []*data.Frame{}
			for i, frames := range fx.inputs {
				refID := string(rune('A' + i))
				for _, frame := range frames {
					frame.RefID = refID
				}
				refIDs = append(refIDs, refID)
				responses[refID] = backend.DataResponse{Frames: frames}
				input = append(input, frames...)
			}

			inputsJSON, err := json.Marshal(refIDs)
			require.NoError(t, err)
			expression := fmt.Sprintf(`{"type": "transform", "inputs": %s, "transformations": %s, "timezone": %q}`,
				inputsJSON, fx.transformations, fx.timezone)

			// Marshal the input before the pipeline runs, in case anything downstream mutates frames.
			inputJSON, err := json.Marshal(input)
			require.NoError(t, err)

			s, req := newMockQueryService(responses, transformTestQueries(t, refIDs, expression))
			s.cfg.TransformSidecarURL = url
			s.cfg.TransformSidecarFormat = os.Getenv("TRANSFORM_SIDECAR_FORMAT") // json when empty

			record := map[string]any{
				"name":            fx.name,
				"transformations": json.RawMessage(fx.transformations),
				"timezone":        fx.timezone,
				"input":           json.RawMessage(inputJSON),
			}

			pl, err := s.BuildPipeline(t.Context(), req)
			require.NoError(t, err)
			rsp, err := s.ExecutePipeline(context.Background(), time.Now(), pl)
			require.NoError(t, err)
			if rspErr := rsp.Responses["T"].Error; rspErr != nil {
				record["error"] = rspErr.Error()
			} else {
				record["output"] = rsp.Responses["T"].Frames
			}

			raw, err := json.MarshalIndent(record, "", "  ")
			require.NoError(t, err)
			require.NoError(t, os.WriteFile(filepath.Join(outDir, fx.name+".json"), raw, 0o600))
		})
	}
}
