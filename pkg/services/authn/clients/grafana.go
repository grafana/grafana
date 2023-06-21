package clients

import (
	"context"
	"crypto/subtle"
	"errors"
	"net/mail"

	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

var _ authn.ProxyClient = new(Grafana)
var _ authn.PasswordClient = new(Grafana)

func ProvideGrafana(cfg *setting.Cfg, userService user.Service) *Grafana {
	return &Grafana{cfg, userService}
}

type Grafana struct {
	cfg         *setting.Cfg
	userService user.Service
}

func (c *Grafana) String() string {
	return "grafana"
}

func (c *Grafana) AuthenticateProxy(ctx context.Context, r *authn.Request, username string, additional map[string]string) (*authn.Identity, error) {
	identity := &authn.Identity{
		AuthModule: login.AuthProxyAuthModule,
		AuthID:     username,
		ClientParams: authn.ClientParams{
			SyncUser:        true,
			SyncTeams:       true,
			FetchSyncedUser: true,
			SyncOrgRoles:    true,
			SyncPermissions: true,
			AllowSignUp:     c.cfg.AuthProxyAutoSignUp,
		},
	}

	switch c.cfg.AuthProxyHeaderProperty {
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
		return nil, errInvalidProxyHeader.Errorf("invalid auth proxy header property, expected username or email but got: %s", c.cfg.AuthProxyHeaderProperty)
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
	usr, err := c.userService.GetByLogin(ctx, &user.GetUserByLoginQuery{LoginOrEmail: username})
	if err != nil {
		if errors.Is(err, user.ErrUserNotFound) {
			return nil, errIdentityNotFound.Errorf("no user fund: %w", err)
		}
		return nil, err
	}

	// user was found so set auth module in req metadata
	r.SetMeta(authn.MetaKeyAuthModule, "grafana")

	if ok := comparePassword(password, usr.Salt, usr.Password); !ok {
		return nil, errInvalidPassword.Errorf("invalid password")
	}

	signedInUser, err := c.userService.GetSignedInUserWithCacheCtx(ctx, &user.GetSignedInUserQuery{OrgID: r.OrgID, UserID: usr.ID})
	if err != nil {
		return nil, err
	}

	return authn.IdentityFromSignedInUser(authn.NamespacedID(authn.NamespaceUser, signedInUser.UserID), signedInUser, authn.ClientParams{SyncPermissions: true}), nil
}

func comparePassword(password, salt, hash string) bool {
	// It is ok to ignore the error here because util.EncodePassword can never return a error
	hashedPassword, _ := util.EncodePassword(password, salt)
	return subtle.ConstantTimeCompare([]byte(hashedPassword), []byte(hash)) == 1
}
