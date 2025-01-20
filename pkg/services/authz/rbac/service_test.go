package rbac

import (
	"context"
	"fmt"
	"testing"

	"github.com/grafana/authlib/claims"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"golang.org/x/sync/singleflight"

	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/registry/apis/iam/legacy"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/authz/mappers"
	"github.com/grafana/grafana/pkg/services/authz/rbac/store"
)

func TestService_checkPermission(t *testing.T) {
	type testCase struct {
		name        string
		permissions []accesscontrol.Permission
		check       CheckRequest
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
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			s := &Service{logger: log.New("test"), actionMapper: mappers.NewK8sRbacMapper(), tracer: tracing.NewNoopTracerService()}
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
			ns := claims.NamespaceInfo{Value: "stacks-12", OrgID: 1, StackID: 12}

			userIdentifiers := &store.UserIdentifiers{UID: "test-uid"}
			identityStore := &fakeIdentityStore{teams: tc.teams, err: tc.expectedError}

			cacheService := localcache.New(shortCacheTTL, shortCleanupInterval)
			if tc.cacheHit {
				cacheService.Set(userTeamCacheKey(ns.Value, userIdentifiers.UID), tc.expectedTeams, 0)
			}

			s := &Service{
				teamCache:     cacheService,
				identityStore: identityStore,
				logger:        log.New("test"),
				tracer:        tracing.NewNoopTracerService(),
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
			ns := claims.NamespaceInfo{Value: "stacks-12", OrgID: 1, StackID: 12}

			userIdentifiers := &store.UserIdentifiers{UID: "test-uid", ID: 1}
			store := &fakeStore{basicRole: &tc.basicRole, err: tc.expectedError}

			cacheService := localcache.New(shortCacheTTL, shortCleanupInterval)
			if tc.cacheHit {
				cacheService.Set(userBasicRoleCacheKey(ns.Value, userIdentifiers.UID), tc.expectedRole, 0)
			}

			s := &Service{
				basicRoleCache: cacheService,
				store:          store,
				logger:         log.New("test"),
				tracer:         tracing.NewNoopTracerService(),
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
			userID := &store.UserIdentifiers{UID: "test-uid", ID: 112}
			ns := claims.NamespaceInfo{Value: "stacks-12", OrgID: 1, StackID: 12}
			action := "dashboards:read"

			cacheService := localcache.New(shortCacheTTL, shortCleanupInterval)
			if tc.cacheHit {
				cacheService.Set(userPermCacheKey(ns.Value, userID.UID, action), tc.expectedPerms, 0)
			}

			store := &fakeStore{
				userID:          userID,
				basicRole:       &store.BasicRole{Role: "viewer", IsAdmin: false},
				userPermissions: tc.permissions,
			}

			s := &Service{
				store:          store,
				identityStore:  &fakeIdentityStore{teams: []int64{1, 2}},
				actionMapper:   mappers.NewK8sRbacMapper(),
				logger:         log.New("test"),
				tracer:         tracing.NewNoopTracerService(),
				idCache:        localcache.New(longCacheTTL, longCleanupInterval),
				permCache:      cacheService,
				sf:             new(singleflight.Group),
				basicRoleCache: localcache.New(longCacheTTL, longCleanupInterval),
				teamCache:      localcache.New(shortCacheTTL, shortCleanupInterval),
			}

			perms, err := s.getUserPermissions(ctx, ns, claims.TypeUser, userID.UID, action)
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

func TestService_buildFolderTree(t *testing.T) {
	type testCase struct {
		name         string
		folders      []store.Folder
		cacheHit     bool
		expectedTree map[string]FolderNode
	}

	testCases := []testCase{
		{
			name: "should return folder tree from cache if available",
			folders: []store.Folder{
				{UID: "folder1", ParentUID: nil},
				{UID: "folder2", ParentUID: strPtr("folder1")},
			},
			cacheHit: true,
			expectedTree: map[string]FolderNode{
				"folder1": {uid: "folder1", childrenUIDs: []string{"folder2"}},
				"folder2": {uid: "folder2", parentUID: strPtr("folder1")},
			},
		},
		{
			name: "should return folder tree from store if not in cache",
			folders: []store.Folder{
				{UID: "folder1", ParentUID: nil},
				{UID: "folder2", ParentUID: strPtr("folder1")},
			},
			cacheHit: false,
			expectedTree: map[string]FolderNode{
				"folder1": {uid: "folder1", childrenUIDs: []string{"folder2"}},
				"folder2": {uid: "folder2", parentUID: strPtr("folder1")},
			},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			ctx := context.Background()
			ns := claims.NamespaceInfo{Value: "stacks-12", OrgID: 1, StackID: 12}

			cacheService := localcache.New(shortCacheTTL, shortCleanupInterval)
			if tc.cacheHit {
				cacheService.Set(folderCacheKey(ns.Value), tc.expectedTree, 0)
			}

			store := &fakeStore{folders: tc.folders}

			s := &Service{
				store:       store,
				folderCache: cacheService,
				logger:      log.New("test"),
				sf:          new(singleflight.Group),
				tracer:      tracing.NewNoopTracerService(),
			}

			tree, err := s.buildFolderTree(ctx, ns)

			require.NoError(t, err)
			require.Len(t, tree, len(tc.expectedTree))
			for _, folder := range tc.folders {
				node, ok := tree[folder.UID]
				require.True(t, ok)
				// Check parent
				if folder.ParentUID != nil {
					require.NotNil(t, node.parentUID)
					require.Equal(t, *folder.ParentUID, *node.parentUID)
				} else {
					require.Nil(t, node.parentUID)
				}
				// Check children
				if len(node.childrenUIDs) > 0 {
					epectedChildren := tc.expectedTree[folder.UID].childrenUIDs
					require.ElementsMatch(t, node.childrenUIDs, epectedChildren)
				}
			}
			if tc.cacheHit {
				require.Zero(t, store.calls)
			} else {
				require.Equal(t, 1, store.calls)
			}
		})
	}
}

func TestService_listPermission(t *testing.T) {
	type testCase struct {
		name               string
		permissions        []accesscontrol.Permission
		folderTree         map[string]FolderNode
		list               ListRequest
		expectedDashboards []string
		expectedFolders    []string
		expectedAll        bool
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
			folderTree: map[string]FolderNode{
				"some_folder_1": {uid: "some_folder_1"},
				"some_folder_2": {uid: "some_folder_2"},
			},
			list: ListRequest{
				Action:   "dashboards:read",
				Group:    "dashboard.grafana.app",
				Resource: "dashboards",
			},
			expectedDashboards: []string{"some_dashboard"},
			expectedFolders:    []string{"some_folder_1", "some_folder_2"},
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
			folderTree: map[string]FolderNode{
				"some_folder_parent":      {uid: "some_folder_parent", childrenUIDs: []string{"some_folder_child"}},
				"some_folder_child":       {uid: "some_folder_child", parentUID: strPtr("some_folder_parent"), childrenUIDs: []string{"some_folder_subchild1", "some_folder_subchild2"}},
				"some_folder_subchild1":   {uid: "some_folder_subchild1", parentUID: strPtr("some_folder_child")},
				"some_folder_subchild2":   {uid: "some_folder_subchild2", parentUID: strPtr("some_folder_child"), childrenUIDs: []string{"some_folder_subsubchild"}},
				"some_folder_subsubchild": {uid: "some_folder_subsubchild", parentUID: strPtr("some_folder_subchild2")},
				"some_folder_1":           {uid: "some_folder_1", parentUID: strPtr("some_other_folder")},
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
			folderTree: map[string]FolderNode{
				"some_folder_parent": {uid: "some_folder_parent", childrenUIDs: []string{"some_folder_child"}},
				"some_folder_child":  {uid: "some_folder_child", parentUID: strPtr("some_folder_parent")},
			},
			list: ListRequest{
				Action:   "dashboards:read",
				Group:    "dashboard.grafana.app",
				Resource: "dashboards",
			},
			expectedDashboards: []string{"some_dashboard"},
			expectedFolders:    []string{"some_folder_parent", "some_folder_child"},
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
			folderTree: map[string]FolderNode{
				"some_folder_parent":   {uid: "some_folder_parent", childrenUIDs: []string{"some_folder_child"}},
				"some_folder_child":    {uid: "some_folder_child", parentUID: strPtr("some_folder_parent"), childrenUIDs: []string{"some_folder_subchild"}},
				"some_folder_subchild": {uid: "some_folder_subchild", parentUID: strPtr("some_folder_child")},
			},
			list: ListRequest{
				Action:   "dashboards:read",
				Group:    "dashboard.grafana.app",
				Resource: "dashboards",
			},
			expectedFolders: []string{"some_folder_parent", "some_folder_child", "some_folder_subchild"},
		},
		{
			name:        "return no dashboards and folders if the user doesn't have access to any resources",
			permissions: []accesscontrol.Permission{},
			folderTree: map[string]FolderNode{
				"some_folder_1": {uid: "some_folder_1"},
			},
			list: ListRequest{
				Action:   "dashboards:read",
				Group:    "dashboard.grafana.app",
				Resource: "dashboards",
			},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			folderCache := localcache.New(shortCacheTTL, shortCleanupInterval)
			if tc.folderTree != nil {
				folderCache.Set(folderCacheKey("default"), tc.folderTree, 0)
			}
			s := &Service{
				logger:       log.New("test"),
				actionMapper: mappers.NewK8sRbacMapper(),
				folderCache:  folderCache,
				tracer:       tracing.NewNoopTracerService(),
			}
			tc.list.Namespace = claims.NamespaceInfo{Value: "default", OrgID: 1}
			got, err := s.listPermission(context.Background(), getScopeMap(tc.permissions), &tc.list)
			require.NoError(t, err)
			assert.Equal(t, tc.expectedAll, got.All)
			assert.ElementsMatch(t, tc.expectedDashboards, got.Items)
			assert.ElementsMatch(t, tc.expectedFolders, got.Folders)
		})
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

func (f *fakeStore) GetFolders(ctx context.Context, namespace claims.NamespaceInfo) ([]store.Folder, error) {
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
