package rbac

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/require"
	"google.golang.org/protobuf/proto"
	"k8s.io/apiserver/pkg/endpoints/request"

	"github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/acimpl"
	authzextv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
	"github.com/grafana/grafana/pkg/services/authz/rbac/store"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/user"
)

func TestWithLegacyScopeResolversCreatesNewService(t *testing.T) {
	ac := acimpl.ProvideAccessControlTest()
	original := NewTestService("u-1", []accesscontrol.Permission{
		{
			Action: "folders:write",
			Scope:  "folders:uid:parent",
		},
	}, nil)
	withResolvers := original.WithLegacyScopeResolvers(acimpl.ProvideScopeResolverRegistry(ac), types.OrgNamespaceFormatter)
	withoutResolvers := withResolvers.WithLegacyScopeResolvers(accesscontrol.NewScopeResolverRegistry(), types.OrgNamespaceFormatter)
	require.NotSame(t, original, withResolvers)
	require.NotSame(t, withResolvers, withoutResolvers)

	ac.RegisterScopeAttributeResolver(folder.NewFolderUIDScopeResolver(&legacyResolverFolders{
		parents: []*folder.Folder{{UID: "parent"}},
	}))

	for _, tc := range []struct {
		name    string
		service *Service
		allowed bool
	}{
		{
			name:    "original remains without resolvers",
			service: original,
			allowed: false,
		},
		{
			name:    "configured service sees late registration after creating another copy",
			service: withResolvers,
			allowed: true,
		},
		{
			name:    "second copy uses its own resolver configuration",
			service: withoutResolvers,
			allowed: false,
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			req := legacyPermissionRequest("user:u-1", "folders:write", "folders:uid:child")
			got, err := tc.service.LegacyCheck(legacyCheckContext(t), req)
			require.NoError(t, err)
			want := &authzextv1.LegacyCheckResponse{Allowed: tc.allowed}
			require.True(t, proto.Equal(want, got), "want %v, got %v", want, got)
		})
	}
}

func TestLegacyCheckReusesLateFolderRegistration(t *testing.T) {
	ac := acimpl.ProvideAccessControlTest()
	s := NewTestService("u-1", []accesscontrol.Permission{
		{
			Action: "folders:write",
			Scope:  "folders:uid:parent",
		},
	}, nil).WithLegacyScopeResolvers(acimpl.ProvideScopeResolverRegistry(ac), types.OrgNamespaceFormatter)
	req := legacyPermissionRequest("user:u-1", "folders:write", "folders:uid:child", "folders:uid:child")

	got, err := s.LegacyCheck(legacyCheckContext(t), req)
	require.NoError(t, err)
	want := &authzextv1.LegacyCheckResponse{Allowed: false}
	require.True(t, proto.Equal(want, got), "want %v, got %v", want, got)

	folders := &legacyResolverFolders{
		parents: []*folder.Folder{{UID: "parent"}},
	}
	ac.RegisterScopeAttributeResolver(folder.NewFolderUIDScopeResolver(folders))

	// Warm Access Control's cache with the same real resolver instance.
	allowed, err := ac.Evaluate(t.Context(), &user.SignedInUser{
		OrgID: 12,
		Permissions: map[int64]map[string][]string{
			12: {"folders:write": {"folders:uid:parent"}},
		},
	}, accesscontrol.EvalPermission("folders:write", "folders:uid:child"))
	require.NoError(t, err)
	require.True(t, allowed)
	require.Len(t, folders.queries, 1)

	got, err = s.LegacyCheck(legacyCheckContext(t), req)
	require.NoError(t, err)
	want = &authzextv1.LegacyCheckResponse{Allowed: true}
	require.True(t, proto.Equal(want, got), "want %v, got %v", want, got)
	require.Equal(t, []folder.GetParentsQuery{
		{
			UID:   "child",
			OrgID: 12,
		},
		{
			UID:   "child",
			OrgID: 12,
		},
	}, folders.queries, "AuthZ reads once per request, independently of Access Control's cache")

	folders.parents = []*folder.Folder{{UID: "moved"}}
	for _, skipCache := range []bool{false, true} {
		req.SkipCache = skipCache
		got, err = s.LegacyCheck(legacyCheckContext(t), req)
		require.NoError(t, err)
		want = &authzextv1.LegacyCheckResponse{Allowed: false}
		require.True(t, proto.Equal(want, got), "want %v, got %v", want, got)
	}
	require.Len(t, folders.queries, 4)
}

