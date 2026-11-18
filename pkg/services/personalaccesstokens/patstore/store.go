package patstore

import (
	"context"
	"errors"
	"time"
)

// Revocation reasons stored with revoked tokens.
const (
	ReasonUser            = "user"
	ReasonAdmin           = "admin"
	ReasonAdminPolicy     = "admin_policy"
	ReasonUserDisabled    = "user_disabled"
	ReasonUserDeleted     = "user_deleted"
	ReasonOrgRemoved      = "org_removed"
	ReasonIDPRevoked      = "idp_revoked"
	ReasonPasswordChanged = "password_changed"
	ReasonSecretLeak      = "secret_leak"
)

var ErrNotFound = errors.New("personal access token not found")

// Token is a stored personal access token. The secret itself is never stored.
type Token struct {
	ID            int64      `xorm:"pk autoincr 'id'"`
	UID           string     `xorm:"uid"`
	UserID        int64      `xorm:"user_id"`
	OrgID         int64      `xorm:"org_id"`
	Name          string     `xorm:"name"`
	TokenHash     string     `xorm:"token_hash"`
	PrefixHint    string     `xorm:"prefix_hint"`
	Scopes        string     `xorm:"scopes"`
	ExpiresAt     *time.Time `xorm:"expires_at"`
	CreatedAt     time.Time  `xorm:"created_at"`
	CreatedIP     string     `xorm:"created_ip"`
	LastUsedAt    *time.Time `xorm:"last_used_at"`
	LastUsedIP    string     `xorm:"last_used_ip"`
	LastUsedUA    string     `xorm:"last_used_ua"`
	RevokedAt     *time.Time `xorm:"revoked_at"`
	RevokedReason string     `xorm:"revoked_reason"`
}

func (Token) TableName() string { return "personal_access_token" }

func (t *Token) IsRevoked() bool { return t.RevokedAt != nil }

func (t *Token) IsExpired(now time.Time) bool {
	return t.ExpiresAt != nil && !t.ExpiresAt.After(now)
}

type CreateCommand struct {
	UserID     int64
	OrgID      int64
	Name       string
	TokenHash  string
	PrefixHint string
	Scopes     string
	ExpiresAt  *time.Time
	CreatedIP  string
}

type UsageInfo struct {
	IP        string
	UserAgent string
}

// Status filters for SearchQuery.
const (
	StatusActive  = "active"
	StatusExpired = "expired"
	StatusRevoked = "revoked"
)

// SearchQuery lists tokens across owners. OrgID 0 means all organizations.
type SearchQuery struct {
	OrgID          int64
	UserID         int64
	Query          string // matches token name, owner login, email or name
	Status         string
	ExpiringBefore *time.Time
	Limit          int
	Page           int // 1-based
	// SortBy must be one of SortFields; unknown values fall back to creation time.
	SortBy   string
	SortDesc bool
}

// SortFields lists the accepted SearchQuery.SortBy values.
var SortFields = []string{"name", "owner", "org", "created", "expires", "lastUsed", "status", "scopes"}

// TokenWithOwner decorates a token with display data of its owner and org.
type TokenWithOwner struct {
	Token      `xorm:"extends"`
	OwnerLogin string `xorm:"owner_login"`
	OwnerEmail string `xorm:"owner_email"`
	OwnerName  string `xorm:"owner_name"`
	OrgName    string `xorm:"org_name"`
}

type SearchResult struct {
	Tokens []*TokenWithOwner
	Total  int64
}

// Store persists personal access tokens. Revocation is a soft delete so rows
// remain available for audit until DeleteInactiveBefore removes them.
type Store interface {
	Create(ctx context.Context, cmd CreateCommand) (*Token, error)
	// GetByHash returns the token regardless of revoked/expired state; callers decide.
	GetByHash(ctx context.Context, hash string) (*Token, error)
	GetByUID(ctx context.Context, uid string) (*Token, error)
	Search(ctx context.Context, q SearchQuery) (*SearchResult, error)
	ListByUser(ctx context.Context, userID, orgID int64) ([]*Token, error)
	CountActiveByUser(ctx context.Context, userID, orgID int64) (int64, error)
	// Revoke revokes a single active token owned by the given user and org.
	Revoke(ctx context.Context, orgID, userID int64, uid, reason string) error
	RevokeAllForUser(ctx context.Context, userID int64, reason string) (int64, error)
	// RevokeAll and RevokeAllInOrg implement the admin policy "revoke existing" option.
	RevokeAll(ctx context.Context, reason string) (int64, error)
	RevokeAllInOrg(ctx context.Context, orgID int64, reason string) (int64, error)
	RevokeAllForUserInOrg(ctx context.Context, userID, orgID int64, reason string) (int64, error)
	TouchLastUsed(ctx context.Context, id int64, info UsageInfo) error
	// ListActive returns all tokens that are neither revoked nor expired, across orgs.
	ListActive(ctx context.Context) ([]*Token, error)
	// RevokeByID revokes an active token by its primary key, regardless of owner.
	RevokeByID(ctx context.Context, id int64, reason string) error
	// DeleteInactiveBefore hard-deletes rows revoked or expired before the cutoff.
	DeleteInactiveBefore(ctx context.Context, cutoff time.Time) (int64, error)
}
