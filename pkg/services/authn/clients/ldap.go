package clients

import (
	"context"
	"errors"

	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/ldap/multildap"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/setting"
)

var _ authn.ProxyClient = new(LDAP)
var _ authn.PasswordClient = new(LDAP)

type ldapService interface {
	Login(query *login.LoginUserQuery) (*login.ExternalUserInfo, error)
	User(username string) (*login.ExternalUserInfo, error)
}

func ProvideLDAP(cfg *setting.Cfg, ldapService ldapService) *LDAP {
	return &LDAP{cfg, ldapService}
}

type LDAP struct {
	cfg     *setting.Cfg
	service ldapService
}

func (c *LDAP) String() string {
	return "ldap"
}

func (c *LDAP) AuthenticateProxy(ctx context.Context, r *authn.Request, username string, _ map[string]string) (*authn.Identity, error) {
	info, err := c.service.User(username)
	if errors.Is(err, multildap.ErrDidNotFindUser) {
		return nil, errIdentityNotFound.Errorf("no user found: %w", err)
	}

	if err != nil {
		return nil, err
	}

	return c.identityFromLDAPInfo(r.OrgID, info), nil
}

func (c *LDAP) AuthenticatePassword(ctx context.Context, r *authn.Request, username, password string) (*authn.Identity, error) {
	info, err := c.service.Login(&login.LoginUserQuery{
		Username: username,
		Password: password,
	})

	if errors.Is(err, multildap.ErrCouldNotFindUser) {
		// FIXME: disable user in grafana if not found
		return nil, errIdentityNotFound.Errorf("no user found: %w", err)
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

func (c *LDAP) identityFromLDAPInfo(orgID int64, info *login.ExternalUserInfo) *authn.Identity {
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
			SyncTeams:           true,
			EnableDisabledUsers: true,
			FetchSyncedUser:     true,
			SyncPermissions:     true,
			SyncOrgRoles:        !c.cfg.LDAPSkipOrgRoleSync,
			AllowSignUp:         c.cfg.LDAPAllowSignup,
			LookUpParams: login.UserLookupParams{
				Login: &info.Login,
				Email: &info.Email,
			},
		},
	}
}
