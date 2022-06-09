package org

import (
	"github.com/grafana/grafana/pkg/services/user"
)

type Service interface {
	// Create(context.Context, *CreateOrgCommand) (*Org, error)
	GetIDForNewUser(user.CreateUserCommand) (int64, error)
}
