package models

import (
	"errors"
	"time"
)

// Typed errors
var (
	ErrTeamGroupNotFound     = errors.New("Team group not found")
	ErrTeamGroupAlreadyAdded = errors.New("Group is already associated with this team")
)

// TeamGroup model
type TeamGroup struct {
	Id      int64
	OrgId   int64
	TeamId  int64
	GroupId string

	Created time.Time
	Updated time.Time
}

// ---------------------
// COMMANDS

type AddTeamGroupCommand struct {
	GroupId string `json:"groupId" binding:"Required"`
	OrgId   int64  `json:"-"`
	TeamId  int64  `json:"-"`
}

type RemoveTeamGroupCommand struct {
	GroupId string `json:"groupId" binding:"Required"`
	OrgId   int64  `json:"-"`
	TeamId  int64  `json:"-"`
}

// ----------------------
// QUERIES

type GetTeamGroupsQuery struct {
	OrgId   int64
	TeamId  int64
	GroupId string
	Result  []*TeamGroupDTO
}

// ----------------------
// Projections and DTOs

type TeamGroupDTO struct {
	OrgId   int64  `json:"orgId"`
	TeamId  int64  `json:"teamId"`
	GroupId string `json:"groupId"`
}
