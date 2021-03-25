package dtos

import "encoding/json"

type LivePublishCmd struct {
	Data json.RawMessage `json:"data,omitempty"`
}

type LivePublishResponse struct {
}
