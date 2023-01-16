package clients

import (
	"context"
	"errors"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/multildap"
	"github.com/grafana/grafana/pkg/setting"
)

var _ authn.ProxyClient = new(LDAP)
var _ authn.PasswordClient = new(LDAP)

func ProvideLDAP(cfg *setting.Cfg) *LDAP {
	return &LDAP{cfg, &ldapServiceImpl{cfg}}
}

type LDAP struct {
	cfg     *setting.Cfg
	service ldapService
}

func (c *LDAP) AuthenticateProxy(ctx context.Context, r *authn.Request, username string, _ map[string]string) (*authn.Identity, error) {
	info, err := c.service.User(username)
	if errors.Is(err, multildap.ErrDidNotFindUser) {
		return nil, errIdentityNotFound.Errorf("no user found: %w", err)
	}

	if err != nil {
		return nil, err
	}

	return identityFromLDAPInfo(r.OrgID, info, c.cfg.LDAPAllowSignup), nil
}

func (c *LDAP) AuthenticatePassword(ctx context.Context, r *authn.Request, username, password string) (*authn.Identity, error) {
	info, err := c.service.Login(&models.LoginUserQuery{
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

	return identityFromLDAPInfo(r.OrgID, info, c.cfg.LDAPAllowSignup), nil
}

type ldapService interface {
	Login(query *models.LoginUserQuery) (*models.ExternalUserInfo, error)
	User(username string) (*models.ExternalUserInfo, error)
}

// FIXME: remove the implementation if we convert ldap to an actual service
type ldapServiceImpl struct {
	cfg *setting.Cfg
}

func (s *ldapServiceImpl) Login(query *models.LoginUserQuery) (*models.ExternalUserInfo, error) {
	cfg, err := multildap.GetConfig(s.cfg)
	if err != nil {
		return nil, err
	}

	return multildap.New(cfg.Servers).Login(query)
}

func (s *ldapServiceImpl) User(username string) (*models.ExternalUserInfo, error) {
	cfg, err := multildap.GetConfig(s.cfg)
	if err != nil {
		return nil, err
	}

	user, _, err := multildap.New(cfg.Servers).User(username)
	return user, err
}

func identityFromLDAPInfo(orgID int64, info *models.ExternalUserInfo, allowSignup bool) *authn.Identity {
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
			LookUpParams: models.UserLookupParams{
				Login: &info.Login,
				Email: &info.Email,
			},
		},
	}
}
