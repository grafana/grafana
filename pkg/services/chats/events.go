package chats

type ChatEventType string

const (
	ChatEventMessageCreated ChatEventType = "messageCreated"
)

type EventMessageCreated struct {
	Id      int64  `json:"id"`
	UserId  int64  `json:"userId"`
	Content string `json:"content"`
	Created int64  `json:"created"`
}

// ChatEvent events related to chats
type ChatEvent struct {
	Event          ChatEventType        `json:"event"`
	MessageCreated *EventMessageCreated `json:"messageCreated"`
}
