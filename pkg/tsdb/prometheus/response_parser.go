package prometheus

import (
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
		newFrames := scalarToDataFrames(*scalar)
		frames = append(frames, newFrames...)
	}

	return frames, nil
}

func scalarToDataFrames(scalar model.Scalar) data.Frames {
	frames := data.Frames{}
	timeVector := make([]time.Time, 0, 1)
	values := make([]float64, 0, 1)
	timeVector = append(timeVector, time.Unix(scalar.Timestamp.Unix(), 0).UTC())
	values = append(values, float64(scalar.Value))
	frames = append(frames, data.NewFrame("",
		data.NewField("time", nil, timeVector),
		data.NewField("value", nil, values),
	))

	return frames
}

func vectorToDataFrames(vector model.Vector, query *PrometheusQuery) data.Frames {
	frames := data.Frames{}

	for _, v := range vector {
		name := formatLegend(v.Metric, query)
		tags := make(map[string]string, len(v.Metric))
		timeVector := make([]time.Time, 0, 1)
		values := make([]float64, 0, 1)
		for k, v := range v.Metric {
			tags[string(k)] = string(v)
		}
		timeVector = append(timeVector, time.Unix(v.Timestamp.Unix(), 0).UTC())
		values = append(values, float64(v.Value))
		frames = append(frames, data.NewFrame(name,
			data.NewField("time", nil, timeVector),
			data.NewField("value", tags, values).SetConfig(&data.FieldConfig{DisplayNameFromDS: name})))
	}

	return frames
}

func matrixToDataFrames(matrix model.Matrix, query *PrometheusQuery) data.Frames {
	frames := data.Frames{}

	for _, v := range matrix {
		name := formatLegend(v.Metric, query)
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
		frames = append(frames, data.NewFrame(name,
			data.NewField("time", nil, timeVector),
			data.NewField("value", tags, values).SetConfig(&data.FieldConfig{DisplayNameFromDS: name})))
	}

	return frames
}

func formatLegend(metric model.Metric, query *PrometheusQuery) string {
	if query.LegendFormat == "" {
		return metric.String()
	}

	result := legendFormat.ReplaceAllFunc([]byte(query.LegendFormat), func(in []byte) []byte {
		labelName := strings.Replace(string(in), "{{", "", 1)
		labelName = strings.Replace(labelName, "}}", "", 1)
		labelName = strings.TrimSpace(labelName)
		if val, exists := metric[model.LabelName(labelName)]; exists {
			return []byte(val)
		}
		return []byte{}
	})

	return string(result)
}
