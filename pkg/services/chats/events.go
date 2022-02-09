package chats

import "github.com/grafana/grafana/pkg/services/chats/chatmodel"

type ChatEventType string

const (
	ChatEventMessageCreated ChatEventType = "messageCreated"
)

// ChatEvent represents chat event structure.
type ChatEvent struct {
	Event          ChatEventType         `json:"event"`
	MessageCreated *chatmodel.MessageDto `json:"messageCreated"`
}
