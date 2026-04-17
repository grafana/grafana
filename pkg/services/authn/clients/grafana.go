package clients

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"errors"
	"net/mail"
	"sort"
	"strconv"
	"strings"

	"go.opentelemetry.io/otel/trace"

	claims "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/middleware/cookies"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/contexthandler/ctxkey"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

var _ authn.ProxyClient = new(Grafana)
var _ authn.PasswordClient = new(Grafana)

func ProvideGrafana(cfg *setting.Cfg, userService user.Service, tracer trace.Tracer) *Grafana {
	return &Grafana{cfg, userService, tracer}
}

type Grafana struct {
	cfg         *setting.Cfg
	userService user.Service
	tracer      trace.Tracer
}

func (c *Grafana) String() string {
	return "grafana"
}

func (c *Grafana) AuthenticateProxy(ctx context.Context, r *authn.Request, username string, additional map[string]string) (*authn.Identity, error) {
	ctx, span := c.tracer.Start(ctx, "authn.grafana.AuthenticateProxy") //nolint:ineffassign,staticcheck
	defer span.End()

	identity := &authn.Identity{
		AuthenticatedBy: login.AuthProxyAuthModule,
		AuthID:          username,
		ClientParams: authn.ClientParams{
			SyncUser:        true,
			SyncTeams:       true,
			FetchSyncedUser: true,
			SyncOrgRoles:    true,
			SyncPermissions: true,
			AllowSignUp:     c.cfg.AuthProxy.AutoSignUp,
		},
	}

	switch c.cfg.AuthProxy.HeaderProperty {
	case "username":
		identity.Login = username
		addr, err := mail.ParseAddress(username)
		if err == nil {
			identity.Email = addr.Address
		}
	case "email":
		identity.Login = username
		identity.Email = username
	default:
		return nil, errInvalidProxyHeader.Errorf("invalid auth proxy header property, expected username or email but got: %s", c.cfg.AuthProxy.HeaderProperty)
	}

	if v, ok := additional[proxyFieldName]; ok {
		identity.Name = v
	}

	if v, ok := additional[proxyFieldEmail]; ok {
		identity.Email = v
	}

	if v, ok := additional[proxyFieldLogin]; ok {
		identity.Login = v
	}

	if v, ok := additional[proxyFieldRole]; ok {
		orgRoles, isGrafanaAdmin, _ := getRoles(c.cfg, func() (org.RoleType, *bool, error) {
			return org.RoleType(v), nil, nil
		})
		identity.OrgRoles = orgRoles
		identity.IsGrafanaAdmin = isGrafanaAdmin
	}

	if v, ok := additional[proxyFieldGroups]; ok {
		identity.Groups = util.SplitString(v)

		// Hash the list of groups and compare it to the hash stored in the client's
		// cookie. If the hashes match, skip team sync because the teams haven't changed.
		groupsHash := hashGroups(c.cfg.SecretKey, identity.Groups)
		identity.ClientParams.SyncTeams = shouldSyncTeams(r, groupsHash)
		if identity.ClientParams.SyncTeams {
			c.writeGroupsHashCookie(ctx, groupsHash)
		}
	}

	identity.ClientParams.LookUpParams.Email = &identity.Email
	identity.ClientParams.LookUpParams.Login = &identity.Login

	return identity, nil
}

func (c *Grafana) AuthenticatePassword(ctx context.Context, r *authn.Request, username, password string) (*authn.Identity, error) {
	ctx, span := c.tracer.Start(ctx, "authn.grafana.AuthenticatePassword")
	defer span.End()

	usr, err := c.userService.GetByLoginWithPassword(ctx, &user.GetUserByLoginQuery{LoginOrEmail: username})
	if err != nil {
		if errors.Is(err, user.ErrUserNotFound) {
			return nil, errIdentityNotFound.Errorf("no user found: %w", err)
		}
		return nil, err
	}

	// user was found so set auth module in req metadata
	r.SetMeta(authn.MetaKeyAuthModule, "grafana")

	if ok := comparePassword(password, usr.Salt, string(usr.Password)); !ok {
		return nil, errInvalidPassword.Errorf("invalid password")
	}

	return &authn.Identity{
		ID:              strconv.FormatInt(usr.ID, 10),
		Type:            claims.TypeUser,
		OrgID:           r.OrgID,
		ClientParams:    authn.ClientParams{FetchSyncedUser: true, SyncPermissions: true},
		AuthenticatedBy: login.PasswordAuthModule,
	}, nil
}

func comparePassword(password, salt, hash string) bool {
	// It is ok to ignore the error here because util.EncodePassword can never return a error
	hashedPassword, _ := util.EncodePassword(password, salt)
	return subtle.ConstantTimeCompare([]byte(hashedPassword), []byte(hash)) == 1
}

const (
	proxyGroupsCookie       = "grafana_proxy_groups_hash"
	proxyGroupsCookieMaxAge = 7 * 24 * 60 * 60 // 7 days in seconds
)

// hashGroups sorts and hashes the list of groups supplied by the proxy. HMAC is
// used here to prevent bypassing team sync with a forged hash in the cookie.
func hashGroups(secretKey string, groups []string) string {
	sorted := make([]string, len(groups))
	copy(sorted, groups)
	sort.Strings(sorted)

	mac := hmac.New(sha256.New, []byte(secretKey))
	_, _ = mac.Write([]byte(strings.Join(sorted, "\x00")))

	return hex.EncodeToString(mac.Sum(nil))
}

func shouldSyncTeams(r *authn.Request, groupsHash string) bool {
	cookie, err := r.HTTPRequest.Cookie(proxyGroupsCookie)
	return err != nil || cookie.Value != groupsHash
}

func (c *Grafana) writeGroupsHashCookie(ctx context.Context, groupsHash string) {
	// contexthandler.FromContext() is inlined here to avoid an import loop.
	reqCtx, ok := ctx.Value(ctxkey.Key{}).(*contextmodel.ReqContext)
	if !ok {
		return
	}

	cookies.WriteCookie(reqCtx.Resp, proxyGroupsCookie, groupsHash, proxyGroupsCookieMaxAge, cookies.NewCookieOptions)
}
