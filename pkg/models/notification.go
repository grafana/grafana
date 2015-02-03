package models

import (
	"time"
)

type EventPriority string

const (
	PRIO_DEBUG EventPriority = "DEBUG"
	PRIO_INFO EventPriority = "INFO"
	PRIO_ERROR EventPriority = "ERROR"
)

type Notification struct {
	EventType string `json:"event_type"`
	Timestamp time.Time `json:"timestamp"`
	Priority  EventPriority `json:"priority"`
	Payload interface{} `json:"payload"`
}

