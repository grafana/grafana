package org

import (
	"context"

	"github.com/grafana/grafana/pkg/services/user"
)

type Service interface {
	// Create(context.Context, *CreateOrgCommand) (*Org, error)
	GetIDForNewUser(context.Context, user.CreateUserCommand) (int64, error)
}
