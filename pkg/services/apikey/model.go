package apikey

import (
	"errors"
	"time"

	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/quota"
	"github.com/grafana/grafana/pkg/services/user"
)

var (
	ErrNotFound          = errors.New("API key not found")
	ErrInvalid           = errors.New("invalid API key")
	ErrInvalidExpiration = errors.New("negative value for SecondsToLive")
	ErrDuplicate         = errors.New("API key, organization ID and name must be unique")
)

type APIKey struct {
	ID               int64        `db:"id" xorm:"pk autoincr 'id'"`
	OrgID            int64        `db:"org_id" xorm:"org_id"`
	Name             string       `db:"name"`
	Key              string       `db:"key"`
	Role             org.RoleType `db:"role"`
	Created          time.Time    `db:"created"`
	Updated          time.Time    `db:"updated"`
	LastUsedAt       *time.Time   `xorm:"last_used_at" db:"last_used_at"`
	Expires          *int64       `db:"expires"`
	ServiceAccountId *int64       `db:"service_account_id"`
	IsRevoked        *bool        `xorm:"is_revoked" db:"is_revoked"`
}

func (k APIKey) TableName() string { return "api_key" }

// swagger:model
type AddCommand struct {
	Name             string       `json:"name" binding:"Required"`
	Role             org.RoleType `json:"role" binding:"Required"`
	OrgID            int64        `json:"-" xorm:"org_id"`
	Key              string       `json:"-"`
	SecondsToLive    int64        `json:"secondsToLive"`
	ServiceAccountID *int64       `json:"-"`
}

type DeleteCommand struct {
	ID    int64 `json:"id"`
	OrgID int64 `json:"-"`
}

type GetApiKeysQuery struct {
	OrgID          int64
	IncludeExpired bool
	User           *user.SignedInUser
}
type GetByNameQuery struct {
	KeyName string
	OrgID   int64
}

type GetByIDQuery struct {
	ApiKeyID int64
}

const (
	QuotaTargetSrv quota.TargetSrv = "api_key"
	QuotaTarget    quota.Target    = "api_key"
)
