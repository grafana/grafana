package store

import "time"

type UserIdentifiers struct {
	ID  int64
	UID string
}

type BasicRole struct {
	Role    string
	IsAdmin bool
}

type LatestUpdate struct {
	Updated time.Time
}

type BasicRoleQuery struct {
	UserID int64
	OrgID  int64
}

type UserIdentifierQuery struct {
	UserID  int64
	UserUID string
}

type LatestUpdateQuery struct {
	OrgID int64
}
