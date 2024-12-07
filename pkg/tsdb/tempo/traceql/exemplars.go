package traceql

import (
	"strings"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/tempo/pkg/tempopb"
)

func transformExemplarToFrame(name string, exemplars []tempopb.Exemplar, isHistogram bool) *data.Frame {
	timeField := data.NewField("Time", nil, []time.Time{})
	valueField := data.NewField("Value", nil, []float64{})
	traceIdField := data.NewField("traceId", nil, []string{})
	traceIdField.Config = &data.FieldConfig{
		DisplayName: "Trace ID",
	}
	bucketField := data.NewField("__bucket", nil, []float64{})

	frame := &data.Frame{
		RefID: name,
		Name:  "exemplar",
		Fields: []*data.Field{
			timeField,
			valueField,
			traceIdField,
		},
		Meta: &data.FrameMeta{
			DataTopic: "annotations",
		},
	}

	if isHistogram {
		frame.Fields = append(frame.Fields, bucketField)
	}

	for _, exemplar := range exemplars {
		_, labels := transformLabelsAndGetName(exemplar.GetLabels())
		traceId := labels["trace:id"]
		if traceId != "" {
			traceId = strings.ReplaceAll(traceId, "\"", "")
		}

		frame.AppendRow(time.UnixMilli(exemplar.GetTimestampMs()), exemplar.GetValue(), traceId)

		if isHistogram {
			frame.Fields[3].Append(exemplar.GetValue())
		}
	}
	return frame
}
