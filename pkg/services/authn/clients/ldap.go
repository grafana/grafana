package clients

import (
	"context"
	"errors"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/multildap"
	"github.com/grafana/grafana/pkg/setting"
)

var _ authn.PasswordClient = new(LDAP)

func ProvideLDAP(cfg *setting.Cfg) *LDAP {
	return &LDAP{cfg}
}

type LDAP struct {
	cfg *setting.Cfg
}

func (c *LDAP) AuthenticatePassword(ctx context.Context, orgID int64, username, password string) (*authn.Identity, error) {
	cfg, err := multildap.GetConfig(c.cfg)
	if err != nil {
		return nil, err
	}

	client := multildap.New(cfg.Servers)
	info, err := client.Login(&models.LoginUserQuery{
		Username: username,
		Password: password,
	})

	if err != nil {
		// FIXME: disable user in grafana if not found
		if errors.Is(err, multildap.ErrCouldNotFindUser) {
			return nil, errIdentityNotFound.Errorf("no user found: %w", err)
		}
		return nil, err
	}

	return &authn.Identity{
		OrgID:          orgID,
		OrgRoles:       info.OrgRoles,
		Login:          info.Login,
		Name:           info.Name,
		Email:          info.Email,
		IsGrafanaAdmin: info.IsGrafanaAdmin,
		AuthModule:     info.AuthModule,
		AuthID:         info.AuthId,
		LookUpParams: models.UserLookupParams{
			Login: &info.Login,
			Email: &info.Email,
		},
		Groups: info.Groups,
		ClientParams: authn.ClientParams{
			SyncUser:        true,
			SyncTeamMembers: true,
			AllowSignUp:     c.cfg.LDAPAllowSignup,
		},
	}, nil
}
