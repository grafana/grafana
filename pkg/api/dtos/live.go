package dtos

import "encoding/json"

type LivePublishCmd struct {
	Channel string          `json:"channel"`
	Data    json.RawMessage `json:"data,omitempty"`
}

type LivePublishResponse struct {
}
