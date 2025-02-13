package rbac

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"golang.org/x/sync/singleflight"

	"github.com/grafana/authlib/cache"
	claims "github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/registry/apis/iam/legacy"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/authz/rbac/store"
)

func TestService_checkPermission(t *testing.T) {
	type testCase struct {
		name        string
		permissions []accesscontrol.Permission
		check       CheckRequest
		folders     []store.Folder
		expected    bool
	}

	testCases := []testCase{
		{
			name: "should return true if user has permission",
			permissions: []accesscontrol.Permission{
				{
					Action:     "dashboards:read",
					Scope:      "dashboards:uid:some_dashboard",
					Kind:       "dashboards",
					Attribute:  "uid",
					Identifier: "some_dashboard",
				},
			},
			check: CheckRequest{
				Action:   "dashboards:read",
				Group:    "dashboard.grafana.app",
				Resource: "dashboards",
				Name:     "some_dashboard",
			},
			expected: true,
		},
		{
			name: "should return false if user has permission on a different resource",
			permissions: []accesscontrol.Permission{
				{
					Action:     "dashboards:read",
					Scope:      "dashboards:uid:another_dashboard",
					Kind:       "dashboards",
					Attribute:  "uid",
					Identifier: "another_dashboard",
				},
			},
			check: CheckRequest{
				Action:   "dashboards:read",
				Group:    "dashboard.grafana.app",
				Resource: "dashboards",
				Name:     "some_dashboard",
			},
			expected: false,
		},
		{
			name: "should return true if user has wildcard permission on identifier",
			permissions: []accesscontrol.Permission{
				{
					Action:     "dashboards:read",
					Scope:      "dashboards:uid:*",
					Kind:       "dashboards",
					Attribute:  "uid",
					Identifier: "*",
				},
			},
			check: CheckRequest{
				Action:   "dashboards:read",
				Group:    "dashboard.grafana.app",
				Resource: "dashboards",
				Name:     "some_dashboard",
			},
			expected: true,
		},
		{
			name: "should return true if user has wildcard permission on attribute",
			permissions: []accesscontrol.Permission{
				{
					Action:    "dashboards:read",
					Scope:     "dashboards:*",
					Kind:      "dashboards",
					Attribute: "*",
				},
			},
			check: CheckRequest{
				Action:   "dashboards:read",
				Group:    "dashboard.grafana.app",
				Resource: "dashboards",
				Name:     "some_dashboard",
			},
			expected: true,
		},
		{
			name: "should return true if user has wildcard permission on kind",
			permissions: []accesscontrol.Permission{
				{
					Action: "dashboards:read",
					Scope:  "*",
					Kind:   "*",
				},
			},
			check: CheckRequest{
				Action:   "dashboards:read",
				Group:    "dashboard.grafana.app",
				Resource: "dashboards",
				Name:     "some_dashboard",
			},
			expected: true,
		},
		{
			name: "should return true if no resource is specified",
			permissions: []accesscontrol.Permission{
				{
					Action: "folders:create",
				},
			},
			check: CheckRequest{
				Action:   "folders:create",
				Group:    "folder.grafana.app",
				Resource: "folders",
			},
			expected: true,
		},
		{
			name:        "should return false if user has no permissions on resource",
			permissions: []accesscontrol.Permission{},
			check: CheckRequest{
				Action:   "dashboards:read",
				Group:    "dashboard.grafana.app",
				Resource: "dashboards",
				Name:     "some_dashboard",
			},
			expected: false,
		},
		{
			name: "should return true if user has permissions on folder",
			permissions: []accesscontrol.Permission{
				{
					Scope:      "folders:uid:parent",
					Kind:       "folders",
					Attribute:  "uid",
					Identifier: "parent",
				},
			},
			folders: []store.Folder{
				{UID: "parent"},
				{UID: "child", ParentUID: strPtr("parent")},
			},
			check: CheckRequest{
				Action:       "dashboards:read",
				Group:        "dashboard.grafana.app",
				Resource:     "dashboards",
				Name:         "some_dashboard",
				ParentFolder: "child",
			},
			expected: true,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			s := setupService()

			s.folderCache.Set(context.Background(), folderCacheKey("default"), newFolderTree(tc.folders))
			tc.check.Namespace = claims.NamespaceInfo{Value: "default", OrgID: 1}
			got, err := s.checkPermission(context.Background(), getScopeMap(tc.permissions), &tc.check)
			require.NoError(t, err)
			assert.Equal(t, tc.expected, got)
		})
	}
}

