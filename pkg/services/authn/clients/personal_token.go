package clients

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"time"

	"go.opentelemetry.io/otel/trace"

	claims "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/apimachinery/errutil"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/personalaccesstokens/patscope"
	"github.com/grafana/grafana/pkg/services/personalaccesstokens/patstore"
	"github.com/grafana/grafana/pkg/services/personalaccesstokens/pattoken"
	"github.com/grafana/grafana/pkg/services/user"
)

// All rejection reasons share one error so responses do not reveal why a token failed.
var errPersonalTokenInvalid = errutil.Unauthorized("personal-token.invalid", errutil.WithPublicMessage("Invalid token"))

var (
	_ authn.HookClient = (*PersonalToken)(nil)
)

const (
	metaKeyPersonalTokenID       = "personalTokenID"
	personalTokenLastUsedRefresh = 5 * time.Minute
)

// ProvidePersonalToken creates the client for user-issued glpat_ tokens. enabled
// is evaluated per request so the feature toggle and admin switch apply immediately.
func ProvidePersonalToken(store patstore.Store, userService user.Service, orgService org.Service, enabled func(context.Context) bool, orgEnabled func(context.Context, int64) bool, allowAdminActions func() bool, tracer trace.Tracer) *PersonalToken {
	return &PersonalToken{
		log:         log.New(authn.ClientPersonalToken),
		store:       store,
		userService: userService,
		orgService:  orgService,
		enabled:     enabled,
		orgEnabled:  orgEnabled,
		allowAdmin:  allowAdminActions,
		tracer:      tracer,
		now:         time.Now,
		failures:    newFailureLimiter(maxFailuresPerWindow, failureWindow),
	}
}

type PersonalToken struct {
	log         log.Logger
	store       patstore.Store
	userService user.Service
	orgService  org.Service
	enabled     func(context.Context) bool
	orgEnabled  func(context.Context, int64) bool
	allowAdmin  func() bool
	tracer      trace.Tracer
	now         func() time.Time
	failures    *failureLimiter
	proxies     patscope.TrustedProxies
}

// WithTrustedProxies makes the failed-auth limiter honor header (e.g. X-Forwarded-For)
// only when the request comes from one of the given proxy IPs/CIDRs.
func (c *PersonalToken) WithTrustedProxies(header string, proxies []string) *PersonalToken {
	c.proxies = patscope.ParseTrustedProxies(header, proxies)
	return c
}

func (c *PersonalToken) Name() string { return authn.ClientPersonalToken }

// Priority must stay below the API key client, which accepts any bearer token.
func (c *PersonalToken) Priority() uint { return 25 }

func (c *PersonalToken) Test(_ context.Context, r *authn.Request) bool {
	return pattoken.HasPrefix(getTokenFromRequest(r))
}

func (c *PersonalToken) Authenticate(ctx context.Context, r *authn.Request) (*authn.Identity, error) {
	ip := c.clientIP(r)
	if c.failures.blocked(ip, c.now()) {
		return nil, errPersonalTokenInvalid.Errorf("too many failed attempts")
	}
	id, err := c.authenticate(ctx, r)
	if err != nil {
		c.failures.record(ip, c.now())
	}
	return id, err
}

