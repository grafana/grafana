package store

import (
	"context"
	"errors"
	"testing"

	"github.com/grafana/authlib/types"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/accesscontrol"
)

func TestStaticPermissionStoreGetUserPermissions(t *testing.T) {
	permissions := []accesscontrol.Permission{
		{Action: "dashboards:read", Scope: "dashboards:*"},
		{Action: "folders:read", Scope: "folders:*"},
	}
	store := NewStaticPermissionStore(&staticRoleService{
		roles: map[string]*accesscontrol.RoleDTO{
			"Viewer": {Permissions: permissions},
		},
	})

	t.Run("returns permissions for the requested action", func(t *testing.T) {
		got, err := store.GetUserPermissions(t.Context(), types.NamespaceInfo{}, PermissionsQuery{
			Role:   "Viewer",
			Action: "dashboards:read",
		})

		require.NoError(t, err)
		require.Equal(t, permissions[:1], got)
	})

	t.Run("returns permissions for every action when action is empty", func(t *testing.T) {
		got, err := store.GetUserPermissions(t.Context(), types.NamespaceInfo{}, PermissionsQuery{
			Role: "Viewer",
		})

		require.NoError(t, err)
		require.Equal(t, permissions, got)
	})
}

func TestStaticPermissionStoreHasUserPermissions(t *testing.T) {
	store := NewStaticPermissionStore(&staticRoleService{
		roles: map[string]*accesscontrol.RoleDTO{
			"Viewer": {
				Permissions: []accesscontrol.Permission{
					{Action: "dashboards:read", Scope: "dashboards:*"},
					{Action: "folders:read", Scope: "folders:*"},
				},
			},
			"Grafana Admin": {
				Permissions: []accesscontrol.Permission{
					{Action: "users:create"},
				},
			},
			"None": {},
		},
	})

	for _, tc := range []struct {
		name  string
		query PermissionsQuery
		want  bool
	}{
		{
			name:  "role has permissions",
			query: PermissionsQuery{Role: "Viewer"},
			want:  true,
		},
		{
			name: "requested action exists",
			query: PermissionsQuery{
				Role:   "Viewer",
				Action: "folders:read",
			},
			want: true,
		},
		{
			name: "requested action is absent",
			query: PermissionsQuery{
				Role:   "Viewer",
				Action: "users:create",
			},
			want: false,
		},
		{
			name:  "role has no permissions",
			query: PermissionsQuery{Role: "None"},
			want:  false,
		},
		{
			name:  "role is absent",
			query: PermissionsQuery{Role: "missing"},
			want:  false,
		},
		{
			name: "includes server admin grants",
			query: PermissionsQuery{
				Role:          "Viewer",
				Action:        "users:create",
				IsServerAdmin: true,
			},
			want: true,
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			got, err := store.HasUserPermissions(t.Context(), types.NamespaceInfo{}, tc.query)
			require.NoError(t, err)
			require.Equal(t, tc.want, got)
		})
	}
}

func TestUnionPermissionStoreHasUserPermissions(t *testing.T) {
	storeError := errors.New("permission store unavailable")

	for _, tc := range []struct {
		name      string
		results   []permissionPresenceResult
		want      bool
		wantError error
		wantCalls int
	}{
		{
			name:      "no stores",
			want:      false,
			wantCalls: 0,
		},
		{
			name: "no source has permissions",
			results: []permissionPresenceResult{
				{exists: false},
				{exists: false},
			},
			want:      false,
			wantCalls: 2,
		},
		{
			name: "first source has permissions",
			results: []permissionPresenceResult{
				{exists: true},
				{exists: false},
			},
			want:      true,
			wantCalls: 1,
		},
		{
			name: "later source has permissions",
			results: []permissionPresenceResult{
				{exists: false},
				{exists: true},
			},
			want:      true,
			wantCalls: 2,
		},
		{
			name: "grant skips a later failing source",
			results: []permissionPresenceResult{
				{exists: true},
				{exists: false, err: storeError},
			},
			want:      true,
			wantCalls: 1,
		},
		{
			name: "error without grants",
			results: []permissionPresenceResult{
				{exists: false, err: storeError},
			},
			want:      false,
			wantError: storeError,
			wantCalls: 1,
		},
		{
			name: "error stops before a later grant",
			results: []permissionPresenceResult{
				{exists: false, err: storeError},
				{exists: true},
			},
			want:      false,
			wantError: storeError,
			wantCalls: 1,
		},
		{
			name: "error takes precedence over a grant from the same source",
			results: []permissionPresenceResult{
				{exists: true, err: storeError},
			},
			want:      false,
			wantError: storeError,
			wantCalls: 1,
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			ns := types.NamespaceInfo{Value: "org-12", OrgID: 12}
			query := PermissionsQuery{
				UserID:  1,
				TeamIDs: []int64{10},
				Role:    "Viewer",
			}
			stores := make([]PermissionStore, 0, len(tc.results))
			for _, result := range tc.results {
				stores = append(stores, &permissionPresenceStore{result: result})
			}
			store := NewUnionPermissionStore(stores...)

			got, err := store.HasUserPermissions(t.Context(), ns, query)

			require.ErrorIs(t, err, tc.wantError)
			require.Equal(t, tc.want, got)
			for i, source := range stores {
				recorded := source.(*permissionPresenceStore)
				var wantRequests []permissionPresenceRequest
				if i < tc.wantCalls {
					wantRequests = []permissionPresenceRequest{{namespace: ns, query: query}}
				}
				require.Equal(t, wantRequests, recorded.requests, "source %d", i)
			}
		})
	}
}

type staticRoleService struct {
	accesscontrol.Service
	roles map[string]*accesscontrol.RoleDTO
}

func (s *staticRoleService) GetStaticRoles(context.Context) map[string]*accesscontrol.RoleDTO {
	return s.roles
}

type permissionPresenceResult struct {
	exists bool
	err    error
}

type permissionPresenceRequest struct {
	namespace types.NamespaceInfo
	query     PermissionsQuery
}

type permissionPresenceStore struct {
	PermissionStore
	result   permissionPresenceResult
	requests []permissionPresenceRequest
}

func (s *permissionPresenceStore) HasUserPermissions(
	_ context.Context,
	ns types.NamespaceInfo,
	query PermissionsQuery,
) (bool, error) {
	s.requests = append(s.requests, permissionPresenceRequest{namespace: ns, query: query})
	return s.result.exists, s.result.err
}