func TestService_getUserTeams(t *testing.T) {
	type testCase struct {
		name          string
		teams         []int64
		cacheHit      bool
		expectedTeams []int64
		expectedError bool
	}

	testCases := []testCase{
		{
			name:          "should return teams from cache if available",
			teams:         []int64{1, 2},
			cacheHit:      true,
			expectedTeams: []int64{1, 2},
			expectedError: false,
		},
		{
			name:          "should return teams from identity store if not in cache",
			teams:         []int64{3, 4},
			cacheHit:      false,
			expectedTeams: []int64{3, 4},
			expectedError: false,
		},
		{
			name:          "should return error if identity store fails",
			teams:         []int64{},
			cacheHit:      false,
			expectedTeams: nil,
			expectedError: true,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			ctx := context.Background()
			s := setupService()

			ns := claims.NamespaceInfo{Value: "stacks-12", OrgID: 1, StackID: 12}

			userIdentifiers := &store.UserIdentifiers{UID: "test-uid"}
			identityStore := &fakeIdentityStore{teams: tc.teams, err: tc.expectedError}
			s.identityStore = identityStore

			if tc.cacheHit {
				s.teamCache.Set(ctx, userTeamCacheKey(ns.Value, userIdentifiers.UID), tc.expectedTeams)
			}

			teams, err := s.getUserTeams(ctx, ns, userIdentifiers)
			if tc.expectedError {
				require.Error(t, err)
				return
			}

			require.NoError(t, err)
			require.ElementsMatch(t, tc.expectedTeams, teams)
			if tc.cacheHit {
				require.Zero(t, identityStore.calls)
			} else {
				require.Equal(t, 1, identityStore.calls)
			}
		})
	}
}

func TestService_getUserBasicRole(t *testing.T) {
	type testCase struct {
		name          string
		basicRole     store.BasicRole
		cacheHit      bool
		expectedRole  store.BasicRole
		expectedError bool
	}

	testCases := []testCase{
		{
			name: "should return basic role from cache if available",
			basicRole: store.BasicRole{
				Role:    "viewer",
				IsAdmin: false,
			},
			cacheHit: true,
			expectedRole: store.BasicRole{
				Role:    "viewer",
				IsAdmin: false,
			},
			expectedError: false,
		},
		{
			name: "should return basic role from store if not in cache",
			basicRole: store.BasicRole{
				Role:    "editor",
				IsAdmin: false,
			},
			cacheHit: false,
			expectedRole: store.BasicRole{
				Role:    "editor",
				IsAdmin: false,
			},
			expectedError: false,
		},
		{
			name:          "should return error if store fails",
			basicRole:     store.BasicRole{},
			cacheHit:      false,
			expectedRole:  store.BasicRole{},
			expectedError: true,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			ctx := context.Background()
			s := setupService()
			ns := claims.NamespaceInfo{Value: "stacks-12", OrgID: 1, StackID: 12}

			userIdentifiers := &store.UserIdentifiers{UID: "test-uid", ID: 1}
			store := &fakeStore{basicRole: &tc.basicRole, err: tc.expectedError}
			s.store = store
			s.permissionStore = store

			if tc.cacheHit {
				s.basicRoleCache.Set(ctx, userBasicRoleCacheKey(ns.Value, userIdentifiers.UID), tc.expectedRole)
			}

			role, err := s.getUserBasicRole(ctx, ns, userIdentifiers)
			if tc.expectedError {
				require.Error(t, err)
				return
			}

			require.NoError(t, err)
			require.Equal(t, tc.expectedRole, role)
			if tc.cacheHit {
				require.Zero(t, store.calls)
			} else {
				require.Equal(t, 1, store.calls)
			}
		})
	}
}