func (c *PersonalToken) authenticate(ctx context.Context, r *authn.Request) (*authn.Identity, error) {
	ctx, span := c.tracer.Start(ctx, "authn.personaltoken.Authenticate")
	defer span.End()

	if !c.enabled(ctx) {
		return nil, errPersonalTokenInvalid.Errorf("personal access tokens are disabled")
	}

	hash, err := pattoken.Parse(getTokenFromRequest(r))
	if err != nil {
		return nil, errPersonalTokenInvalid.Errorf("malformed token")
	}

	if c.isDeniedKubernetes(r.HTTPRequest) {
		return nil, errPersonalTokenInvalid.Errorf("request is not permitted for personal access tokens")
	}
	if !c.allowAdmin() && c.isDenied(r.HTTPRequest) {
		return nil, errPersonalTokenInvalid.Errorf("request is not permitted for personal access tokens")
	}

	tok, err := c.store.GetByHash(ctx, hash)
	if err != nil {
		if errors.Is(err, patstore.ErrNotFound) {
			return nil, errPersonalTokenInvalid.Errorf("unknown token")
		}
		return nil, errPersonalTokenInvalid.Errorf("token lookup failed: %w", err)
	}

	if tok.IsRevoked() || tok.IsExpired(c.now()) {
		return nil, errPersonalTokenInvalid.Errorf("token %s is revoked or expired", tok.UID)
	}
	// A token is bound to its org; requests for another org are rejected.
	if r.OrgID != 0 && r.OrgID != tok.OrgID {
		return nil, errPersonalTokenInvalid.Errorf("token %s used for another org", tok.UID)
	}
	if !c.orgEnabled(ctx, tok.OrgID) {
		return nil, errPersonalTokenInvalid.Errorf("personal access tokens are disabled for org %d", tok.OrgID)
	}
	r.OrgID = tok.OrgID

	owner, err := c.userService.GetByID(ctx, &user.GetUserByIDQuery{ID: tok.UserID})
	if err != nil || owner == nil || owner.IsDisabled {
		return nil, errPersonalTokenInvalid.Errorf("token %s owner is missing or disabled", tok.UID)
	}

	orgs, err := c.orgService.GetUserOrgList(ctx, &org.GetUserOrgListQuery{UserID: tok.UserID})
	if err != nil || !hasOrg(orgs, tok.OrgID) {
		return nil, errPersonalTokenInvalid.Errorf("token %s owner is not a member of the org", tok.UID)
	}

	var scopes map[string][]string
	if tok.Scopes != "" {
		if err := json.Unmarshal([]byte(tok.Scopes), &scopes); err != nil {
			return nil, errPersonalTokenInvalid.Errorf("token %s has unreadable scopes", tok.UID)
		}
	}

	if c.allowAdmin() && c.isDenied(r.HTTPRequest) && !c.routeAllowedFor(r.HTTPRequest, scopes) {
		return nil, errPersonalTokenInvalid.Errorf("request is not permitted for personal access tokens")
	}

	if shouldTouchPersonalToken(tok, c.now()) {
		r.SetMeta(metaKeyPersonalTokenID, strconv.FormatInt(tok.ID, 10))
	}

	return &authn.Identity{
		ID:                  strconv.FormatInt(tok.UserID, 10),
		Type:                claims.TypeUser,
		OrgID:               tok.OrgID,
		AuthenticatedBy:     login.PersonalTokenAuthModule,
		PersonalTokenID:     tok.ID,
		PersonalTokenScopes: nonNilScopes(scopes),
		ClientParams: authn.ClientParams{
			FetchSyncedUser: true,
			SyncPermissions: true,
		},
	}, nil
}

func (c *PersonalToken) IsEnabled(ctx context.Context) bool { return c.enabled(ctx) }

// Hook records last-use asynchronously and never fails the request.
func (c *PersonalToken) Hook(ctx context.Context, _ *authn.Identity, r *authn.Request) error {
	raw := r.GetMeta(metaKeyPersonalTokenID)
	if raw == "" {
		return nil
	}
	id, err := strconv.ParseInt(raw, 10, 64)
	if err != nil {
		return nil
	}

	info := patstore.UsageInfo{}
	if r.HTTPRequest != nil {
		info.IP = c.clientIP(r)
		info.UserAgent = r.HTTPRequest.UserAgent()
	}
	updateCtx := context.WithoutCancel(ctx)
	go func() {
		defer func() {
			if rec := recover(); rec != nil {
				c.log.Error("panic while updating personal token last used", "panic", rec)
			}
		}()
		tctx, cancel := context.WithTimeout(updateCtx, 5*time.Second)
		defer cancel()
		if err := c.store.TouchLastUsed(tctx, id, info); err != nil {
			c.log.Warn("failed to update personal token last used", "tokenId", id, "error", err)
		}
	}()
	return nil
}

func shouldTouchPersonalToken(t *patstore.Token, now time.Time) bool {
	return t.LastUsedAt == nil || now.Sub(*t.LastUsedAt) > personalTokenLastUsedRefresh
}

func hasOrg(orgs []*org.UserOrgDTO, id int64) bool {
	for _, o := range orgs {
		if o.OrgID == id {
			return true
		}
	}
	return false
}

func nonNilScopes(s map[string][]string) map[string][]string {
	if s == nil {
		return map[string][]string{}
	}
	return s
}

func (c *PersonalToken) isDenied(req *http.Request) bool {
	return req != nil && req.URL != nil && patscope.IsDeniedRoute(req.Method, req.URL.Path)
}

func (c *PersonalToken) routeAllowedFor(req *http.Request, scopes patscope.Scopes) bool {
	return patscope.RouteAllowed(req.Method, req.URL.Path, true, func(a string) bool { return patscope.ExplicitAction(scopes, a) })
}

func (c *PersonalToken) isDeniedKubernetes(req *http.Request) bool {
	return req != nil && req.URL != nil && patscope.IsDeniedKubernetesPath(req.URL.Path)
}

func (c *PersonalToken) clientIP(r *authn.Request) string {
	if r == nil || r.HTTPRequest == nil {
		return ""
	}
	return patscope.ClientIP(r.HTTPRequest, c.proxies)
}
