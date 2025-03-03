package tempo

import (
	"encoding/hex"
	"encoding/json"
	"os"
	"testing"

	//nolint:all
	"github.com/golang/protobuf/jsonpb"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/tempo/pkg/tempopb"
	v1 "github.com/grafana/tempo/pkg/tempopb/trace/v1"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestTraceToFrame(t *testing.T) {
	t.Run("should transform tempo protobuf response into dataframe", func(t *testing.T) {
		jsonResponse, err := os.Open("testData/trace.json")
		require.NoError(t, err)

		var otTrace tempopb.Trace
		err = jsonpb.Unmarshal(jsonResponse, &otTrace)
		require.NoError(t, err)

		// For some reason the trace does not have named events (probably was generated some time ago) so we just set
		// one here for testing
		origSpan := findSpan(otTrace, "7198307df9748606")
		origSpan.GetEvents()[0].Name = "test event"

		frame, err := TraceToFrame(otTrace.GetResourceSpans())
		require.NoError(t, err)

		require.Equal(t, 30, frame.Rows())
		require.ElementsMatch(t, fields, fieldNames(frame))

		bFrame := &BetterFrame{frame}
		root := rootSpan(bFrame)
		require.NotNil(t, root)

		require.Equal(t, "HTTP GET - loki_api_v1_query_range", root["operationName"])
		require.Equal(t, "loki-all", root["serviceName"])
		require.Equal(t, json.RawMessage("[{\"value\":\"loki-all\",\"key\":\"service.name\"},{\"value\":\"Jaeger-Go-2.25.0\",\"key\":\"opencensus.exporterversion\"},{\"value\":\"4d019a031941\",\"key\":\"host.hostname\"},{\"value\":\"172.18.0.6\",\"key\":\"ip\"},{\"value\":\"4b19ace06df8e4de\",\"key\":\"client-uuid\"}]"), root["serviceTags"])
		require.Equal(t, 1616072924070.497, root["startTime"])
		require.Equal(t, 8.421, root["duration"])
		require.Equal(t, json.RawMessage("null"), root["logs"])
		require.Equal(t, json.RawMessage("[{\"value\":\"const\",\"key\":\"sampler.type\"},{\"value\":true,\"key\":\"sampler.param\"},{\"value\":200,\"key\":\"http.status_code\"},{\"value\":\"GET\",\"key\":\"http.method\"},{\"value\":\"/loki/api/v1/query_range?direction=BACKWARD\\u0026limit=1000\\u0026query=%7Bcompose_project%3D%22devenv%22%7D%20%7C%3D%22trace_id%22\\u0026start=1616070921000000000\\u0026end=1616072722000000000\\u0026step=2\",\"key\":\"http.url\"},{\"value\":\"net/http\",\"key\":\"component\"},{\"value\":\"[\\\"value1\\\",\\\"value2\\\"]\",\"key\":\"arrayAttribute\"},{\"value\":\"{\\\"key1\\\":\\\"value1\\\",\\\"key2\\\":\\\"value2\\\"}\",\"key\":\"kvlistAttribute\"}]"), root["tags"])

		span := bFrame.FindRowWithValue("spanID", "7198307df9748606")

		require.Equal(t, "GetParallelChunks", span["operationName"])
		require.Equal(t, "loki-all", span["serviceName"])
		require.Equal(t, json.RawMessage("[{\"value\":\"loki-all\",\"key\":\"service.name\"},{\"value\":\"Jaeger-Go-2.25.0\",\"key\":\"opencensus.exporterversion\"},{\"value\":\"4d019a031941\",\"key\":\"host.hostname\"},{\"value\":\"172.18.0.6\",\"key\":\"ip\"},{\"value\":\"4b19ace06df8e4de\",\"key\":\"client-uuid\"}]"), span["serviceTags"])
		require.Equal(t, 1616072924072.852, span["startTime"])
		require.Equal(t, 0.094, span["duration"])
		expectedLogs := `
			[
				{
					"timestamp": 1616072924072.856,
					"name": "test event",
					"fields": [
						{
							"value": 1,
							"key": "chunks requested"
						}
					]
				},
				{
					"timestamp": 1616072924072.9448,
					"fields": [
						{
							"value": 1,
							"key": "chunks fetched"
						}
					]
				}
			]
		`
		assert.JSONEq(t, expectedLogs, string(span["logs"].(json.RawMessage)))
	})

	t.Run("should transform correct traceID", func(t *testing.T) {
		jsonResponse, err := os.Open("testData/trace.json")
		require.NoError(t, err)

		var otTrace tempopb.Trace
		err = jsonpb.Unmarshal(jsonResponse, &otTrace)
		require.NoError(t, err)

		var index int
		for _, resourceSpans := range otTrace.GetResourceSpans() {
			for _, scopeSpans := range resourceSpans.GetScopeSpans() {
				for _, span := range scopeSpans.GetSpans() {
					if index == 0 {
						span.TraceId = []byte{0, 1, 2, 3, 4, 5, 6, 7, 0, 1, 2, 3, 4, 5, 6, 7}
					}
					if index == 1 {
						span.TraceId = []byte{0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 3, 4, 5, 6, 7}
					}
					index++
				}
			}
		}

		frame, err := TraceToFrame(otTrace.GetResourceSpans())
		require.NoError(t, err)
		bFrame := &BetterFrame{frame}

		traceID128Bit := bFrame.GetRow(0)
		require.NotNil(t, traceID128Bit)
		require.Equal(t, "00010203040506070001020304050607", traceID128Bit["traceID"])

		traceID64Bit := bFrame.GetRow(1)
		require.NotNil(t, traceID64Bit)
		require.Equal(t, "0001020304050607", traceID64Bit["traceID"])
	})
}

type Row map[string]any
type BetterFrame struct {
	frame *data.Frame
}

func (f *BetterFrame) GetRow(index int) Row {
	row := f.frame.RowCopy(index)
	betterRow := make(map[string]any)
	for i, field := range row {
		betterRow[f.frame.Fields[i].Name] = field
	}

	return betterRow
}

func (f *BetterFrame) FindRow(fn func(row Row) bool) Row {
	for i := 0; i < f.frame.Rows(); i++ {
		row := f.GetRow(i)
		if fn(row) {
			return row
		}
	}

	return nil
}

func (f *BetterFrame) FindRowWithValue(fieldName string, value any) Row {
	return f.FindRow(func(row Row) bool {
		return row[fieldName] == value
	})
}

func rootSpan(frame *BetterFrame) Row {
	return frame.FindRowWithValue("parentSpanID", "0000000000000000")
}

func fieldNames(frame *data.Frame) []string {
	names := make([]string, len(frame.Fields))
	for i, f := range frame.Fields {
		names[i] = f.Name
	}

	return names
}

func findSpan(trace tempopb.Trace, spanId string) *v1.Span {
	for i := 0; i < len(trace.GetResourceSpans()); i++ {
		scope := trace.GetResourceSpans()[i].GetScopeSpans()
		for j := 0; j < len(scope); j++ {
			spans := scope[j].GetSpans()
			for k := 0; k < len(spans); k++ {
				if hex.EncodeToString(spans[k].GetSpanId()[:]) == spanId {
					return spans[k]
				}
			}
		}
	}
	return nil
}

var fields = []string{
	"traceID",
	"spanID",
	"parentSpanID",
	"operationName",
	"serviceName",
	"kind",
	"statusCode",
	"statusMessage",
	"instrumentationLibraryName",
	"instrumentationLibraryVersion",
	"traceState",
	"serviceTags",
	"startTime",
	"duration",
	"logs",
	"references",
	"tags",
}
