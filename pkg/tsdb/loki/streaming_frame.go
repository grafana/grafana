package loki

import (
	"encoding/json"
	"strconv"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	jsoniter "github.com/json-iterator/go"
)

type lokiResponse struct {
	Streams []lokiStream `json:"streams"`
}

type lokiStream struct {
	Stream data.Labels `json:"stream"`
	Values [][2]string `json:"values"`
}

func labelsToRawJson(labels data.Labels) (json.RawMessage, error) {
	// data.Labels when converted to JSON keep the fields sorted
	bytes, err := jsoniter.Marshal(labels)
	if err != nil {
		return nil, err
	}

	return json.RawMessage(bytes), nil
}

func lokiBytesToLabeledFrame(msg []byte, query lokiQuery) (*data.Frame, error) {
	rsp := &lokiResponse{}
	err := json.Unmarshal(msg, rsp)
	if err != nil {
		return nil, err
	}

	labelField := data.NewFieldFromFieldType(data.FieldTypeJSON, 0)
	timeField := data.NewFieldFromFieldType(data.FieldTypeTime, 0)
	timeNsField := data.NewFieldFromFieldType(data.FieldTypeString, 0)
	lineField := data.NewFieldFromFieldType(data.FieldTypeString, 0)

	labelField.Name = "labels"
	timeField.Name = "Time"
	timeNsField.Name = "tsNs"
	lineField.Name = "Line"

	for _, stream := range rsp.Streams {
		label, err := labelsToRawJson(stream.Stream)
		if err != nil {
			return nil, err
		}

		for _, value := range stream.Values {
			tsNs := value[0]
			n, err := strconv.ParseInt(tsNs, 10, 64)
			if err != nil {
				continue
			}
			ts := time.Unix(0, n)
			line := value[1]

			labelField.Append(label)
			timeField.Append(ts)
			timeNsField.Append(tsNs)
			lineField.Append(line)
		}
	}

	frame := data.NewFrame("", labelField, timeField, lineField, timeNsField)
	err = adjustFrame(frame, &query)
	if err != nil {
		return nil, err
	}
	return frame, nil
}
