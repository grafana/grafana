package org

import (
	"context"
)

//go:generate mockery --name Service --structname MockService --outpkg orgtest --filename mock.go --output ./orgtest/
type Service interface {
	GetIDForNewUser(context.Context, GetOrgIDForNewUserCommand) (int64, error)
	InsertOrgUser(context.Context, *OrgUser) (int64, error)
	DeleteUserFromAll(context.Context, int64) error
	GetUserOrgList(context.Context, *GetUserOrgListQuery) ([]*UserOrgDTO, error)
	UpdateOrg(context.Context, *UpdateOrgCommand) error
	Search(context.Context, *SearchOrgsQuery) ([]*OrgDTO, error)
	GetByID(context.Context, *GetOrgByIDQuery) (*Org, error)
	GetByName(context.Context, *GetOrgByNameQuery) (*Org, error)
	CreateWithMember(context.Context, *CreateOrgCommand) (*Org, error)
	UpdateAddress(context.Context, *UpdateOrgAddressCommand) error
	GetOrCreate(context.Context, string) (int64, error)
	AddOrgUser(context.Context, *AddOrgUserCommand) error
	UpdateOrgUser(context.Context, *UpdateOrgUserCommand) error
	RemoveOrgUser(context.Context, *RemoveOrgUserCommand) error
	GetOrgUsers(context.Context, *GetOrgUsersQuery) ([]*OrgUserDTO, error)
	SearchOrgUsers(context.Context, *SearchOrgUsersQuery) (*SearchOrgUsersQueryResult, error)
	RegisterDelete(query string)
}

type DeletionService interface {
	Delete(context.Context, *DeleteOrgCommand) error
}
