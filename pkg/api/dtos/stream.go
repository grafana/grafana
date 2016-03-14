package dtos

import "encoding/json"

type StreamMessage struct {
	Stream     string          `json:"stream"`
	Metric     string          `json:"name"`
	Datapoints [][]json.Number `json:"username"`
}
