package tempuser

import (
	"errors"
	"time"

	"github.com/grafana/grafana/pkg/services/org"
)

// Typed errors
var (
	ErrTempUserNotFound = errors.New("user not found")
)

type TempUserStatus string

const (
	TmpUserSignUpStarted        TempUserStatus = "SignUpStarted"
	TmpUserInvitePending        TempUserStatus = "InvitePending"
	TmpUserCompleted            TempUserStatus = "Completed"
	TmpUserRevoked              TempUserStatus = "Revoked"
	TmpUserExpired              TempUserStatus = "Expired"
	TmpUserEmailUpdateStarted   TempUserStatus = "EmailUpdateStarted"
	TmpUserEmailUpdateCompleted TempUserStatus = "EmailUpdateCompleted"
	TmpUserEmailUpdateExpired   TempUserStatus = "EmailUpdateExpired"
)

// TempUser holds data for org invites and unconfirmed sign ups
type TempUser struct {
	ID              int64 `xorm:"pk autoincr 'id'"`
	OrgID           int64 `xorm:"org_id"`
	Version         int
	Email           string
	Name            string
	Role            org.RoleType
	InvitedByUserID int64 `xorm:"invited_by_user_id"`
	Status          TempUserStatus

	EmailSent   bool
	EmailSentOn time.Time
	Code        string
	RemoteAddr  string

	Created int64
	Updated int64
}

// ---------------------
// COMMANDS

type CreateTempUserCommand struct {
	Email           string
	Name            string
	OrgID           int64 `xorm:"org_id"`
	InvitedByUserID int64 `xorm:"invited_by_user_id"`
	Status          TempUserStatus
	Code            string
	Role            org.RoleType
	RemoteAddr      string
}

type UpdateTempUserStatusCommand struct {
	Code   string
	Status TempUserStatus
}

type ExpireTempUsersCommand struct {
	OlderThan time.Time

	NumExpired int64
}

type ExpirePreviousVerificationsCommand struct {
	InvitedByUserID int64

	NumExpired int64
}

type UpdateTempUserWithEmailSentCommand struct {
	Code string
}

type GetTempUsersQuery struct {
	OrgID  int64 `xorm:"org_id"`
	Email  string
	Status TempUserStatus
}

type GetTempUserByCodeQuery struct {
	Code string
}

type TempUserDTO struct {
	ID             int64          `json:"id" xorm:"id"`
	OrgID          int64          `json:"orgId" xorm:"org_id"`
	Name           string         `json:"name"`
	Email          string         `json:"email"`
	Role           org.RoleType   `json:"role"`
	InvitedByID    int64          `json:"-" xorm:"invited_by_id"`
	InvitedByLogin string         `json:"invitedByLogin"`
	InvitedByEmail string         `json:"invitedByEmail"`
	InvitedByName  string         `json:"invitedByName"`
	Code           string         `json:"code"`
	Status         TempUserStatus `json:"status"`
	URL            string         `json:"url"`
	EmailSent      bool           `json:"emailSent"`
	EmailSentOn    time.Time      `json:"emailSentOn"`
	Created        time.Time      `json:"createdOn"`
}
