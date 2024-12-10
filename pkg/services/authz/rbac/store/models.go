package store

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
