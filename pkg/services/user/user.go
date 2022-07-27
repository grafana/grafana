package user

import (
	"context"
)

type Service interface {
	Create(context.Context, *CreateUserCommand) (*User, error)
	Delete(context.Context, *DeleteUserCommand) error
}
