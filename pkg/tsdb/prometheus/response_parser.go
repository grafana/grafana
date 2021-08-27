package prometheus

import (
	"fmt"
	"strings"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/prometheus/common/model"
)

func parseResponse(value model.Value, query *PrometheusQuery) (data.Frames, error) {
	frames := data.Frames{}

	matrix, ok := value.(model.Matrix)
	if ok {
		newFrames := matrixToDataFrames(matrix, query)
		frames = append(frames, newFrames...)
	}

	vector, ok := value.(model.Vector)
	if ok {
		newFrames := vectorToDataFrames(vector, query)
		frames = append(frames, newFrames...)
	}

	scalar, ok := value.(*model.Scalar)
	if ok {
		newFrames := scalarToDataFrames(scalar)
		frames = append(frames, newFrames...)
	}

	if len(frames) == 0 {
		return frames, fmt.Errorf("unsupported result format: %q", value.Type().String())
	}

	return frames, nil
}

func scalarToDataFrames(scalar *model.Scalar) data.Frames {
	timeVector := []time.Time{time.Unix(scalar.Timestamp.Unix(), 0).UTC()}
	values := []float64{float64(scalar.Value)}
	name := fmt.Sprintf("%g", values[0])
	frames := data.Frames{data.NewFrame(name,
		data.NewField("Time", nil, timeVector),
		data.NewField("Value", nil, values).SetConfig(&data.FieldConfig{DisplayNameFromDS: name}))}

	return frames
}

func vectorToDataFrames(vector model.Vector, query *PrometheusQuery) data.Frames {
	frames := data.Frames{}

	for _, v := range vector {
		name := formatLegend(v.Metric, query)
		tags := make(map[string]string, len(v.Metric))
		timeVector := []time.Time{time.Unix(v.Timestamp.Unix(), 0).UTC()}
		values := []float64{float64(v.Value)}
		for k, v := range v.Metric {
			tags[string(k)] = string(v)
		}
		frames = append(frames, data.NewFrame(name,
			data.NewField("Time", nil, timeVector),
			data.NewField("Value", tags, values).SetConfig(&data.FieldConfig{DisplayNameFromDS: name})))
	}

	return frames
}

func matrixToDataFrames(matrix model.Matrix, query *PrometheusQuery) data.Frames {
	frames := data.Frames{}

	for _, v := range matrix {
		tags := make(map[string]string, len(v.Metric))
		timeVector := make([]time.Time, 0, len(v.Values))
		values := make([]float64, 0, len(v.Values))
		for k, v := range v.Metric {
			tags[string(k)] = string(v)
		}
		for _, k := range v.Values {
			timeVector = append(timeVector, time.Unix(k.Timestamp.Unix(), 0).UTC())
			values = append(values, float64(k.Value))
		}
		name := formatLegend(v.Metric, query)
		frames = append(frames, data.NewFrame(name,
			data.NewField("Time", nil, timeVector),
			data.NewField("Value", tags, values).SetConfig(&data.FieldConfig{DisplayNameFromDS: name})))
	}

	return frames
}

func formatLegend(metric model.Metric, query *PrometheusQuery) string {
	var legend string

	if query.LegendFormat == "" {
		legend = metric.String()
	} else {
		result := legendFormat.ReplaceAllFunc([]byte(query.LegendFormat), func(in []byte) []byte {
			labelName := strings.Replace(string(in), "{{", "", 1)
			labelName = strings.Replace(labelName, "}}", "", 1)
			labelName = strings.TrimSpace(labelName)
			if val, exists := metric[model.LabelName(labelName)]; exists {
				return []byte(val)
			}

			return []byte{}
		})
		legend = string(result)
	}

	// If legend is empty brackets, use query expression
	if legend == "{}" {
		legend = query.Expr
	}

	return legend
}
