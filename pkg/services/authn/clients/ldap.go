package clients

import (
	"context"
	"errors"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/multildap"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

var _ authn.ProxyClient = new(LDAP)
var _ authn.PasswordClient = new(LDAP)

func ProvideLDAP(cfg *setting.Cfg, userService user.Service, authInfoService login.AuthInfoService) *LDAP {
	return &LDAP{cfg, log.New("authn.ldap"), &ldapServiceImpl{cfg}, userService, authInfoService}
}

type LDAP struct {
	cfg             *setting.Cfg
	logger          log.Logger
	service         ldapService
	userService     user.Service
	authInfoService login.AuthInfoService
}

func (c *LDAP) AuthenticateProxy(ctx context.Context, r *authn.Request, username string, _ map[string]string) (*authn.Identity, error) {
	info, err := c.service.User(username)
	if errors.Is(err, multildap.ErrDidNotFindUser) {
		return c.disableUser(ctx, username)
	}

	if err != nil {
		return nil, err
	}

	return identityFromLDAPInfo(r.OrgID, info, c.cfg.LDAPAllowSignup), nil
}

func (c *LDAP) AuthenticatePassword(ctx context.Context, r *authn.Request, username, password string) (*authn.Identity, error) {
	info, err := c.service.Login(&login.LoginUserQuery{
		Username: username,
		Password: password,
	})

	if errors.Is(err, multildap.ErrCouldNotFindUser) {
		return c.disableUser(ctx, username)
	}

	// user was found so set auth module in req metadata
	r.SetMeta(authn.MetaKeyAuthModule, "ldap")

	if errors.Is(err, multildap.ErrInvalidCredentials) {
		return nil, errInvalidPassword.Errorf("invalid password: %w", err)
	}

	if err != nil {
		return nil, err
	}

	return identityFromLDAPInfo(r.OrgID, info, c.cfg.LDAPAllowSignup), nil
}

// disableUser will disable users if they logged in via LDAP previously
func (c *LDAP) disableUser(ctx context.Context, username string) (*authn.Identity, error) {
	c.logger.Debug("user was not found in the LDAP directory tree", "username", username)
	retErr := errIdentityNotFound.Errorf("no user found: %w", multildap.ErrDidNotFindUser)

	// Retrieve the user from store based on the login
	dbUser, errGet := c.userService.GetByLogin(ctx, &user.GetUserByLoginQuery{
		LoginOrEmail: username,
	})
	if errors.Is(errGet, user.ErrUserNotFound) {
		return nil, retErr
	} else if errGet != nil {
		return nil, errGet
	}

	// Check if the user logged in via LDAP
	query := &login.GetAuthInfoQuery{UserId: dbUser.ID, AuthModule: login.LDAPAuthModule}
	errGetAuthInfo := c.authInfoService.GetAuthInfo(ctx, query)
	if errors.Is(errGetAuthInfo, user.ErrUserNotFound) {
		return nil, retErr
	} else if errGetAuthInfo != nil {
		return nil, errGetAuthInfo
	}

	// Disable the user
	c.logger.Debug("user was removed from the LDAP directory tree, disabling it", "username", username, "authID", query.Result.AuthId)
	if errDisable := c.userService.Disable(ctx, &user.DisableUserCommand{UserID: dbUser.ID, IsDisabled: true}); errDisable != nil {
		return nil, errDisable
	}

	return nil, retErr
}

type ldapService interface {
	Login(query *login.LoginUserQuery) (*login.ExternalUserInfo, error)
	User(username string) (*login.ExternalUserInfo, error)
}

// FIXME: remove the implementation if we convert ldap to an actual service
type ldapServiceImpl struct {
	cfg *setting.Cfg
}

func (s *ldapServiceImpl) Login(query *login.LoginUserQuery) (*login.ExternalUserInfo, error) {
	cfg, err := multildap.GetConfig(s.cfg)
	if err != nil {
		return nil, err
	}

	return multildap.New(cfg.Servers).Login(query)
}

func (s *ldapServiceImpl) User(username string) (*login.ExternalUserInfo, error) {
	cfg, err := multildap.GetConfig(s.cfg)
	if err != nil {
		return nil, err
	}

	user, _, err := multildap.New(cfg.Servers).User(username)
	return user, err
}

func identityFromLDAPInfo(orgID int64, info *login.ExternalUserInfo, allowSignup bool) *authn.Identity {
	return &authn.Identity{
		OrgID:          orgID,
		OrgRoles:       info.OrgRoles,
		Login:          info.Login,
		Name:           info.Name,
		Email:          info.Email,
		IsGrafanaAdmin: info.IsGrafanaAdmin,
		AuthModule:     info.AuthModule,
		AuthID:         info.AuthId,
		Groups:         info.Groups,
		ClientParams: authn.ClientParams{
			SyncUser:            true,
			SyncTeamMembers:     true,
			AllowSignUp:         allowSignup,
			EnableDisabledUsers: true,
			LookUpParams: login.UserLookupParams{
				Login: &info.Login,
				Email: &info.Email,
			},
		},
	}
}
