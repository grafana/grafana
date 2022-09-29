package models

import (
	"database/sql/driver"
	"errors"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/services/org"
)

// Typed errors
var (
	ErrTempUserNotFound = errors.New("user not found")
)

type TempUserStatus string

const (
	TmpUserSignUpStarted TempUserStatus = "SignUpStarted"
	TmpUserInvitePending TempUserStatus = "InvitePending"
	TmpUserCompleted     TempUserStatus = "Completed"
	TmpUserRevoked       TempUserStatus = "Revoked"
	TmpUserExpired       TempUserStatus = "Expired"
)

// TempUser holds data for org invites and unconfirmed sign ups
type TempUser struct {
	Id              int64          `db:"id"`
	OrgId           int64          `db:"org_id"`
	Version         int            `db:"version"`
	Email           string         `db:"email"`
	Name            string         `db:"name"`
	Role            org.RoleType   `db:"role"`
	InvitedByUserId int64          `db:"invited_by_user_id"`
	Status          TempUserStatus `db:"status"`
	EmailSent       bool           `db:"email_sent"`
	EmailSentOn     time.Time      `db:"email_sent_on"`
	Code            string         `db:"code"`
	RemoteAddr      string         `db:"remote_addr"`
	Created         int64          `db:"created"`
	Updated         int64          `db:"updated"`
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
	Role            org.RoleType
	RemoteAddr      string

	Result *TempUser
}

type UpdateTempUserStatusCommand struct {
	Code   string
	Status TempUserStatus
}

type ExpireTempUsersCommand struct {
	OlderThan time.Time

	NumExpired int64
}

type UpdateTempUserWithEmailSentCommand struct {
	Code string
}

type GetTempUsersQuery struct {
	OrgId  int64
	Email  string
	Status TempUserStatus

	Result []*TempUserDTO
}

type GetTempUserByCodeQuery struct {
	Code   string
	Result *TempUserDTO
}

type Time struct{ time.Time }
type TempUserDTO struct {
	Id             int64          `json:"id" db:"id"`
	OrgId          int64          `json:"orgId" db:"org_id"`
	Name           string         `json:"name" db:"name"`
	Email          string         `json:"email" db:"email"`
	Role           org.RoleType   `json:"role" db:"role"`
	InvitedByLogin *string        `json:"invitedByLogin" db:"invited_by_login"`
	InvitedByEmail *string        `json:"invitedByEmail" db:"invited_by_email"`
	InvitedByName  *string        `json:"invitedByName" db:"invited_by_name"`
	Code           string         `json:"code" db:"code"`
	Status         TempUserStatus `json:"status" db:"status"`
	Url            string         `json:"url" db:"url"`
	EmailSent      bool           `json:"emailSent" db:"email_sent"`
	EmailSentOn    *time.Time     `json:"emailSentOn" db:"email_sent_on"`
	Created        Time           `json:"createdOn" db:"created"`
}

func (t *Time) Scan(src interface{}) error {
	switch v := src.(type) {
	case int64:
		value := time.Unix(v, 0)
		*t = Time{value}
	case string:
		result, err := time.Parse("2006-01-02 15:04:05.999999+02:00", v)
		*t = Time{result}
		return err
	default:
		return fmt.Errorf("invalide data type the type name is %T", src)
	}
	return nil
}

func (t *Time) Value() (driver.Value, error) {
	fmt.Println("The data type is", t.Time)
	return driver.Value(time.Time(t.Time).Unix()), nil
}
