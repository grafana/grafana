package commentmodel

type EventType string

const (
	EventCommentCreated EventType = "commentCreated"
)

// Event represents comment event structure.
type Event struct {
	Event          EventType   `json:"event"`
	CommentCreated *CommentDto `json:"commentCreated"`
}
