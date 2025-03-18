package traceql

import (
	"fmt"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/tsdb/tempo/kinds/dataquery"
	"github.com/grafana/tempo/pkg/tempopb"
	v1 "github.com/grafana/tempo/pkg/tempopb/common/v1"
)

func TransformMetricsResponse(query *dataquery.TempoQuery, resp tempopb.QueryRangeResponse) []*data.Frame {
	// prealloc frames
	frames := make([]*data.Frame, len(resp.Series))
	var exemplarFrames []*data.Frame

	for i, series := range resp.Series {
		name, labels := transformLabelsAndGetName(series.Labels)

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

		isHistogram := isHistogramQuery(*query.Query)
		if isHistogram {
			frame.Meta.PreferredVisualizationPluginID = "heatmap"
		}

		for _, sample := range series.Samples {
			frame.AppendRow(time.UnixMilli(sample.GetTimestampMs()), sample.GetValue())
		}

		if len(series.Exemplars) > 0 {
			exFrame := transformExemplarToFrame(name, series)
			exemplarFrames = append(exemplarFrames, exFrame)
		}

		frames[i] = frame
	}
	return append(frames, exemplarFrames...)
}

func metricsValueToString(value *v1.AnyValue) (string, string) {
	switch value.GetValue().(type) {
	case *v1.AnyValue_DoubleValue:
		res := strconv.FormatFloat(value.GetDoubleValue(), 'f', -1, 64)
		return res, res
	case *v1.AnyValue_IntValue:
		res := strconv.FormatInt(value.GetIntValue(), 10)
		return res, res
	case *v1.AnyValue_StringValue:
		// return the value wrapped in quotes since it's accurate and "1" is different from 1
		// the second value is returned without quotes for display purposes
		return fmt.Sprintf("\"%s\"", value.GetStringValue()), value.GetStringValue()
	case *v1.AnyValue_BoolValue:
		res := strconv.FormatBool(value.GetBoolValue())
		return res, res
	}
	return "", ""
}

func transformLabelsAndGetName(seriesLabels []v1.KeyValue) (string, data.Labels) {
	labels := make(data.Labels)
	for _, label := range seriesLabels {
		labels[label.GetKey()], _ = metricsValueToString(label.GetValue())
	}
	name := ""
	if len(seriesLabels) > 0 {
		if len(seriesLabels) == 1 {
			_, name = metricsValueToString(seriesLabels[0].GetValue())
		} else {
			var labelStrings []string
			for key, val := range labels {
				labelStrings = append(labelStrings, fmt.Sprintf("%s=%s", key, val))
			}
			name = fmt.Sprintf("{%s}", strings.Join(labelStrings, ", "))
		}
	}
	return name, labels
}

func isHistogramQuery(query string) bool {
	match, _ := regexp.MatchString("\\|\\s*(histogram_over_time)\\s*\\(", query)
	return match
}
