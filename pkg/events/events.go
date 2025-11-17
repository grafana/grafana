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
}

// FolderFullPathUpdated is emitted when the full path of the folder(s) is updated.
// For example, when the folder is renamed or moved to another folder.
// It does not contain the full path of the folders because calculating
// it requires more resources and not needed in the event at the moment.
type FolderFullPathUpdated struct {
	Timestamp time.Time `json:"timestamp"`
	ID        int64     `json:"id"`
	UIDs      []string  `json:"uids"`
	OrgID     int64     `json:"org_id"`
}