func TestService_getUserPermissions(t *testing.T) {
	type testCase struct {
		name          string
		permissions   []accesscontrol.Permission
		cacheHit      bool
		expectedPerms map[string]bool
	}

	testCases := []testCase{
		{
			name: "should return permissions from cache if available",
			permissions: []accesscontrol.Permission{
				{Action: "dashboards:read", Scope: "dashboards:uid:some_dashboard"},
			},
			cacheHit:      true,
			expectedPerms: map[string]bool{"dashboards:uid:some_dashboard": true},
		},
		{
			name: "should return permissions from store if not in cache",
			permissions: []accesscontrol.Permission{
				{Action: "dashboards:read", Scope: "dashboards:uid:some_dashboard"},
			},
			cacheHit:      false,
			expectedPerms: map[string]bool{"dashboards:uid:some_dashboard": true},
		},
		{
			name:          "should return error if store fails",
			permissions:   nil,
			cacheHit:      false,
			expectedPerms: map[string]bool{},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			ctx := context.Background()
			s := setupService()

			userID := &store.UserIdentifiers{UID: "test-uid", ID: 112}
			ns := claims.NamespaceInfo{Value: "stacks-12", OrgID: 1, StackID: 12}
			action := "dashboards:read"

			if tc.cacheHit {
				s.permCache.Set(ctx, userPermCacheKey(ns.Value, userID.UID, action), tc.expectedPerms)
			}

			store := &fakeStore{
				userID:          userID,
				basicRole:       &store.BasicRole{Role: "viewer", IsAdmin: false},
				userPermissions: tc.permissions,
			}
			s.store = store
			s.permissionStore = store
			s.identityStore = &fakeIdentityStore{teams: []int64{1, 2}}

			perms, err := s.getIdentityPermissions(ctx, ns, claims.TypeUser, userID.UID, action)
			require.NoError(t, err)
			require.Len(t, perms, len(tc.expectedPerms))
			for _, perm := range tc.permissions {
				_, ok := tc.expectedPerms[perm.Scope]
				require.True(t, ok)
			}
			if tc.cacheHit {
				require.Equal(t, 1, store.calls) // only get user id
			} else {
				require.Equal(t, 3, store.calls) // get user id, basic role, and permissions
			}
		})
	}
}

