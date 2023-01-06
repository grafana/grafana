package tempuser

import (
	"context"
)

type Service interface {
	UpdateTempUserStatus(ctx context.Context, cmd *UpdateTempUserStatusCommand) error
	CreateTempUser(ctx context.Context, cmd *CreateTempUserCommand) (*TempUser, error)
	UpdateTempUserWithEmailSent(ctx context.Context, cmd *UpdateTempUserWithEmailSentCommand) error
	GetTempUsersQuery(ctx context.Context, query *GetTempUsersQuery) ([]*TempUserDTO, error)
	GetTempUserByCode(ctx context.Context, query *GetTempUserByCodeQuery) (*TempUserDTO, error)
	ExpireOldUserInvites(ctx context.Context, cmd *ExpireTempUsersCommand) error
}
