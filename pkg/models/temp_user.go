package models

import (
	"errors"
	"time"
)

// Typed errors
var (
	ErrTempUserNotFound = errors.New("User not found")
)

type TempUserStatus string

const (
	TmpUserSignUpStarted TempUserStatus = "SignUpStarted"
	TmpUserInvitePending TempUserStatus = "InvitePending"
	TmpUserCompleted     TempUserStatus = "Completed"
	TmpUserRevoked       TempUserStatus = "Revoked"
)

// TempUser holds data for org invites and unconfirmed sign ups
type TempUser struct {
	Id              int64
	OrgId           int64
	OrgName         string
	Version         int
	Email           string
	Name            string
	Role            RoleType
	InvitedByUserId int64
	Status          TempUserStatus

	EmailSent   bool
	EmailSentOn time.Time
	Code        string
	RemoteAddr  string

	Created time.Time
	Updated time.Time
}

// ---------------------
// COMMANDS

type CreateTempUserCommand struct {
	Email           string
	Name            string
	OrgId           int64
	OrgName         string
	InvitedByUserId int64
	Status          TempUserStatus
	Code            string
	Role            RoleType
	RemoteAddr      string

	Result *TempUser
}

type UpdateTempUserStatusCommand struct {
	Code   string
	Status TempUserStatus
}

type GetTempUsersQuery struct {
	OrgId  int64
	Email  string
	Status TempUserStatus

	Result []*TempUserDTO
}

type GetTempUserByCodeQuery struct {
	Code string

	Result *TempUserDTO
}

type TempUserDTO struct {
	Id             int64          `json:"id"`
	OrgId          int64          `json:"org_id"`
	OrgName        string         `json:"org_name"`
	Name           string         `json:"name"`
	Email          string         `json:"email"`
	Role           RoleType       `json:"role"`
	InvitedByLogin string         `json:"invited_by_login"`
	InvitedByEmail string         `json:"invited_by_email"`
	InvitedByName  string         `json:"invited_by_name"`
	Code           string         `json:"code"`
	Status         TempUserStatus `json:"status"`
	Url            string         `json:"url"`
	EmailSent      bool           `json:"email_sent"`
	EmailSentOn    time.Time      `json:"email_sent_on"`
	Created        time.Time      `json:"created"`
}
