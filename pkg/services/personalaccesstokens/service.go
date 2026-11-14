// Package personalaccesstokens implements the lifecycle (create, list, revoke) of
// user-issued personal access tokens, enforcing instance policy and auditing every change.
package personalaccesstokens

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"sync"
	"time"

	"golang.org/x/time/rate"

	"github.com/grafana/grafana/pkg/apimachinery/errutil"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/personalaccesstokens/patpolicy"
	"github.com/grafana/grafana/pkg/services/personalaccesstokens/patscope"
	"github.com/grafana/grafana/pkg/services/personalaccesstokens/patstore"
	"github.com/grafana/grafana/pkg/services/personalaccesstokens/pattoken"
	"github.com/grafana/grafana/pkg/setting"
)

var (
	ErrDisabled         = errutil.Forbidden("personal-token.disabled", errutil.WithPublicMessage("Personal access tokens are disabled"))
	errInvalidName      = errutil.BadRequest("personal-token.invalid-name", errutil.WithPublicMessage("Token name is required and must be at most 190 characters"))
	errScopesRequired   = errutil.BadRequest("personal-token.scopes-required", errutil.WithPublicMessage("Token scopes are required"))
	errScopesNotAllowed = errutil.BadRequest("personal-token.scopes-not-allowed", errutil.WithPublicMessage("Token scopes are not permitted for this user"))
	errNoExpiry         = errutil.BadRequest("personal-token.no-expiry", errutil.WithPublicMessage("Tokens without expiry are not allowed"))
	errLifetime         = errutil.BadRequest("personal-token.lifetime", errutil.WithPublicMessage("Token lifetime exceeds the maximum allowed"))
	ErrLimit            = errutil.Forbidden("personal-token.limit-reached", errutil.WithPublicMessage("Maximum number of personal access tokens reached"))
	ErrRateLimited      = errutil.TooManyRequests("personal-token.rate-limited", errutil.WithPublicMessage("Too many token creation requests"))
	ErrNotFound         = errutil.NotFound("personal-token.not-found", errutil.WithPublicMessage("Personal access token not found"))
)

const maxNameLength = 190

// Actor describes who performs an operation, for auditing.
type Actor struct {
	UserID int64
	OrgID  int64
	IP     string
}

type CreateRequest struct {
	Name string
	// Scopes limits the token to these actions; see patscope.Scopes.
	Scopes patscope.Scopes
	// LifetimeDays of 0 uses the configured default; -1 requests no expiry.
	LifetimeDays int
	// OwnerPermissions are the creator's current permissions in the org, used to validate scopes.
	OwnerPermissions map[string][]string
}

type CreateResult struct {
	Token *patstore.Token
	// Secret is returned exactly once.
	Secret string
}

type Service interface {
	Create(ctx context.Context, actor Actor, req CreateRequest) (*CreateResult, error)
	List(ctx context.Context, userID, orgID int64) ([]*patstore.Token, error)
	// Revoke revokes one token; reason is ReasonUser or ReasonAdmin depending on the actor.
	Revoke(ctx context.Context, actor Actor, userID int64, uid string, reason string) error
	RevokeAllForUser(ctx context.Context, actor Actor, userID int64, reason string) (int64, error)
	// Search lists tokens of all owners, limited to q.OrgID unless it is 0.
	Search(ctx context.Context, q patstore.SearchQuery) (*patstore.SearchResult, error)
	// AdminRevoke revokes any token by uid; orgID restricts it to one organization unless 0.
	AdminRevoke(ctx context.Context, actor Actor, orgID int64, uid string) error
}

type ServiceImpl struct {
	store    patstore.Store
	cfg      *setting.Cfg
	policy   patpolicy.Policy
	log      log.Logger
	now      func() time.Time
	limiters sync.Map // userID -> *rate.Limiter
}

func ProvideService(store patstore.Store, cfg *setting.Cfg, policy patpolicy.Policy) *ServiceImpl {
	return &ServiceImpl{store: store, cfg: cfg, policy: policy, log: log.New("personalaccesstokens"), now: time.Now}
}

