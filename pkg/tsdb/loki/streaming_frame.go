package loki

import (
	"encoding/json"
	"strconv"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
)

type lokiResponse struct {
	Streams []lokiStream `json:"streams"`
}

type lokiStream struct {
	Stream data.Labels `json:"stream"`
	Values [][2]string `json:"values"`
}

func lokiBytesToLabeledFrame(msg []byte, query lokiQuery) (*data.Frame, error) {
	rsp := &lokiResponse{}
	err := json.Unmarshal(msg, rsp)
	if err != nil {
		return nil, err
	}

	labelField := data.NewFieldFromFieldType(data.FieldTypeString, 0)
	timeField := data.NewFieldFromFieldType(data.FieldTypeTime, 0)
	lineField := data.NewFieldFromFieldType(data.FieldTypeString, 0)

	labelField.Name = "labels" // for now, avoid automatically spreading this by labels
	timeField.Name = "time"
	lineField.Name = "line"

	for _, stream := range rsp.Streams {
		label, err := labelsToString(stream.Stream) // TODO -- make it match prom labels!
		if err != nil {
			return nil, err
		}
		for _, value := range stream.Values {
			n, err := strconv.ParseInt(value[0], 10, 64)
			if err != nil {
				continue
			}
			ts := time.Unix(0, n)
			line := value[1]

			labelField.Append(label)
			timeField.Append(ts)
			lineField.Append(line)
		}
	}

	frame := data.NewFrame("", timeField, lineField, labelField)
	err = adjustFrame(frame, &lokiQuery{})
	if err != nil {
		return nil, err
	}
	return frame, nil
}
