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

const (
	proxyFieldName   = "Name"
	proxyFieldEmail  = "Email"
	proxyFieldLogin  = "Login"
	proxyFieldRole   = "Role"
	proxyFieldGroups = "Groups"
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

func (c *Grafana) AuthenticateProxy(ctx context.Context, r *authn.Request, username string) (*authn.Identity, error) {
	identity := &authn.Identity{
		AuthModule: login.AuthProxyAuthModule,
		AuthID:     username,
		ClientParams: authn.ClientParams{
			SyncUser:        true,
			SyncTeamMembers: true,
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

	if headerName := c.cfg.AuthProxyHeaders[proxyFieldName]; headerName != "" {
		if name := getProxyHeader(r, headerName, c.cfg.AuthProxyHeadersEncoded); name != "" {
			identity.Name = name
		}
	}

	if headerName := c.cfg.AuthProxyHeaders[proxyFieldEmail]; headerName != "" {
		if email := getProxyHeader(r, headerName, c.cfg.AuthProxyHeadersEncoded); email != "" {
			identity.Email = email
		}
	}

	if headerName := c.cfg.AuthProxyHeaders[proxyFieldLogin]; headerName != "" {
		if loginName := getProxyHeader(r, headerName, c.cfg.AuthProxyHeadersEncoded); loginName != "" {
			identity.Login = loginName
		}
	}

	if headerName := c.cfg.AuthProxyHeaders[proxyFieldRole]; headerName != "" {
		role := org.RoleType(getProxyHeader(r, headerName, c.cfg.AuthProxyHeadersEncoded))
		if role.IsValid() {
			orgID := int64(1)
			if c.cfg.AutoAssignOrg && c.cfg.AutoAssignOrgId > 0 {
				orgID = int64(c.cfg.AutoAssignOrgId)
			}
			identity.OrgID = orgID
			identity.OrgRoles = map[int64]org.RoleType{orgID: role}
		}
	}

	if headerName := c.cfg.AuthProxyHeaders[proxyFieldGroups]; headerName != "" {
		identity.Groups = util.SplitString(getProxyHeader(r, headerName, c.cfg.AuthProxyHeadersEncoded))
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

	return authn.IdentityFromSignedInUser(authn.NamespacedID(authn.NamespaceUser, signedInUser.UserID), signedInUser, authn.ClientParams{}), nil
}

func comparePassword(password, salt, hash string) bool {
	// It is ok to ignore the error here because util.EncodePassword can never return a error
	hashedPassword, _ := util.EncodePassword(password, salt)
	return subtle.ConstantTimeCompare([]byte(hashedPassword), []byte(hash)) == 1
}
