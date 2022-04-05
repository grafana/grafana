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
		err = adjustFrame(frame, query)
		if err != nil {
			return nil, err
		}
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
		return lokiStreamsToDataFrames(res, query)
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

		timeField := data.NewField("time", nil, timeVector)
		valueField := data.NewField("value", tags, values)

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
		timeField := data.NewField("time", nil, timeVector)
		valueField := data.NewField("value", tags, values)

		frame := data.NewFrame("", timeField, valueField)

		frames = append(frames, frame)
	}

	return frames
}

func lokiStreamsToDataFrames(streams loghttp.Streams, query *lokiQuery) (data.Frames, error) {
	timeVector := make([]time.Time, 0) // FIXME: we can allocate it to the right size
	values := make([]string, 0)        // FIXME: we can allocate it to the right size
	labelsVector := make([]string, 0)  // FIXME: we can allocate it to the right size

	for _, v := range streams {
		labelsText := data.Labels(v.Labels.Map()).String()

		for _, k := range v.Entries {
			timeVector = append(timeVector, k.Timestamp.UTC())
			values = append(values, k.Line)
			labelsVector = append(labelsVector, labelsText)
		}
	}

	timeField := data.NewField("time", nil, timeVector)
	valueField := data.NewField("line", nil, values)
	labelsField := data.NewField("labels", nil, labelsVector)

	return data.Frames{data.NewFrame("", labelsField, timeField, valueField)}, nil
}
