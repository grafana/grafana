package org

import (
	"context"
)

type Service interface {
	GetIDForNewUser(context.Context, GetOrgIDForNewUserCommand) (int64, error)
	InsertUser(context.Context, *OrgUser) (int64, error)
	DeleteUser(context.Context, int64) error
}
