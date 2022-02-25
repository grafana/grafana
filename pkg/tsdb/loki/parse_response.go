package loki

import (
	"fmt"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/loki/pkg/loghttp"
)

func parseResponse(value *loghttp.QueryResponse, query *lokiQuery) (data.Frames, error) {
	frames, err := lokiResponseToDataFrames(value, query)

	if err != nil {
		return nil, err
	}

	for _, frame := range frames {
		adjustFrame(frame, query)
	}

	return frames, nil
}

func lokiResponseToDataFrames(value *loghttp.QueryResponse, query *lokiQuery) (data.Frames, error) {
	switch res := value.Data.Result.(type) {
	case loghttp.Matrix:
		return lokiMatrixToDataFrames(res, query), nil
	case loghttp.Vector:
		return lokiVectorToDataFrames(res, query), nil
	case loghttp.Streams:
		return lokiStreamsToDataFrames(res, query), nil
	default:
		return nil, fmt.Errorf("resultType %T not supported{", res)
	}
}

func lokiMatrixToDataFrames(matrix loghttp.Matrix, query *lokiQuery) data.Frames {
	frames := data.Frames{}

	for _, v := range matrix {
		tags := make(map[string]string, len(v.Metric))
		timeVector := make([]time.Time, 0, len(v.Values))
		values := make([]float64, 0, len(v.Values))

		for k, v := range v.Metric {
			tags[string(k)] = string(v)
		}

		for _, k := range v.Values {
			timeVector = append(timeVector, k.Timestamp.Time().UTC())
			values = append(values, float64(k.Value))
		}

		timeField := data.NewField("", nil, timeVector)
		valueField := data.NewField("", tags, values)

		frame := data.NewFrame("", timeField, valueField)

		frames = append(frames, frame)
	}

	return frames
}

func lokiVectorToDataFrames(vector loghttp.Vector, query *lokiQuery) data.Frames {
	frames := data.Frames{}

	for _, v := range vector {
		tags := make(map[string]string, len(v.Metric))
		timeVector := []time.Time{v.Timestamp.Time().UTC()}
		values := []float64{float64(v.Value)}

		for k, v := range v.Metric {
			tags[string(k)] = string(v)
		}
		timeField := data.NewField("", nil, timeVector)
		valueField := data.NewField("", tags, values)

		frame := data.NewFrame("", timeField, valueField)

		frames = append(frames, frame)
	}

	return frames
}

func lokiStreamsToDataFrames(streams loghttp.Streams, query *lokiQuery) data.Frames {
	frames := data.Frames{}

	for _, v := range streams {
		tags := make(map[string]string, len(v.Labels))
		timeVector := make([]time.Time, 0, len(v.Entries))
		values := make([]string, 0, len(v.Entries))

		for k, v := range v.Labels {
			tags[k] = v
		}

		for _, k := range v.Entries {
			timeVector = append(timeVector, k.Timestamp.UTC())
			values = append(values, k.Line)
		}

		timeField := data.NewField("", nil, timeVector)
		valueField := data.NewField("", tags, values)

		frame := data.NewFrame("", timeField, valueField)

		frames = append(frames, frame)
	}

	return frames
}
