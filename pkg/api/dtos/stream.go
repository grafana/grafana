package dtos

import "encoding/json"

type StreamMessage struct {
	Stream     string          `json:"stream"`
	Metric     string          `json:"metric"`
	Datapoints [][]json.Number `json:"Datapoints"`
}