func (s *ServiceImpl) Create(ctx context.Context, actor Actor, req CreateRequest) (*CreateResult, error) {
	pc := s.cfg.PersonalAccessTokens
	if !s.policy.OrgEnabled(ctx, actor.OrgID) {
		return nil, ErrDisabled.Errorf("feature disabled")
	}
	if !s.allowCreate(actor.UserID) {
		s.audit("create_rate_limited", actor, 0, "")
		return nil, ErrRateLimited.Errorf("rate limited")
	}

	name := strings.TrimSpace(req.Name)
	if name == "" || len(name) > maxNameLength {
		return nil, errInvalidName.Errorf("invalid name")
	}

	if len(req.Scopes) == 0 && pc.RequireScopes {
		return nil, errScopesRequired.Errorf("scopes required")
	}
	if err := patscope.ValidateRequested(req.OwnerPermissions, req.Scopes, pc.AllowAdminActions); err != nil {
		return nil, errScopesNotAllowed.Errorf("%w", err)
	}
	scopes, err := json.Marshal(req.Scopes)
	if err != nil {
		return nil, fmt.Errorf("marshal scopes: %w", err)
	}

	expires, err := s.expiry(req.LifetimeDays)
	if err != nil {
		return nil, err
	}

	if pc.MaxTokensPerUser > 0 {
		n, err := s.store.CountActiveByUser(ctx, actor.UserID, actor.OrgID)
		if err != nil {
			return nil, fmt.Errorf("count tokens: %w", err)
		}
		if n >= int64(pc.MaxTokensPerUser) {
			return nil, ErrLimit.Errorf("limit reached")
		}
	}

	tok, err := pattoken.New()
	if err != nil {
		return nil, fmt.Errorf("generate token: %w", err)
	}
	stored, err := s.store.Create(ctx, patstore.CreateCommand{
		UserID: actor.UserID, OrgID: actor.OrgID, Name: name, TokenHash: tok.Hash, PrefixHint: tok.Hint,
		Scopes: string(scopes), ExpiresAt: expires, CreatedIP: actor.IP,
	})
	if err != nil {
		return nil, fmt.Errorf("store token: %w", err)
	}
	s.audit("create", actor, actor.UserID, stored.UID)
	return &CreateResult{Token: stored, Secret: tok.Secret}, nil
}

func (s *ServiceImpl) expiry(days int) (*time.Time, error) {
	pc := s.cfg.PersonalAccessTokens
	switch {
	case days == 0:
		days = pc.DefaultLifetimeDays
	case days < 0:
		if !pc.AllowNoExpiry {
			return nil, errNoExpiry.Errorf("no expiry not allowed")
		}
		return nil, nil
	}
	if days > pc.MaxLifetimeDays {
		return nil, errLifetime.Errorf("lifetime %d exceeds max %d days", days, pc.MaxLifetimeDays)
	}
	t := s.now().UTC().Add(time.Duration(days) * 24 * time.Hour)
	return &t, nil
}

func (s *ServiceImpl) List(ctx context.Context, userID, orgID int64) ([]*patstore.Token, error) {
	return s.store.ListByUser(ctx, userID, orgID)
}

func (s *ServiceImpl) Revoke(ctx context.Context, actor Actor, userID int64, uid, reason string) error {
	if err := s.store.Revoke(ctx, actor.OrgID, userID, uid, reason); err != nil {
		if errors.Is(err, patstore.ErrNotFound) {
			return ErrNotFound.Errorf("token not found")
		}
		return fmt.Errorf("revoke token: %w", err)
	}
	s.audit("revoke:"+reason, actor, userID, uid)
	return nil
}

func (s *ServiceImpl) Search(ctx context.Context, q patstore.SearchQuery) (*patstore.SearchResult, error) {
	return s.store.Search(ctx, q)
}

func (s *ServiceImpl) AdminRevoke(ctx context.Context, actor Actor, orgID int64, uid string) error {
	t, err := s.store.GetByUID(ctx, uid)
	if err != nil {
		if errors.Is(err, patstore.ErrNotFound) {
			return ErrNotFound.Errorf("token not found")
		}
		return fmt.Errorf("get token: %w", err)
	}
	if orgID != 0 && t.OrgID != orgID {
		return ErrNotFound.Errorf("token not found")
	}
	if err := s.store.Revoke(ctx, t.OrgID, t.UserID, uid, patstore.ReasonAdmin); err != nil {
		if errors.Is(err, patstore.ErrNotFound) {
			return ErrNotFound.Errorf("token not found")
		}
		return fmt.Errorf("revoke token: %w", err)
	}
	s.audit("revoke:"+patstore.ReasonAdmin, actor, t.UserID, uid)
	return nil
}

func (s *ServiceImpl) RevokeAllForUser(ctx context.Context, actor Actor, userID int64, reason string) (int64, error) {
	n, err := s.store.RevokeAllForUser(ctx, userID, reason)
	if err != nil {
		return 0, fmt.Errorf("revoke tokens: %w", err)
	}
	s.audit(fmt.Sprintf("revoke_all:%s:%d", reason, n), actor, userID, "")
	return n, nil
}

// allowCreate limits token minting per user to blunt compromised-session abuse.
func (s *ServiceImpl) allowCreate(userID int64) bool {
	l, _ := s.limiters.LoadOrStore(userID, rate.NewLimiter(rate.Every(6*time.Second), 5))
	return l.(*rate.Limiter).Allow()
}

// audit never receives secrets; only identifiers.
func (s *ServiceImpl) audit(event string, actor Actor, ownerID int64, uid string) {
	s.log.Info("personal access token event", "event", event, "actorUserId", actor.UserID, "orgId", actor.OrgID,
		"ownerUserId", ownerID, "tokenUid", uid, "ip", actor.IP)
}
