package models

import (
	"errors"
	"time"
)

// Typed errors
var (
	ErrTempUserNotFound = errors.New("User not found")
)

// TempUser holds data for org invites and new sign ups
type TempUser struct {
	Id       int64
	OrgId    int64
	Version  int
	Email    string
	Name     string
	Role     string
	IsInvite bool

	EmailSent   bool
	EmailSentOn time.Time
	Code        string

	Created time.Time
	Updated time.Time
}

// ---------------------
// COMMANDS

type CreateTempUserCommand struct {
	Email    string
	Name     string
	OrgId    int64
	IsInvite bool
	Code     string

	Result *TempUser
}

type GetTempUsersForOrgQuery struct {
	OrgId int64

	Result []*TempUserDTO
}

type TempUserDTO struct {
	Id          int64     `json:"id"`
	Name        string    `json:"name"`
	Email       string    `json:"email"`
	Role        string    `json:"role"`
	EmailSent   bool      `json:"emailSent"`
	EmailSentOn time.Time `json:"emailSentOn"`
	Created     time.Time `json:"createdOn"`
}
