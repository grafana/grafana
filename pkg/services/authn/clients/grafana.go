package clients

import (
	"context"
	"crypto/subtle"
	"errors"
	"fmt"
	"net/mail"
	"strconv"

	"go.opentelemetry.io/otel/trace"

	claims "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

var _ authn.ProxyClient = new(Grafana)
var _ authn.PasswordClient = new(Grafana)

func ProvideGrafana(cfg *setting.Cfg, userService user.Service, tracer trace.Tracer) *Grafana {
	return &Grafana{cfg: cfg, userService: userService, tracer: tracer, log: log.New("authn.grafana")}
}

type Grafana struct {
	cfg         *setting.Cfg
	userService user.Service
	tracer      trace.Tracer
	log         log.Logger
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
	}

	identity.ClientParams.LookUpParams.Email = &identity.Email
	identity.ClientParams.LookUpParams.Login = &identity.Login

	return identity, nil
}

func (c *Grafana) AuthenticatePassword(ctx context.Context, r *authn.Request, username, password string) (*authn.Identity, error) {
	ctx, span := c.tracer.Start(ctx, "authn.grafana.AuthenticatePassword")
	defer span.End()

	usr, err := c.userService.GetByLogin(ctx, &user.GetUserByLoginQuery{LoginOrEmail: username})
	if err != nil {
		if errors.Is(err, user.ErrUserNotFound) {
			return nil, errIdentityNotFound.Errorf("no user found: %w", err)
		}
		return nil, err
	}

	// user was found so set auth module in req metadata
	r.SetMeta(authn.MetaKeyAuthModule, "grafana")

	ok, err := comparePassword(password, usr.Salt, string(usr.Password))
	if err != nil {
		return nil, err
	}

	if !ok {
		return nil, errInvalidPassword.Errorf("invalid password")
	}

	// After successful legacy password verification, upgrade to a FIPS-compliant salt
	// if the stored salt is shorter than 16 bytes (32 hex chars).
	// See: GitHub issue #120561, comment by xnox
	if len(usr.Salt) < 32 {
		newSalt, err := util.GeneratePasswordSalt()
		if err != nil {
			c.log.Warn("failed to generate password salt during migration", "userID", usr.ID, "error", err)
		} else {
			newSaltCopy := newSalt
			newPassword := user.Password(password)
			if err := c.userService.Update(ctx, &user.UpdateUserCommand{
				UserID:   usr.ID,
				Salt:     &newSaltCopy,
				Password: &newPassword,
			}); err != nil {
				// Log but don't fail login — migration is best-effort
				c.log.Warn(
					"failed to upgrade password salt to FIPS-compliant length",
					"userID", usr.ID,
					"error", err,
				)
			}
		}
	}

	return &authn.Identity{
		ID:              strconv.FormatInt(usr.ID, 10),
		Type:            claims.TypeUser,
		OrgID:           r.OrgID,
		ClientParams:    authn.ClientParams{FetchSyncedUser: true, SyncPermissions: true},
		AuthenticatedBy: login.PasswordAuthModule,
	}, nil
}

func comparePassword(password, salt, hash string) (bool, error) {
	if salt == "" {
		return false, nil
	}

	// Step 1: Try standard PBKDF2 (FIPS-compliant path).
	// This will fail on FIPS systems if salt < 16 bytes.
	hashedPassword, err := util.EncodePassword(password, salt)
	if err != nil {
		// Step 2: Salt is too short for FIPS module.
		// Fall back to pure-Go PBKDF2 which bypasses FIPS enforcement.
		// This is intentional and approved for legacy migration only.
		// See: GitHub issue #120561, comment by xnox
		hashedPassword, err = util.EncodePasswordLegacy(password, salt)
		if err != nil {
			return false, fmt.Errorf("password comparison failed: %w", err)
		}
	}

	return subtle.ConstantTimeCompare([]byte(hashedPassword), []byte(hash)) == 1, nil
}
