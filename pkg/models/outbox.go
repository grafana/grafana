package models

import (
	"encoding/json"
)

type OutboxEvent struct {
	Id      int64           `json:"id"`
	Status  int             `json:"status"`
	Subject string          `json:"subject"`
	Payload json.RawMessage `json:"payload"`
}

type OutboxPayloadOp string

const (
	OutboxPayloadOpEmpty  OutboxPayloadOp = ""
	OutboxPayloadOpCreate OutboxPayloadOp = "create"
	OutboxPayloadOpUpdate OutboxPayloadOp = "update"
	OutboxPayloadOpDelete OutboxPayloadOp = "delete"
)

type OutboxPayload struct {
	Op     OutboxPayloadOp `json:"op,omitempty"`
	Entity string          `json:"entity,omitempty"`
	ID     int64           `json:"id,omitempty"`
	Data   json.RawMessage `json:"data,omitempty"`
}
