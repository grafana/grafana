package loki

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
)

// Will return a simple frame with:
// labels,time,line
func lokiBytesToLabeledFrame(msg []byte) (*data.Frame, error) {
	rsp := &lokiResponse{}
	err := json.Unmarshal(msg, rsp)
	if err != nil {
		return nil, err
	}

	labelField := data.NewFieldFromFieldType(data.FieldTypeString, 0)
	timeField := data.NewFieldFromFieldType(data.FieldTypeTime, 0)
	lineField := data.NewFieldFromFieldType(data.FieldTypeString, 0)

	labelField.Name = "__labels" // for now, avoid automatically spreading this by labels
	labelField.Name = "Time"
	labelField.Name = "Line"

	for _, stream := range rsp.Streams {
		label := toLabelString(stream.Stream)
		for _, value := range stream.Values {
			ts := time.Now() // TODO! parse [0]
			line := value[1]

			labelField.Append(label)
			timeField.Append(ts)
			lineField.Append(line)
		}
	}

	return data.NewFrame("", labelField, timeField, lineField), nil
}

// TODO!  actual formatting
func toLabelString(vals map[string]string) string {
	return fmt.Sprintf("%v", vals)
}