func TestService_listPermission(t *testing.T) {
	type testCase struct {
		name            string
		permissions     []accesscontrol.Permission
		folders         []store.Folder
		list            ListRequest
		expectedItems   []string
		expectedFolders []string
		expectedAll     bool
	}

	testCases := []testCase{
		{
			name: "should return wildcard if user has a wildcard permission",
			permissions: []accesscontrol.Permission{
				{
					Action: "dashboards:read",
					Scope:  "*",
					Kind:   "*",
				},
			},
			list: ListRequest{
				Action:   "dashboards:read",
				Group:    "dashboard.grafana.app",
				Resource: "dashboards",
			},
			expectedAll: true,
		},
		{
			name: "should return dashboards and folders that user has direct access to",
			permissions: []accesscontrol.Permission{
				{
					Action:     "dashboards:read",
					Scope:      "dashboards:uid:some_dashboard",
					Kind:       "dashboards",
					Attribute:  "uid",
					Identifier: "some_dashboard",
				},
				{
					Action:     "dashboards:read",
					Scope:      "folders:uid:some_folder_1",
					Kind:       "folders",
					Attribute:  "uid",
					Identifier: "some_folder_1",
				},
				{
					Action:     "dashboards:read",
					Scope:      "folders:uid:some_folder_2",
					Kind:       "folders",
					Attribute:  "uid",
					Identifier: "some_folder_2",
				},
			},
			folders: []store.Folder{
				{UID: "some_folder_1"},
				{UID: "some_folder_2"},
			},
			list: ListRequest{
				Action:   "dashboards:read",
				Group:    "dashboard.grafana.app",
				Resource: "dashboards",
			},
			expectedItems:   []string{"some_dashboard"},
			expectedFolders: []string{"some_folder_1", "some_folder_2"},
		},
		{
			name: "should return folders that user has inherited access to",
			permissions: []accesscontrol.Permission{
				{
					Action:     "dashboards:read",
					Scope:      "folders:uid:some_folder_parent",
					Kind:       "folders",
					Attribute:  "uid",
					Identifier: "some_folder_1",
				},
			},
			folders: []store.Folder{
				{UID: "some_folder_parent"},
				{UID: "some_folder_child", ParentUID: strPtr("some_folder_parent")},
				{UID: "some_folder_subchild1", ParentUID: strPtr("some_folder_child")},
				{UID: "some_folder_subchild2", ParentUID: strPtr("some_folder_child")},
				{UID: "some_folder_subsubchild", ParentUID: strPtr("some_folder_subchild2")},
				{UID: "some_folder_1", ParentUID: strPtr("some_other_folder")},
			},
			list: ListRequest{
				Action:   "dashboards:read",
				Group:    "dashboard.grafana.app",
				Resource: "dashboards",
			},
			expectedFolders: []string{"some_folder_parent", "some_folder_child", "some_folder_subchild1", "some_folder_subchild2", "some_folder_subsubchild"},
		},
		{
			name: "should return folders that user has inherited access to as well as dashboards that user has direct access to",
			permissions: []accesscontrol.Permission{
				{
					Action:     "dashboards:read",
					Scope:      "dashboards:uid:some_dashboard",
					Kind:       "dashboards",
					Attribute:  "uid",
					Identifier: "some_dashboard",
				},
				{
					Action:     "dashboards:read",
					Scope:      "folders:uid:some_folder_parent",
					Kind:       "folders",
					Attribute:  "uid",
					Identifier: "some_folder_parent",
				},
			},
			folders: []store.Folder{
				{UID: "some_folder_parent"},
				{UID: "some_folder_child", ParentUID: strPtr("some_folder_parent")},
			},
			list: ListRequest{
				Action:   "dashboards:read",
				Group:    "dashboard.grafana.app",
				Resource: "dashboards",
			},
			expectedItems:   []string{"some_dashboard"},
			expectedFolders: []string{"some_folder_parent", "some_folder_child"},
		},
		{
			name: "should deduplicate folders that user has inherited as well as direct access to",
			permissions: []accesscontrol.Permission{
				{
					Action:     "dashboards:read",
					Scope:      "folders:uid:some_folder_child",
					Kind:       "folders",
					Attribute:  "uid",
					Identifier: "some_folder_child",
				},
				{
					Action:     "dashboards:read",
					Scope:      "folders:uid:some_folder_parent",
					Kind:       "folders",
					Attribute:  "uid",
					Identifier: "some_folder_parent",
				},
			},
			folders: []store.Folder{
				{UID: "some_folder_parent"},
				{UID: "some_folder_child", ParentUID: strPtr("some_folder_parent")},
				{UID: "some_folder_subchild", ParentUID: strPtr("some_folder_child")},
				{UID: "some_folder_child2", ParentUID: strPtr("some_folder_parent")},
			},
			list: ListRequest{
				Action:   "dashboards:read",
				Group:    "dashboard.grafana.app",
				Resource: "dashboards",
			},
			expectedFolders: []string{"some_folder_parent", "some_folder_child", "some_folder_child2", "some_folder_subchild"},
		},
		{
			name:        "return no dashboards and folders if the user doesn't have access to any resources",
			permissions: []accesscontrol.Permission{},

			folders: []store.Folder{
				{UID: "some_folder_1"},
			},
			list: ListRequest{
				Action:   "dashboards:read",
				Group:    "dashboard.grafana.app",
				Resource: "dashboards",
			},
		},
		{
			name: "should collect folder permissions into items",
			permissions: []accesscontrol.Permission{
				{
					Action:     "folders:read",
					Scope:      "folders:uid:some_folder_parent",
					Kind:       "folders",
					Attribute:  "uid",
					Identifier: "some_folder_parent",
				},
			},
			folders: []store.Folder{
				{UID: "some_folder_parent"},
				{UID: "some_folder_child", ParentUID: strPtr("some_folder_parent")},
			},
			list: ListRequest{
				Action:   "folders:read",
				Group:    "folder.grafana.app",
				Resource: "folders",
			},
			expectedItems: []string{"some_folder_parent", "some_folder_child"},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			s := setupService()
			if tc.folders != nil {
				s.folderCache.Set(context.Background(), folderCacheKey("default"), newFolderTree(tc.folders))
			}

			tc.list.Namespace = claims.NamespaceInfo{Value: "default", OrgID: 1}
			got, err := s.listPermission(context.Background(), getScopeMap(tc.permissions), &tc.list)
			require.NoError(t, err)
			assert.Equal(t, tc.expectedAll, got.All)
			assert.ElementsMatch(t, tc.expectedItems, got.Items)
			assert.ElementsMatch(t, tc.expectedFolders, got.Folders)
		})
	}
}

