package events

import (
	"time"
)

// Events can be passed to external systems via for example AMQP
// Treat these events as basically DTOs so changes has to be backward compatible

type SignUpStarted struct {
	Timestamp time.Time `json:"timestamp"`
	Email     string    `json:"email"`
	Code      string    `json:"code"`
}

type SignUpCompleted struct {
	Timestamp time.Time `json:"timestamp"`
	Name      string    `json:"name"`
	Email     string    `json:"email"`
}

type DataSourceDeleted struct {
	Timestamp time.Time `json:"timestamp"`
	Name      string    `json:"name"`
	ID        int64     `json:"id"`
	UID       string    `json:"uid"`
	OrgID     int64     `json:"org_id"`
	Type      string    `json:"type"`
}
