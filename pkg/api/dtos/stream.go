package dtos

// This is broadcast to any connected clients
type StreamMessage struct {
	Stream string                 `json:"stream"`
	Time   int64                  `json:"time"`
	Body   map[string]interface{} `json:"body"`
}