func setupService() *Service {
	cache := cache.NewLocalCache(cache.Config{Expiry: 5 * time.Minute, CleanupInterval: 5 * time.Minute})
	logger := log.New("authz-rbac-service")
	fStore := &fakeStore{}
	return &Service{
		logger:          logger,
		mapper:          newMapper(),
		tracer:          tracing.NewNoopTracerService(),
		metrics:         newMetrics(nil),
		idCache:         newCacheWrap[store.UserIdentifiers](cache, logger, longCacheTTL),
		permCache:       newCacheWrap[map[string]bool](cache, logger, shortCacheTTL),
		teamCache:       newCacheWrap[[]int64](cache, logger, shortCacheTTL),
		basicRoleCache:  newCacheWrap[store.BasicRole](cache, logger, longCacheTTL),
		folderCache:     newCacheWrap[folderTree](cache, logger, shortCacheTTL),
		store:           fStore,
		permissionStore: fStore,
		folderStore:     fStore,
		identityStore:   &fakeIdentityStore{},
		sf:              new(singleflight.Group),
	}
}

func strPtr(s string) *string {
	return &s
}

type fakeStore struct {
	store.Store
	folders         []store.Folder
	basicRole       *store.BasicRole
	userID          *store.UserIdentifiers
	userPermissions []accesscontrol.Permission
	err             bool
	calls           int
}

func (f *fakeStore) GetBasicRoles(ctx context.Context, namespace claims.NamespaceInfo, query store.BasicRoleQuery) (*store.BasicRole, error) {
	f.calls++
	if f.err {
		return nil, fmt.Errorf("store error")
	}
	return f.basicRole, nil
}

func (f *fakeStore) GetUserIdentifiers(ctx context.Context, query store.UserIdentifierQuery) (*store.UserIdentifiers, error) {
	f.calls++
	if f.err {
		return nil, fmt.Errorf("store error")
	}
	return f.userID, nil
}

func (f *fakeStore) GetUserPermissions(ctx context.Context, namespace claims.NamespaceInfo, query store.PermissionsQuery) ([]accesscontrol.Permission, error) {
	f.calls++
	if f.err {
		return nil, fmt.Errorf("store error")
	}
	return f.userPermissions, nil
}

func (f *fakeStore) ListFolders(ctx context.Context, namespace claims.NamespaceInfo) ([]store.Folder, error) {
	f.calls++
	if f.err {
		return nil, fmt.Errorf("store error")
	}
	return f.folders, nil
}

type fakeIdentityStore struct {
	legacy.LegacyIdentityStore
	teams []int64
	err   bool
	calls int
}

func (f *fakeIdentityStore) ListUserTeams(ctx context.Context, namespace claims.NamespaceInfo, query legacy.ListUserTeamsQuery) (*legacy.ListUserTeamsResult, error) {
	f.calls++
	if f.err {
		return nil, fmt.Errorf("identity store error")
	}
	items := make([]legacy.UserTeam, 0, len(f.teams))
	for _, teamID := range f.teams {
		items = append(items, legacy.UserTeam{ID: teamID})
	}
	return &legacy.ListUserTeamsResult{
		Items:    items,
		Continue: 0,
	}, nil
}
