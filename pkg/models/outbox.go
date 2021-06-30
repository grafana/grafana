package models

import "encoding/json"

type OutboxEvent struct {
	Id      int64           `json:"id"`
	Status  int             `json:"status"`
	Subject string          `json:"subject"`
	Payload json.RawMessage `json:"payload"`
}
