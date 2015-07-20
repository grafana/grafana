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
	TmpUserInvitePending TempUserStatus = "InvitePending"
	TmpUserCompleted     TempUserStatus = "Completed"
	TmpUserEmailPending  TempUserStatus = "EmailPending"
	TmpUserRevoked       TempUserStatus = "Revoked"
)

// TempUser holds data for org invites and unconfirmed sign ups
type TempUser struct {
	Id              int64
	OrgId           int64
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
	InvitedByUserId int64
	Status          TempUserStatus
	Code            string
	Role            RoleType
	RemoteAddr      string

	Result *TempUser
}

type UpdateTempUserStatusCommand struct {
	Id     int64
	OrgId  int64
	Status TempUserStatus
}

type GetTempUsersForOrgQuery struct {
	OrgId  int64
	Status TempUserStatus

	Result []*TempUserDTO
}

type GetTempUsersByCodeQuery struct {
	Code string

	Result *TempUser
}

type TempUserDTO struct {
	Id          int64     `json:"id"`
	Name        string    `json:"name"`
	Email       string    `json:"email"`
	Role        string    `json:"role"`
	InvitedBy   string    `json:"invitedBy"`
	Code        string    `json:"code"`
	Url         string    `json:"url"`
	EmailSent   bool      `json:"emailSent"`
	EmailSentOn time.Time `json:"emailSentOn"`
	Created     time.Time `json:"createdOn"`
}
