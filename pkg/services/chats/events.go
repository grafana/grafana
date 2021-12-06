package chats

type ChatEventType string

const (
	ChatEventMessageCreated ChatEventType = "messageCreated"
)

// EventMessageCreated sent when new message created in a chat.
type EventMessageCreated struct {
	Id      int64  `json:"id"`
	UserId  int64  `json:"userId"`
	Content string `json:"content"`
	Created int64  `json:"created"`
}

// ChatEvent represents chat event structure.
type ChatEvent struct {
	Event          ChatEventType        `json:"event"`
	MessageCreated *EventMessageCreated `json:"messageCreated"`
}
