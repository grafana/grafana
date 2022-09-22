package org

import (
	"context"
)

type Service interface {
	GetIDForNewUser(context.Context, GetOrgIDForNewUserCommand) (int64, error)
	InsertOrgUser(context.Context, *OrgUser) (int64, error)
	DeleteUserFromAll(context.Context, int64) error
	GetUserOrgList(context.Context, *GetUserOrgListQuery) ([]*UserOrgDTO, error)
	UpdateOrg(context.Context, *UpdateOrgCommand) error
	Search(context.Context, *SearchOrgsQuery) ([]*OrgDTO, error)
	GetByID(context.Context, *GetOrgByIdQuery) (*Org, error)
	GetByNameHandler(context.Context, *GetOrgByNameQuery) (*Org, error)
	GetByName(string) (*Org, error)
	CreateWithMember(string, int64) (*Org, error)
	Create(context.Context, *CreateOrgCommand) (*Org, error)
	UpdateAddress(context.Context, *UpdateOrgAddressCommand) error
	Delete(context.Context, *DeleteOrgCommand) error
	GetOrCreate(context.Context, string) (int64, error)
}