func TestLegacyCheckEmbeddedNamespaceIsolation(t *testing.T) {
	ac := acimpl.ProvideAccessControlTest()
	calls := 0
	ac.RegisterScopeAttributeResolver("folders:uid:", accesscontrol.ScopeAttributeResolverFunc(
		func(ctx context.Context, orgID int64, scope string) ([]string, error) {
			calls++
			require.Equal(t, "stacks-123", request.NamespaceValue(ctx))
			require.Equal(t, int64(1), orgID)
			return []string{"folders:uid:parent"}, nil
		},
	))
	s := NewTestService("u-1", []accesscontrol.Permission{
		{
			Action: "folders:write",
			Scope:  "folders:uid:parent",
		},
	}, nil).WithLegacyScopeResolvers(acimpl.ProvideScopeResolverRegistry(ac), func(int64) string {
		return "stacks-123"
	})
	for _, tc := range []struct {
		name      string
		namespace string
		want      *authzextv1.LegacyCheckResponse
		calls     int
	}{
		{
			name:      "local stack",
			namespace: "stacks-123",
			want:      &authzextv1.LegacyCheckResponse{Allowed: true},
			calls:     1,
		},
		{
			name:      "different stack with the same org ID",
			namespace: "stacks-456",
			want: &authzextv1.LegacyCheckResponse{
				Allowed: false,
				Error:   "namespace does not belong to embedded scope resolvers",
			},
			calls: 1,
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			ctx := identity.WithRequester(t.Context(), &identity.StaticRequester{
				Type:      types.TypeAccessPolicy,
				Namespace: "*",
			})
			req := legacyPermissionRequest("user:u-1", "folders:write", "folders:uid:child")
			req.Namespace = tc.namespace
			got, err := s.LegacyCheck(ctx, req)
			require.NoError(t, err)
			require.True(t, proto.Equal(tc.want, got), "want %v, got %v", tc.want, got)
			require.Equal(t, tc.calls, calls)
		})
	}
}

