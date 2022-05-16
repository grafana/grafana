package team

import (
	"errors"
	"time"

	"github.com/grafana/grafana/pkg/models"
)

// Typed errors
var (
	ErrTeamMemberAlreadyAdded               = errors.New("User is already added to this team")
	ErrTeamNotFound                         = errors.New("team not found")
	ErrTeamNameTaken                        = errors.New("team name is taken")
	ErrTeamMemberNotFound                   = errors.New("team member not found")
	ErrLastTeamAdmin                        = errors.New("not allowed to remove last admin")
	ErrNotAllowedToUpdateTeam               = errors.New("user not allowed to update team")
	ErrNotAllowedToUpdateTeamInDifferentOrg = errors.New("user not allowed to update team in another org")
)

// Team model
type Team struct {
	ID    int64  `json:"id" xorm:"pk autoincr 'id'"`
	OrgID int64  `json:"orgId" xorm:"org_id"`
	Name  string `json:"name"`
	Email string `json:"email"`

	Created time.Time `json:"created"`
	Updated time.Time `json:"updated"`
}

// ---------------------
// COMMANDS

type CreateTeamCommand struct {
	Name  string `json:"name" binding:"Required"`
	Email string `json:"email"`
	OrgID int64  `json:"-"`

	Result Team `json:"-"`
}

type UpdateTeamCommand struct {
	ID    int64
	Name  string
	Email string
	OrgID int64 `json:"-"`
}

type DeleteTeamCommand struct {
	OrgID int64 `xorm:"org_id"`
	ID    int64 `xorm:"id"`
}

type GetTeamByIdQuery struct {
	OrgID        int64
	ID           int64
	SignedInUser *models.SignedInUser
	HiddenUsers  map[string]struct{}
	Result       *TeamDTO
	UserIdFilter int64
}

// FilterIgnoreUser is used in a get / search teams query when the caller does not want to filter teams by user ID / membership
const FilterIgnoreUser int64 = 0

type GetTeamsByUserQuery struct {
	OrgID  int64
	UserID int64 `json:"userId"`
}

type GetTeamsByUserQueryResult struct {
	Result []*TeamDTO `json:"teams"`
}
type SearchTeamsQuery struct {
	Query        string
	Name         string
	Limit        int
	Page         int
	OrgID        int64 `xorm:"org_id"`
	UserIdFilter int64
	SignedInUser *models.SignedInUser
	HiddenUsers  map[string]struct{}
	AcEnabled    bool
}

type TeamDTO struct {
	Id            int64                 `json:"id"`
	OrgId         int64                 `json:"orgId"`
	Name          string                `json:"name"`
	Email         string                `json:"email"`
	AvatarUrl     string                `json:"avatarUrl"`
	MemberCount   int64                 `json:"memberCount"`
	Permission    models.PermissionType `json:"permission"`
	AccessControl map[string]bool       `json:"accessControl"`
}

type SearchTeamQueryResult struct {
	TotalCount int64      `json:"totalCount"`
	Teams      []*TeamDTO `json:"teams"`
	Page       int        `json:"page"`
	PerPage    int        `json:"perPage"`
}

type IsAdminOfTeamsQuery struct {
	SignedInUser *models.SignedInUser
	Result       bool
}

// TeamMember model
type TeamMember struct {
	Id         int64
	OrgId      int64
	TeamId     int64
	UserId     int64
	External   bool // Signals that the membership has been created by an external systems, such as LDAP
	Permission models.PermissionType

	Created time.Time
	Updated time.Time
}

// ---------------------
// COMMANDS

type AddTeamMemberCommand struct {
	UserId     int64                 `json:"userId" binding:"Required"`
	OrgId      int64                 `json:"-"`
	TeamId     int64                 `json:"-"`
	External   bool                  `json:"-"`
	Permission models.PermissionType `json:"-"`
}

type UpdateTeamMemberCommand struct {
	UserId     int64                 `json:"-"`
	OrgId      int64                 `json:"-"`
	TeamId     int64                 `json:"-"`
	Permission models.PermissionType `json:"permission"`
}

type RemoveTeamMemberCommand struct {
	OrgId  int64 `json:"-"`
	UserId int64
	TeamId int64
}

// ----------------------
// QUERIES

type GetTeamMembersQuery struct {
	OrgId        int64
	TeamId       int64
	UserId       int64
	External     bool
	SignedInUser *models.SignedInUser
}

// ----------------------
// Projections and DTOs

type TeamMemberDTO struct {
	OrgID      int64                 `json:"orgId" xorm:"org_id"`
	TeamId     int64                 `json:"teamId"`
	UserId     int64                 `json:"userId"`
	External   bool                  `json:"-"`
	AuthModule string                `json:"auth_module"`
	Email      string                `json:"email"`
	Name       string                `json:"name"`
	Login      string                `json:"login"`
	AvatarUrl  string                `json:"avatarUrl"`
	Labels     []string              `json:"labels"`
	Permission models.PermissionType `json:"permission"`
}
