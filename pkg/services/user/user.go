package user

import (
	"context"
)

type Service interface {
	Create(context.Context, *CreateUserCommand) (*User, error)
	Delete(context.Context, *DeleteUserCommand) error
	GetByID(context.Context, *GetUserByIDQuery) (*User, error)
	GetByLogin(context.Context, *GetUserByLoginQuery) (*User, error)
	GetByEmail(context.Context, *GetUserByEmailQuery) (*User, error)
	Update(context.Context, *UpdateUserCommand) error
	ChangePassword(context.Context, *ChangeUserPasswordCommand) error
	UpdateLastSeenAt(context.Context, *UpdateUserLastSeenAtCommand) error
}