func TestLegacyResolverRequester(t *testing.T) {
	for _, tc := range []struct {
		name    string
		subject string
		role    *store.BasicRole
		want    *identity.StaticRequester
	}{
		{
			name:    "user alias resolves to canonical UID",
			subject: "user:1",
			role: &store.BasicRole{
				Role:    "Viewer",
				IsAdmin: false,
			},
			want: &identity.StaticRequester{
				Type:           types.TypeUser,
				UserID:         1,
				UserUID:        "u-1",
				OrgID:          12,
				Namespace:      "org-12",
				OrgRole:        identity.RoleViewer,
				IsGrafanaAdmin: false,
				CacheKey:       "org-12:user:1",
			},
		},
		{
			name:    "service account",
			subject: "service-account:u-1",
			role: &store.BasicRole{
				Role:    "Editor",
				IsAdmin: false,
			},
			want: &identity.StaticRequester{
				Type:           types.TypeServiceAccount,
				UserID:         1,
				UserUID:        "u-1",
				OrgID:          12,
				Namespace:      "org-12",
				OrgRole:        identity.RoleEditor,
				IsGrafanaAdmin: false,
				CacheKey:       "org-12:service-account:u-1",
			},
		},
		{
			name:    "anonymous",
			subject: "anonymous:0",
			want: &identity.StaticRequester{
				Type:           types.TypeAnonymous,
				UserUID:        "0",
				OrgID:          12,
				Namespace:      "org-12",
				OrgRole:        identity.RoleViewer,
				IsGrafanaAdmin: false,
				CacheKey:       "org-12:anonymous:0",
			},
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			ac := acimpl.ProvideAccessControlTest()
			var observed identity.Requester
			ac.RegisterScopeAttributeResolver("library.panels:uid:", accesscontrol.WithRequiredActions(accesscontrol.ScopeAttributeResolverFunc(
				func(ctx context.Context, orgID int64, scope string) ([]string, error) {
					var err error
					observed, err = identity.GetRequester(ctx)
					return []string{"folders:uid:parent"}, err
				},
			), folder.ActionFoldersRead))
			s := NewTestService("u-1", []accesscontrol.Permission{
				{
					Action: "library.panels:read",
					Scope:  "folders:uid:parent",
				},
				{
					Action: "folders:read",
					Scope:  "folders:uid:parent",
				},
			}, nil).WithLegacyScopeResolvers(acimpl.ProvideScopeResolverRegistry(ac), types.OrgNamespaceFormatter)
			s.store.(*fakeStore).basicRole = tc.role
			ctx := identity.WithRequester(t.Context(), &identity.StaticRequester{
				Type:           types.TypeAccessPolicy,
				UserUID:        "rpc-caller",
				Namespace:      "org-12",
				IsGrafanaAdmin: true,
				AccessToken:    "caller-token",
			})
			got, err := s.LegacyCheck(ctx, legacyPermissionRequest(tc.subject, "library.panels:read", "library.panels:uid:panel"))
			require.NoError(t, err)
			want := &authzextv1.LegacyCheckResponse{Allowed: true}
			require.True(t, proto.Equal(want, got), "want %v, got %v", want, got)
			tc.want.Permissions = map[int64]map[string][]string{
				12: {
					"library.panels:read": {"folders:uid:parent"},
					"folders:read":        {"folders:uid:parent"},
				},
			}
			require.Equal(t, tc.want, observed)
		})
	}
}

func TestLegacyResolverIgnoresUnrelatedPermissionFailure(t *testing.T) {
	ac := acimpl.ProvideAccessControlTest()
	calls := 0
	ac.RegisterScopeAttributeResolver("dashboards:uid:", accesscontrol.ScopeAttributeResolverFunc(
		func(context.Context, int64, string) ([]string, error) {
			calls++
			return []string{"folders:uid:parent"}, nil
		},
	))
	s := NewTestService("u-1", []accesscontrol.Permission{
		{
			Action: "dashboards:read",
			Scope:  "folders:uid:parent",
		},
	}, nil).WithLegacyScopeResolvers(acimpl.ProvideScopeResolverRegistry(ac), types.OrgNamespaceFormatter)
	permissions := &failingLegacyFolderPermissions{PermissionStore: s.permissionStore}
	s.permissionStore = permissions
	got, err := s.LegacyCheck(legacyCheckContext(t), legacyPermissionRequest("user:u-1", "dashboards:read", "dashboards:uid:one"))
	require.NoError(t, err)
	want := &authzextv1.LegacyCheckResponse{
		Allowed: true,
	}
	require.True(t, proto.Equal(want, got), "want %v, got %v", want, got)
	require.Equal(t, 1, calls)
	require.Zero(t, permissions.folderQueries)
}

type legacyResolverFolders struct {
	folder.Service
	parents []*folder.Folder
	queries []folder.GetParentsQuery
}

func (s *legacyResolverFolders) GetParents(
	ctx context.Context,
	query folder.GetParentsQuery,
) ([]*folder.Folder, error) {
	s.queries = append(s.queries, query)
	return s.parents, nil
}

type failingLegacyFolderPermissions struct {
	store.PermissionStore
	folderQueries int
}

func (s *failingLegacyFolderPermissions) GetUserPermissions(
	ctx context.Context,
	ns types.NamespaceInfo,
	query store.PermissionsQuery,
) ([]accesscontrol.Permission, error) {
	if query.Action == folder.ActionFoldersRead {
		s.folderQueries++
		return nil, errors.New("folder permissions unavailable")
	}
	return s.PermissionStore.GetUserPermissions(ctx, ns, query)
}
