package sync

import (
	"context"

	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/user"
)

type LegacyUserProxy struct {
	userService user.Service
}

func NewLegacyUserProxy(userService user.Service) UserProxy {
	return &LegacyUserProxy{userService: userService}
}

func (p *LegacyUserProxy) GetByUserAuth(ctx context.Context, userAuth *login.UserAuth) (*user.User, error) {
	return p.userService.GetByID(ctx, &user.GetUserByIDQuery{ID: userAuth.UserId})
}

func (p *LegacyUserProxy) GetByEmail(ctx context.Context, email string) (*user.User, error) {
	return p.userService.GetByEmail(ctx, &user.GetUserByEmailQuery{Email: email})
}

func (p *LegacyUserProxy) GetByLogin(ctx context.Context, login string) (*user.User, error) {
	return p.userService.GetByLogin(ctx, &user.GetUserByLoginQuery{LoginOrEmail: login})
}

func (p *LegacyUserProxy) GetSignedInUser(ctx context.Context, userID int64, orgID int64) (*user.SignedInUser, error) {
	return p.userService.GetSignedInUser(ctx, &user.GetSignedInUserQuery{UserID: userID, OrgID: orgID})
}

func (p *LegacyUserProxy) Create(ctx context.Context, cmd *user.CreateUserCommand) (*user.User, error) {
	return p.userService.Create(ctx, cmd)
}

func (p *LegacyUserProxy) Update(ctx context.Context, cmd *user.UpdateUserCommand) error {
	return p.userService.Update(ctx, cmd)
}

func (p *LegacyUserProxy) UpdateLastSeenAt(ctx context.Context, userID int64, orgID int64) error {
	return p.userService.UpdateLastSeenAt(ctx, &user.UpdateUserLastSeenAtCommand{UserID: userID, OrgID: orgID})
}
