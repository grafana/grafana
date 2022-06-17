package org

import (
	"context"

	"github.com/grafana/grafana/pkg/services/user"
)

type Service interface {
	GetIDForNewUser(context.Context, user.CreateUserCommand) (int64, error)
}
