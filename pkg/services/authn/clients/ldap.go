package clients

import (
	"context"
	"errors"

	"go.opentelemetry.io/otel/trace"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/ldap/multildap"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

var (
	_ authn.ProxyClient    = new(LDAP)
	_ authn.PasswordClient = new(LDAP)
)

type ldapService interface {
	Login(query *login.LoginUserQuery) (*login.ExternalUserInfo, error)
	User(username string) (*login.ExternalUserInfo, error)
}

func ProvideLDAP(cfg *setting.Cfg, ldapService ldapService, userService user.Service, authInfoService login.AuthInfoService, tracer trace.Tracer) *LDAP {
	return &LDAP{cfg, log.New("authn.ldap"), ldapService, userService, authInfoService, tracer}
}

type LDAP struct {
	cfg             *setting.Cfg
	logger          log.Logger
	service         ldapService
	userService     user.Service
	authInfoService login.AuthInfoService
	tracer          trace.Tracer
}

func (c *LDAP) String() string {
	return "ldap"
}

func (c *LDAP) AuthenticateProxy(ctx context.Context, r *authn.Request, username string, _ map[string]string) (*authn.Identity, error) {
	ctx, span := c.tracer.Start(ctx, "authn.ldap.AuthenticateProxy")
	defer span.End()
	info, err := c.service.User(username)
	if errors.Is(err, multildap.ErrDidNotFindUser) {
		return c.disableUser(ctx, username)
	}

	if err != nil {
		return nil, err
	}

	return c.identityFromLDAPInfo(r.OrgID, info), nil
}

func (c *LDAP) AuthenticatePassword(ctx context.Context, r *authn.Request, username, password string) (*authn.Identity, error) {
	ctx, span := c.tracer.Start(ctx, "authn.ldap.AuthenticatePassword")
	defer span.End()
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

	return c.identityFromLDAPInfo(r.OrgID, info), nil
}

// disableUser will disable users if they logged in via LDAP previously
func (c *LDAP) disableUser(ctx context.Context, username string) (*authn.Identity, error) {
	ctx, span := c.tracer.Start(ctx, "authn.ldap.disableUser")
	defer span.End()
	c.logger.Debug("User was not found in the LDAP directory tree", "username", username)
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
	authinfo, errGetAuthInfo := c.authInfoService.GetAuthInfo(ctx, query)
	if errors.Is(errGetAuthInfo, user.ErrUserNotFound) {
		return nil, retErr
	} else if errGetAuthInfo != nil {
		return nil, errGetAuthInfo
	}

	// Disable the user
	c.logger.Debug("User was removed from the LDAP directory tree, disabling it", "username", username, "authID", authinfo.AuthId)
	isDiabled := true
	if errDisable := c.userService.Update(ctx, &user.UpdateUserCommand{UserID: dbUser.ID, IsDisabled: &isDiabled}); errDisable != nil {
		return nil, errDisable
	}

	return nil, retErr
}

func (c *LDAP) identityFromLDAPInfo(orgID int64, info *login.ExternalUserInfo) *authn.Identity {
	return &authn.Identity{
		OrgID:           orgID,
		OrgRoles:        info.OrgRoles,
		Login:           info.Login,
		Name:            info.Name,
		Email:           info.Email,
		IsGrafanaAdmin:  info.IsGrafanaAdmin,
		AuthenticatedBy: info.AuthModule,
		AuthID:          info.AuthId,
		Groups:          info.Groups,
		ClientParams: authn.ClientParams{
			SyncUser:        true,
			SyncTeams:       true,
			EnableUser:      true,
			FetchSyncedUser: true,
			SyncPermissions: true,
			SyncOrgRoles:    !c.cfg.LDAPSkipOrgRoleSync,
			AllowSignUp:     c.cfg.LDAPAllowSignup,
			LookUpParams: login.UserLookupParams{
				Login: &info.Login,
				Email: &info.Email,
			},
		},
	}
}
