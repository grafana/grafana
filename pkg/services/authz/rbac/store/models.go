package store

type UserIdentifiers struct {
	ID  int64
	UID string
}

type BasicRole struct {
	Role    string
	IsAdmin bool
}

type PermissionsQuery struct {
	OrgID         int64
	UserID        int64
	Action        string
	TeamIDs       []int64
	Role          string
	IsServerAdmin bool
}

type BasicRoleQuery struct {
	UserID int64
	OrgID  int64
}

type UserIdentifierQuery struct {
	UserID  int64
	UserUID string
}
