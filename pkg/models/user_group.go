package models

import "time"

// UserGroup model
type UserGroup struct {
	Id    int64
	OrgId int64
	Name  string

	Created time.Time
	Updated time.Time
}
