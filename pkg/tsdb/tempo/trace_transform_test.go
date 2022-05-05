package tempo

import (
	"io/ioutil"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/stretchr/testify/require"
	otlp "go.opentelemetry.io/collector/model/otlp"
)

func TestTraceToFrame(t *testing.T) {
	t.Run("should transform tempo protobuf response into dataframe", func(t *testing.T) {
		// For what ever reason you cannot easily create pdata.Traces for the TraceToFrame from something more readable
		// like json. You could tediously create the structures manually using all the setters for everything or use
		// https://github.com/grafana/tempo/tree/master/pkg/tempopb to create the protobuf structs from something like
		// json. At the moment just saving some real tempo proto response into file and loading was the easiest and
		// as my patience was diminished trying to figure this out, I say it's good enough.
		proto, err := ioutil.ReadFile("testData/tempo_proto_response")
		require.NoError(t, err)

		otTrace, err := otlp.NewProtobufTracesUnmarshaler().UnmarshalTraces(proto)
		require.NoError(t, err)

		frame, err := TraceToFrame(otTrace)
		require.NoError(t, err)

		require.Equal(t, 30, frame.Rows())
		require.ElementsMatch(t, fields, fieldNames(frame))

		bFrame := &BetterFrame{frame}
		root := rootSpan(bFrame)
		require.NotNil(t, root)

		require.Equal(t, "HTTP GET - loki_api_v1_query_range", root["operationName"])
		require.Equal(t, "loki-all", root["serviceName"])
		require.Equal(t, "[{\"value\":\"loki-all\",\"key\":\"service.name\"},{\"value\":\"Jaeger-Go-2.25.0\",\"key\":\"opencensus.exporterversion\"},{\"value\":\"4d019a031941\",\"key\":\"host.hostname\"},{\"value\":\"172.18.0.6\",\"key\":\"ip\"},{\"value\":\"4b19ace06df8e4de\",\"key\":\"client-uuid\"}]", root["serviceTags"])
		require.Equal(t, 1616072924070.497, root["startTime"])
		require.Equal(t, 8.421, root["duration"])
		require.Equal(t, "", root["logs"])
		require.Equal(t, "[{\"value\":\"const\",\"key\":\"sampler.type\"},{\"value\":true,\"key\":\"sampler.param\"},{\"value\":200,\"key\":\"http.status_code\"},{\"value\":\"GET\",\"key\":\"http.method\"},{\"value\":\"/loki/api/v1/query_range?direction=BACKWARD\\u0026limit=1000\\u0026query=%7Bcompose_project%3D%22devenv%22%7D%20%7C%3D%22traceID%22\\u0026start=1616070921000000000\\u0026end=1616072722000000000\\u0026step=2\",\"key\":\"http.url\"},{\"value\":\"net/http\",\"key\":\"component\"},{\"value\":\"server\",\"key\":\"span.kind\"},{\"value\":0,\"key\":\"status.code\"}]", root["tags"])

		span := bFrame.FindRowWithValue("spanID", "7198307df9748606")

		require.Equal(t, "GetParallelChunks", span["operationName"])
		require.Equal(t, "loki-all", span["serviceName"])
		require.Equal(t, "[{\"value\":\"loki-all\",\"key\":\"service.name\"},{\"value\":\"Jaeger-Go-2.25.0\",\"key\":\"opencensus.exporterversion\"},{\"value\":\"4d019a031941\",\"key\":\"host.hostname\"},{\"value\":\"172.18.0.6\",\"key\":\"ip\"},{\"value\":\"4b19ace06df8e4de\",\"key\":\"client-uuid\"}]", span["serviceTags"])
		require.Equal(t, 1616072924072.852, span["startTime"])
		require.Equal(t, 0.094, span["duration"])
		require.Equal(t, "[{\"timestamp\":1616072924072.856,\"fields\":[{\"value\":1,\"key\":\"chunks requested\"}]},{\"timestamp\":1616072924072.9448,\"fields\":[{\"value\":1,\"key\":\"chunks fetched\"}]}]", span["logs"])
		require.Equal(t, "[{\"value\":0,\"key\":\"status.code\"}]", span["tags"])
	})
}

type Row map[string]interface{}
type BetterFrame struct {
	frame *data.Frame
}

func (f *BetterFrame) GetRow(index int) Row {
	row := f.frame.RowCopy(index)
	betterRow := make(map[string]interface{})
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

func (f *BetterFrame) FindRowWithValue(fieldName string, value interface{}) Row {
	return f.FindRow(func(row Row) bool {
		return row[fieldName] == value
	})
}

func rootSpan(frame *BetterFrame) Row {
	return frame.FindRowWithValue("parentSpanID", "")
}

func fieldNames(frame *data.Frame) []string {
	var names []string
	for _, f := range frame.Fields {
		names = append(names, f.Name)
	}
	return names
}

var fields = []string{
	"traceID",
	"spanID",
	"parentSpanID",
	"operationName",
	"serviceName",
	"serviceTags",
	"startTime",
	"duration",
	"logs",
	"references",
	"tags",
}
