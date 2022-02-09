package chatmodel

type ChatEventType string

const (
	ChatEventMessageCreated ChatEventType = "messageCreated"
)

// ChatEvent represents chat event structure.
type ChatEvent struct {
	Event          ChatEventType `json:"event"`
	MessageCreated *MessageDto   `json:"messageCreated"`
}
