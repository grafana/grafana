package clients

import (
	"context"
	"errors"

	"go.opentelemetry.io/otel/trace"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/radius"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

var _ authn.PasswordClient = new(RADIUS)

type radiusService interface {
	Login(query *login.LoginUserQuery) (*login.ExternalUserInfo, error)
	User(username string) (*login.ExternalUserInfo, error)
}

func ProvideRADIUS(cfg *setting.Cfg, radiusService radiusService, userService user.Service, authInfoService login.AuthInfoService, tracer trace.Tracer) *RADIUS {
	return &RADIUS{
		cfg:             cfg,
		logger:          log.New("authn.radius"),
		service:         radiusService,
		userService:     userService,
		authInfoService: authInfoService,
		tracer:          tracer,
	}
}

type RADIUS struct {
	cfg             *setting.Cfg
	logger          log.Logger
	service         radiusService
	userService     user.Service
	authInfoService login.AuthInfoService
	tracer          trace.Tracer
}

func (c *RADIUS) String() string {
	return "radius"
}

func (c *RADIUS) AuthenticatePassword(ctx context.Context, r *authn.Request, username, password string) (*authn.Identity, error) {
	ctx, span := c.tracer.Start(ctx, "authn.radius.AuthenticatePassword")
	defer span.End()

	info, err := c.service.Login(&login.LoginUserQuery{
		Username: username,
		Password: password,
	})

	if errors.Is(err, radius.ErrInvalidCredentials) {
		return nil, errInvalidPassword.Errorf("invalid password: %w", err)
	}

	if err != nil {
		return nil, err
	}

	// user was found so set auth module in req metadata
	r.SetMeta(authn.MetaKeyAuthModule, "radius")

	return c.identityFromRADIUSInfo(r.OrgID, info), nil
}

func (c *RADIUS) identityFromRADIUSInfo(orgID int64, info *login.ExternalUserInfo) *authn.Identity {
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
			SyncOrgRoles:    !c.cfg.RADIUSSkipOrgRoleSync,
			AllowSignUp:     c.cfg.RADIUSAllowSignup,
			LookUpParams: login.UserLookupParams{
				Login: &info.Login,
				Email: &info.Email,
			},
		},
	}
}
