package events

import (
	"time"
)

// Events can be passed to external systems via for example AMQP
// Treat these events as basically DTOs so changes has to be backward compatible

type OrgCreated struct {
	Timestamp time.Time `json:"timestamp"`
	Id        int64     `json:"id"`
	Name      string    `json:"name"`
}

type OrgUpdated struct {
	Timestamp time.Time `json:"timestamp"`
	Id        int64     `json:"id"`
	Name      string    `json:"name"`
}

type UserCreated struct {
	Timestamp time.Time `json:"timestamp"`
	Id        int64     `json:"id"`
	Name      string    `json:"name"`
	Login     string    `json:"login"`
	Email     string    `json:"email"`
}

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

type UserUpdated struct {
	Timestamp time.Time `json:"timestamp"`
	Id        int64     `json:"id"`
	Name      string    `json:"name"`
	Login     string    `json:"login"`
	Email     string    `json:"email"`
}

type DataSourceDeleted struct {
	Timestamp time.Time `json:"timestamp"`
	Name      string    `json:"name"`
	ID        int64     `json:"id"`
	UID       string    `json:"uid"`
	OrgID     int64     `json:"org_id"`
}

type DataSourceCreated struct {
	Timestamp time.Time `json:"timestamp"`
	Name      string    `json:"name"`
	ID        int64     `json:"id"`
	UID       string    `json:"uid"`
	OrgID     int64     `json:"org_id"`
}

type FolderUpdated struct {
	Timestamp time.Time `json:"timestamp"`
	Title     string    `json:"name"`
	ID        int64     `json:"id"`
	UID       string    `json:"uid"`
	OrgID     int64     `json:"org_id"`
}
