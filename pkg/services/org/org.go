package org

import (
	"context"
)

type Service interface {
	GetIDForNewUser(context.Context, GetOrgIDForNewUserCommand) (int64, error)
	InsertOrgUser(context.Context, *OrgUser) (int64, error)
	DeleteUserFromAll(context.Context, int64) error
	GetUserOrgList(context.Context, *GetUserOrgListQuery) ([]*UserOrgDTO, error)
	UpdateOrg(ctx context.Context, cmd *UpdateOrgCommand) error
}
