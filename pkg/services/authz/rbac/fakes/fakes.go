package fakes

import (
	"context"
	"fmt"

	"github.com/grafana/authlib/claims"
	"github.com/grafana/grafana/pkg/registry/apis/iam/legacy"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/authz/rbac/store"
)

type FakeStore struct {
	store.Store
	BasicRole       *store.BasicRole
	UserID          *store.UserIdentifiers
	UserPermissions []accesscontrol.Permission
	Err             bool
	Calls           int
}

func (f *FakeStore) GetBasicRoles(ctx context.Context, namespace claims.NamespaceInfo, query store.BasicRoleQuery) (*store.BasicRole, error) {
	f.Calls++
	if f.Err {
		return nil, fmt.Errorf("store error")
	}
	return f.BasicRole, nil
}

func (f *FakeStore) GetUserIdentifiers(ctx context.Context, query store.UserIdentifierQuery) (*store.UserIdentifiers, error) {
	f.Calls++
	if f.Err {
		return nil, fmt.Errorf("store error")
	}
	return f.UserID, nil
}

func (f *FakeStore) GetUserPermissions(ctx context.Context, namespace claims.NamespaceInfo, query store.PermissionsQuery) ([]accesscontrol.Permission, error) {
	f.Calls++
	if f.Err {
		return nil, fmt.Errorf("store error")
	}
	return f.UserPermissions, nil
}

type FakeIdentityStore struct {
	legacy.LegacyIdentityStore
	Teams []int64
	Err   bool
	Calls int
}

func (f *FakeIdentityStore) ListUserTeams(ctx context.Context, namespace claims.NamespaceInfo, query legacy.ListUserTeamsQuery) (*legacy.ListUserTeamsResult, error) {
	f.Calls++
	if f.Err {
		return nil, fmt.Errorf("identity store error")
	}
	items := make([]legacy.UserTeam, 0, len(f.Teams))
	for _, teamID := range f.Teams {
		items = append(items, legacy.UserTeam{ID: teamID})
	}
	return &legacy.ListUserTeamsResult{
		Items:    items,
		Continue: 0,
	}, nil
}
