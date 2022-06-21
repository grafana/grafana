package org

import (
	"context"
)

type Service interface {
	GetIDForNewUser(context.Context, GetOrgIDForNewUserCommand) (int64, error)
}
