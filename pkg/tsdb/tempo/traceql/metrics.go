package traceql

import (
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/tempo/pkg/tempopb"
	v1 "github.com/grafana/tempo/pkg/tempopb/common/v1"
)

func TransformMetricsResponse(resp tempopb.QueryRangeResponse) []*data.Frame {
	var frames []*data.Frame
	var exemplarFrames []*data.Frame
	for _, series := range resp.Series {
		labels := make(data.Labels)
		for _, label := range series.Labels {
			labels[label.GetKey()] = metricsValueToString(label.GetValue())
		}

		name := ""
		if len(series.Labels) > 0 {
			if len(series.Labels) == 1 {
				name = metricsValueToString(series.Labels[0].GetValue())
			} else {
				var labelStrings []string
				for key, val := range labels {
					labelStrings = append(labelStrings, fmt.Sprintf("%s=%s", key, val))
				}
				name = fmt.Sprintf("{%s}", strings.Join(labelStrings, ", "))
			}
		}

		valueField := data.NewField(name, labels, []float64{})
		valueField.Config = &data.FieldConfig{
			DisplayName: name,
		}

		timeField := data.NewField("time", nil, []time.Time{})

		frame := &data.Frame{
			RefID: name,
			Name:  name,
			Fields: []*data.Field{
				timeField,
				valueField,
			},
			Meta: &data.FrameMeta{
				PreferredVisualization: data.VisTypeGraph,
			},
		}

		for _, sample := range series.Samples {
			frame.AppendRow(time.UnixMilli(sample.GetTimestampMs()), sample.GetValue())
		}

		exFrame := transformExemplarToFrame(name, series.Exemplars)
		exemplarFrames = append(exemplarFrames, exFrame)

		frames = append(frames, frame)
	}
	return append(frames, exemplarFrames...)
}

func transformExemplarToFrame(name string, exemplars []tempopb.Exemplar) *data.Frame {
	timeField := data.NewField("Time", nil, []time.Time{})
	valueField := data.NewField("Value", nil, []float64{})
	traceIdField := data.NewField("traceId", nil, []string{})

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

	for _, exemplar := range exemplars {
		labels := make(data.Labels)
		for _, label := range exemplar.Labels {
			labels[label.GetKey()] = metricsValueToString(label.GetValue())
		}
		frame.AppendRow(time.UnixMilli(exemplar.GetTimestampMs()), exemplar.GetValue(), labels["trace:id"])
	}
	return frame
}

func metricsValueToString(value *v1.AnyValue) string {
	switch value.GetValue().(type) {
	case *v1.AnyValue_DoubleValue:
		return strconv.FormatFloat(value.GetDoubleValue(), 'f', -1, 64)
	case *v1.AnyValue_IntValue:
		return strconv.FormatInt(value.GetIntValue(), 10)
	case *v1.AnyValue_StringValue:
		return fmt.Sprintf("\"%s\"", value.GetStringValue())
	case *v1.AnyValue_BoolValue:
		return strconv.FormatBool(value.GetBoolValue())
	}
	return ""
}
