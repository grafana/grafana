package rbac

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/go-jose/go-jose/v3/jwt"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"golang.org/x/sync/singleflight"
	"k8s.io/apiserver/pkg/endpoints/request"

	"github.com/grafana/authlib/authn"
	authzv1 "github.com/grafana/authlib/authz/proto/v1"
	"github.com/grafana/authlib/cache"
	"github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/registry/apis/iam/legacy"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/authz/rbac/store"
	"github.com/grafana/grafana/pkg/services/team"
)

func TestService_checkPermission(t *testing.T) {
	type testCase struct {
		name        string
		permissions []accesscontrol.Permission
		check       checkRequest
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
			check: checkRequest{
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
			check: checkRequest{
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
			check: checkRequest{
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
			check: checkRequest{
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
			check: checkRequest{
				Action:   "dashboards:read",
				Group:    "dashboard.grafana.app",
				Resource: "dashboards",
				Name:     "some_dashboard",
			},
			expected: true,
		},
		{
			name: "should check general folder scope for root level resource creation",
			permissions: []accesscontrol.Permission{
				{
					Action:     "dashboards:create",
					Scope:      "folders:uid:general",
					Kind:       "folders",
					Attribute:  "uid",
					Identifier: "general",
				},
			},
			check: checkRequest{
				Action:   "dashboards:create",
				Group:    "dashboard.grafana.app",
				Resource: "dashboards",
				Verb:     utils.VerbCreate,
			},
			expected: true,
		},
		{
			name: "should fail if user doesn't have general folder scope for root level resource creation",
			permissions: []accesscontrol.Permission{
				{
					Action: "dashboards:create",
				},
			},
			check: checkRequest{
				Action:   "dashboards:create",
				Group:    "dashboard.grafana.app",
				Resource: "dashboards",
				Verb:     utils.VerbCreate,
			},
			expected: false,
		},
		{
			name:        "should return false if user has no permissions on resource",
			permissions: []accesscontrol.Permission{},
			check: checkRequest{
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
			check: checkRequest{
				Action:       "dashboards:read",
				Group:        "dashboard.grafana.app",
				Resource:     "dashboards",
				Name:         "some_dashboard",
				ParentFolder: "child",
			},
			expected: true,
		},
		{
			name: "should allow creating a nested resource",
			permissions: []accesscontrol.Permission{
				{
					Action:     "dashboards:create",
					Scope:      "folders:uid:parent",
					Kind:       "folders",
					Attribute:  "uid",
					Identifier: "parent",
				},
			},
			folders: []store.Folder{{UID: "parent"}},
			check: checkRequest{
				Action:       "dashboards:create",
				Group:        "dashboard.grafana.app",
				Resource:     "dashboards",
				Name:         "",
				ParentFolder: "parent",
				Verb:         utils.VerbCreate,
			},
			expected: true,
		},
		{
			name: "should deny creating a nested resource",
			permissions: []accesscontrol.Permission{
				{
					Action:     "dashboards:create",
					Scope:      "folders:uid:parent",
					Kind:       "folders",
					Attribute:  "uid",
					Identifier: "parent",
				},
			},
			folders: []store.Folder{{UID: "parent"}, {UID: "other_parent"}},
			check: checkRequest{
				Action:       "dashboards:create",
				Group:        "dashboard.grafana.app",
				Resource:     "dashboards",
				Name:         "",
				ParentFolder: "other_parent",
				Verb:         utils.VerbCreate,
			},
			expected: false,
		},
		{
			name: "should allow if it's an any check",
			permissions: []accesscontrol.Permission{
				{
					Action:     "dashboards:read",
					Scope:      "folders:uid:parent",
					Kind:       "folders",
					Attribute:  "uid",
					Identifier: "parent",
				},
			},
			folders: []store.Folder{{UID: "parent"}},
			check: checkRequest{
				Action:       "dashboards:read",
				Group:        "dashboard.grafana.app",
				Resource:     "dashboards",
				Name:         "",
				ParentFolder: "",
				Verb:         utils.VerbList,
			},
			expected: true,
		},
		{
			name: "should return true for datasources if service has permission",
			permissions: []accesscontrol.Permission{
				{
					Action:     "datasources:query",
					Scope:      "datasources:uid:some_datasource",
					Kind:       "datasources",
					Attribute:  "uid",
					Identifier: "some_datasource",
				},
			},
			check: checkRequest{
				Action:   "datasources:query",
				Group:    "query.grafana.app",
				Resource: "query",
				Name:     "some_datasource",
				Verb:     utils.VerbCreate,
			},
			expected: true,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			s := setupService()

			s.folderCache.Set(context.Background(), folderCacheKey("default"), newFolderTree(tc.folders))
			tc.check.Namespace = types.NamespaceInfo{Value: "default", OrgID: 1}
			got, err := s.checkPermission(context.Background(), getScopeMap(tc.permissions), &tc.check)
			require.NoError(t, err)
			assert.Equal(t, tc.expected, got)
		})
	}
}

func TestService_mapping(t *testing.T) {
	type testCase struct {
		name   string
		input  *authzv1.CheckRequest
		output *checkRequest
		err    string
	}

	ns := "default"
	testUserA := &identity.StaticRequester{
		Type:           types.TypeUser,
		Login:          "test",
		UserID:         123,
		UserUID:        "u123",
		OrgRole:        identity.RoleAdmin,
		IsGrafanaAdmin: true, // can do anything
		Namespace:      ns,
		OrgID:          1,
	}
	ctx := types.WithAuthInfo(request.WithNamespace(context.Background(), ns), testUserA)

	testCases := []testCase{
		{
			name: "should return true if user has permission",
			input: &authzv1.CheckRequest{
				Group:    "folder.grafana.app",
				Resource: "folders",
				Name:     "aaa",
				Verb:     utils.VerbCreate,
				Folder:   "folder",
			},
			output: &checkRequest{
				Action:       "folders:create",
				Group:        "folder.grafana.app",
				Resource:     "folders",
				Name:         "aaa",
				Verb:         "create",
				ParentFolder: "folder",
				Namespace: types.NamespaceInfo{
					Value: ns,
					OrgID: 1,
				},
			},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			s := setupService()
			tc.input.Namespace = ns
			tc.input.Subject = testUserA.GetUID() // the subject string

			got, err := s.validateCheckRequest(ctx, tc.input)
			if tc.err != "" {
				require.Error(t, err)
				require.ErrorContains(t, err, tc.err)
				return
			}
			require.NoError(t, err)
			require.NotNil(t, got)

			tc.output.IdentityType = types.TypeUser
			tc.output.UserUID = testUserA.GetIdentifier()

			require.Equal(t, tc.output, got)
		})
	}
}

func TestService_checkPermission_folderCacheMissRecovery(t *testing.T) {
	s := setupService()
	ctx := context.Background()

	// User has root folder access
	userPermissions := map[string]bool{
		"folders:uid:root": true,
	}

	// Populate store with folders
	folderStore := &fakeStore{
		folders:        []store.Folder{{UID: "root"}, {UID: "sub", ParentUID: strPtr("root")}},
		disableNsCheck: true,
	}
	s.folderStore = folderStore

	// Sub folder is missing from the cache
	s.folderCache.Set(ctx, folderCacheKey("default"), newFolderTree([]store.Folder{{UID: "root"}}))

	// Perform check on sub folder
	check := checkRequest{
		Action:       "dashboards:read",
		Group:        "dashboard.grafana.app",
		Resource:     "dashboards",
		Name:         "dash1",
		ParentFolder: "sub",
		Namespace:    types.NamespaceInfo{Value: "default", OrgID: 1},
	}

	got, err := s.checkPermission(ctx, userPermissions, &check)
	require.NoError(t, err)
	assert.True(t, got)

	// Check that folder store was queried despite the initial cache hit
	assert.Equal(t, 1, folderStore.calls)
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
			ns := types.NamespaceInfo{Value: "stacks-12", OrgID: 1, StackID: 12}

			userIdentifiers := &store.UserIdentifiers{UID: "test-uid"}
			identityStore := &fakeIdentityStore{userTeams: tc.teams, err: tc.expectedError, disableNsCheck: true}
			s.identityStore = identityStore

			if tc.cacheHit {
				s.userTeamCache.Set(ctx, userTeamCacheKey(ns.Value, userIdentifiers.UID), tc.expectedTeams)
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
			ns := types.NamespaceInfo{Value: "stacks-12", OrgID: 1, StackID: 12}

			userIdentifiers := &store.UserIdentifiers{UID: "test-uid", ID: 1}
			store := &fakeStore{basicRole: &tc.basicRole, err: tc.expectedError, disableNsCheck: true}
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
		{
			name: "should return uid based permissions",
			permissions: []accesscontrol.Permission{
				{Action: "teams:read", Scope: "teams:id:1"},
			},
			cacheHit:      false,
			expectedPerms: map[string]bool{"teams:uid:t1": true},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			ctx := context.Background()
			s := setupService()
			ns := types.NamespaceInfo{Value: "stacks-12", OrgID: 1, StackID: 12}

			userID := &store.UserIdentifiers{UID: "test-uid", ID: 112}
			action := "dashboards:read"

			if tc.cacheHit {
				s.permCache.Set(ctx, userPermCacheKey(ns.Value, userID.UID, action), tc.expectedPerms)
			}

			store := &fakeStore{
				userID:          userID,
				basicRole:       &store.BasicRole{Role: "viewer", IsAdmin: false},
				userPermissions: tc.permissions,
				disableNsCheck:  true,
			}
			s.store = store
			s.permissionStore = store
			s.identityStore = &fakeIdentityStore{
				userTeams: []int64{1, 2},
				teams: []team.Team{
					{ID: 1, UID: "t1", OrgID: 1},
					{ID: 2, UID: "t2", OrgID: 1},
				},
				disableNsCheck: true,
			}

			perms, err := s.getIdentityPermissions(ctx, ns, types.TypeUser, userID.UID, action)
			require.NoError(t, err)
			require.Len(t, perms, len(tc.expectedPerms))
			for scope := range perms {
				_, ok := tc.expectedPerms[scope]
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
		list            listRequest
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
			list: listRequest{
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
			list: listRequest{
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
			list: listRequest{
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
			list: listRequest{
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
			list: listRequest{
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
			list: listRequest{
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
			list: listRequest{
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

			tc.list.Namespace = types.NamespaceInfo{Value: "default", OrgID: 1}
			got, err := s.listPermission(context.Background(), getScopeMap(tc.permissions), &tc.list)
			require.NoError(t, err)
			assert.Equal(t, tc.expectedAll, got.All)
			assert.ElementsMatch(t, tc.expectedItems, got.Items)
			assert.ElementsMatch(t, tc.expectedFolders, got.Folders)
		})
	}
}

func TestService_Check(t *testing.T) {
	callingService := authn.NewAccessTokenAuthInfo(authn.Claims[authn.AccessTokenClaims]{
		Claims: jwt.Claims{
			Subject:  types.NewTypeID(types.TypeAccessPolicy, "some-service"),
			Audience: []string{"authzservice"},
		},
		Rest: authn.AccessTokenClaims{Namespace: "org-12"},
	})

	type testCase struct {
		name        string
		req         *authzv1.CheckRequest
		permissions []accesscontrol.Permission
		expected    bool
		expectErr   bool
	}

	t.Run("Require auth info", func(t *testing.T) {
		s := setupService()
		ctx := context.Background()
		_, err := s.Check(ctx, &authzv1.CheckRequest{
			Namespace: "org-12",
			Subject:   "user:test-uid",
			Group:     "dashboard.grafana.app",
			Resource:  "dashboards",
			Verb:      "get",
			Name:      "dash1",
		})
		require.Error(t, err)
		require.Contains(t, err.Error(), "could not get auth info")
	})

	testCases := []testCase{
		{
			name: "should error if no namespace is provided",
			req: &authzv1.CheckRequest{
				Namespace: "",
				Subject:   "user:test-uid",
				Group:     "dashboard.grafana.app",
				Resource:  "dashboards",
				Verb:      "get",
				Name:      "dash1",
			},
			expectErr: true,
		},
		{
			name: "should error if caller namespace does not match request namespace",
			req: &authzv1.CheckRequest{
				Namespace: "org-13",
				Subject:   "user:test-uid",
				Group:     "dashboard.grafana.app",
				Resource:  "dashboards",
				Verb:      "get",
				Name:      "dash1",
			},
			expectErr: true,
		},
		{
			name: "should error if no subject is provided",
			req: &authzv1.CheckRequest{
				Namespace: "org-12",
				Subject:   "",
				Group:     "dashboard.grafana.app",
				Resource:  "dashboards",
				Verb:      "get",
				Name:      "dash1",
			},
			expectErr: true,
		},
		{
			name: "should error if an unsupported subject type is provided",
			req: &authzv1.CheckRequest{
				Namespace: "org-12",
				Subject:   "api-key:12",
				Group:     "dashboard.grafana.app",
				Resource:  "dashboards",
				Verb:      "get",
				Name:      "dash1",
			},
			expectErr: true,
		},
		{
			name: "should error if an invalid subject is provided",
			req: &authzv1.CheckRequest{
				Namespace: "org-12",
				Subject:   "invalid:12",
				Group:     "dashboard.grafana.app",
				Resource:  "dashboards",
				Verb:      "get",
				Name:      "dash1",
			},
			expectErr: true,
		},
		{
			name: "should error if an unknown group is provided",
			req: &authzv1.CheckRequest{
				Namespace: "org-12",
				Subject:   "user:test-uid",
				Group:     "unknown.grafana.app",
				Resource:  "unknown",
				Verb:      "get",
				Name:      "u1",
			},
			expectErr: true,
		},
		{
			name: "should error if an unknown verb is provided",
			req: &authzv1.CheckRequest{
				Namespace: "org-12",
				Subject:   "user:test-uid",
				Group:     "dashboard.grafana.app",
				Resource:  "dashboards",
				Verb:      "unknown",
				Name:      "u1",
			},
			expectErr: true,
		},
	}
	t.Run("Request validation", func(t *testing.T) {
		for _, tc := range testCases {
			t.Run(tc.name, func(t *testing.T) {
				s := setupService()
				ctx := types.WithAuthInfo(context.Background(), callingService)
				userID := &store.UserIdentifiers{UID: "test-uid", ID: 1}
				store := &fakeStore{
					userID:          userID,
					userPermissions: tc.permissions,
				}
				s.store = store
				s.permissionStore = store
				s.identityStore = &fakeIdentityStore{}

				_, err := s.Check(ctx, tc.req)
				require.Error(t, err)
			})
		}
	})

	testCases = []testCase{
		{
			name: "should allow user with permission",
			req: &authzv1.CheckRequest{
				Namespace: "org-12",
				Subject:   "user:test-uid",
				Group:     "dashboard.grafana.app",
				Resource:  "dashboards",
				Verb:      "get",
				Name:      "dash1",
			},
			permissions: []accesscontrol.Permission{{Action: "dashboards:read", Scope: "dashboards:uid:dash1"}},
			expected:    true,
		},
		{
			name: "should deny user without permission",
			req: &authzv1.CheckRequest{
				Namespace: "org-12",
				Subject:   "user:test-uid",
				Group:     "dashboard.grafana.app",
				Resource:  "dashboards",
				Verb:      "get",
				Name:      "dash1",
			},
			permissions: []accesscontrol.Permission{{Action: "dashboards:read", Scope: "dashboards:uid:dash2"}},
			expected:    false,
		},
		{
			name: "should translate from id to uid based permissions",
			req: &authzv1.CheckRequest{
				Namespace: "org-12",
				Subject:   "user:test-uid",
				Group:     "iam.grafana.app",
				Resource:  "teams",
				Verb:      "get",
				Name:      "t1",
			},
			permissions: []accesscontrol.Permission{
				{Action: "teams:read", Scope: "teams:id:1"},
			},
			expected: true,
		},
	}
	t.Run("User permission check", func(t *testing.T) {
		for _, tc := range testCases {
			t.Run(tc.name, func(t *testing.T) {
				s := setupService()
				ctx := types.WithAuthInfo(context.Background(), callingService)
				userID := &store.UserIdentifiers{UID: "test-uid", ID: 1}
				store := &fakeStore{
					userID:          userID,
					userPermissions: tc.permissions,
				}
				s.store = store
				s.permissionStore = store
				s.identityStore = &fakeIdentityStore{
					teams: []team.Team{{ID: 1, UID: "t1", OrgID: 1}},
				}

				resp, err := s.Check(ctx, tc.req)
				require.NoError(t, err)
				require.Equal(t, tc.expected, resp.Allowed)

				// Check cache
				id, ok := s.idCache.Get(ctx, userIdentifierCacheKey("org-12", "test-uid"))
				require.True(t, ok)
				require.Equal(t, id.UID, "test-uid")

				expAction := "dashboards:read"
				if tc.req.Resource == "teams" {
					expAction = "teams:read"
				}
				perms, ok := s.permCache.Get(ctx, userPermCacheKey("org-12", "test-uid", expAction))
				require.True(t, ok)
				require.Len(t, perms, 1)
			})
		}
	})

	testCases = []testCase{
		{
			name: "should allow anonymous with permission",
			req: &authzv1.CheckRequest{
				Namespace: "org-12",
				Subject:   "anonymous:0",
				Group:     "dashboard.grafana.app",
				Resource:  "dashboards",
				Verb:      "get",
				Name:      "dash1",
			},
			permissions: []accesscontrol.Permission{{Action: "dashboards:read", Scope: "dashboards:uid:dash1"}},
			expected:    true,
		},
		{
			name: "should deny anonymous without permission",
			req: &authzv1.CheckRequest{
				Namespace: "org-12",
				Subject:   "anonymous:0",
				Group:     "dashboard.grafana.app",
				Resource:  "dashboards",
				Verb:      "get",
				Name:      "dash1",
			},
			permissions: []accesscontrol.Permission{{Action: "dashboards:read", Scope: "dashboards:uid:dash2"}},
			expected:    false,
		},
	}
	t.Run("Anonymous permission check", func(t *testing.T) {
		for _, tc := range testCases {
			t.Run(tc.name, func(t *testing.T) {
				s := setupService()
				ctx := types.WithAuthInfo(context.Background(), callingService)
				store := &fakeStore{userPermissions: tc.permissions}
				s.store = store
				s.permissionStore = store
				s.identityStore = &fakeIdentityStore{}

				resp, err := s.Check(ctx, tc.req)
				require.NoError(t, err)
				assert.Equal(t, tc.expected, resp.Allowed)

				// Check cache
				perms, ok := s.permCache.Get(ctx, anonymousPermCacheKey("org-12", "dashboards:read"))
				require.True(t, ok)
				require.Len(t, perms, 1)
			})
		}
	})

	testCases = []testCase{
		{
			name: "should allow rendering with permission",
			req: &authzv1.CheckRequest{
				Namespace: "org-12",
				Subject:   "render:0",
				Group:     "dashboard.grafana.app",
				Resource:  "dashboards",
				Verb:      "get",
				Name:      "dash1",
			},
			expected: true,
		},
		{
			name: "should deny rendering access to another app resources",
			req: &authzv1.CheckRequest{
				Namespace: "org-12",
				Subject:   "render:0",
				Group:     "another.grafana.app",
				Resource:  "dashboards",
				Verb:      "get",
				Name:      "dash1",
			},
			expected:  false,
			expectErr: true,
		},
	}
	t.Run("Rendering permission check", func(t *testing.T) {
		for _, tc := range testCases {
			t.Run(tc.name, func(t *testing.T) {
				s := setupService()
				ctx := types.WithAuthInfo(context.Background(), callingService)

				resp, err := s.Check(ctx, tc.req)
				if tc.expectErr {
					require.Error(t, err)
					return
				}
				require.NoError(t, err)
				assert.Equal(t, tc.expected, resp.Allowed)
			})
		}
	})
}

func TestService_CacheCheck(t *testing.T) {
	callingService := authn.NewAccessTokenAuthInfo(authn.Claims[authn.AccessTokenClaims]{
		Claims: jwt.Claims{
			Subject:  types.NewTypeID(types.TypeAccessPolicy, "some-service"),
			Audience: []string{"authzservice"},
		},
		Rest: authn.AccessTokenClaims{Namespace: "org-12"},
	})

	ctx := types.WithAuthInfo(context.Background(), callingService)
	userID := &store.UserIdentifiers{UID: "test-uid", ID: 1}

	t.Run("Allow based on cached permissions", func(t *testing.T) {
		s := setupService()

		s.idCache.Set(ctx, userIdentifierCacheKey("org-12", "test-uid"), *userID)
		s.permCache.Set(ctx, userPermCacheKey("org-12", "test-uid", "dashboards:read"), map[string]bool{"dashboards:uid:dash1": true})

		resp, err := s.Check(ctx, &authzv1.CheckRequest{
			Namespace: "org-12",
			Subject:   "user:test-uid",
			Group:     "dashboard.grafana.app",
			Resource:  "dashboards",
			Verb:      "get",
			Name:      "dash1",
		})
		require.NoError(t, err)
		assert.True(t, resp.Allowed)
	})
	t.Run("Fallback to the database on cache miss", func(t *testing.T) {
		s := setupService()

		// Populate database permission but not the cache
		store := &fakeStore{
			userID:          userID,
			userPermissions: []accesscontrol.Permission{{Action: "dashboards:read", Scope: "dashboards:uid:dash2"}},
		}

		s.store = store
		s.permissionStore = store

		s.idCache.Set(ctx, userIdentifierCacheKey("org-12", "test-uid"), *userID)

		resp, err := s.Check(ctx, &authzv1.CheckRequest{
			Namespace: "org-12",
			Subject:   "user:test-uid",
			Group:     "dashboard.grafana.app",
			Resource:  "dashboards",
			Verb:      "get",
			Name:      "dash2",
		})
		require.NoError(t, err)
		assert.True(t, resp.Allowed)
	})
	t.Run("Fallback to the database on outdated cache", func(t *testing.T) {
		s := setupService()

		store := &fakeStore{
			userID:          userID,
			userPermissions: []accesscontrol.Permission{{Action: "dashboards:read", Scope: "dashboards:uid:dash2"}},
		}

		s.store = store
		s.permissionStore = store

		s.idCache.Set(ctx, userIdentifierCacheKey("org-12", "test-uid"), *userID)
		// The cache does not have the permission for dash2 (outdated)
		s.permCache.Set(ctx, userPermCacheKey("org-12", "test-uid", "dashboards:read"), map[string]bool{"dashboards:uid:dash1": true})

		resp, err := s.Check(ctx, &authzv1.CheckRequest{
			Namespace: "org-12",
			Subject:   "user:test-uid",
			Group:     "dashboard.grafana.app",
			Resource:  "dashboards",
			Verb:      "get",
			Name:      "dash2",
		})
		require.NoError(t, err)
		assert.True(t, resp.Allowed)
	})
	t.Run("Should deny on explicit cache deny entry", func(t *testing.T) {
		s := setupService()

		s.idCache.Set(ctx, userIdentifierCacheKey("org-12", "test-uid"), *userID)

		// Explicitly deny access to the dashboard
		s.permDenialCache.Set(ctx, userPermDenialCacheKey("org-12", "test-uid", "dashboards:read", "dash1", "fold1"), true)

		// Allow access to the dashboard to prove this is not checked
		s.permCache.Set(ctx, userPermCacheKey("org-12", "test-uid", "dashboards:read"), map[string]bool{"dashboards:uid:dash1": false})

		resp, err := s.Check(ctx, &authzv1.CheckRequest{
			Namespace: "org-12",
			Subject:   "user:test-uid",
			Group:     "dashboard.grafana.app",
			Resource:  "dashboards",
			Verb:      "get",
			Name:      "dash1",
			Folder:    "fold1",
		})
		require.NoError(t, err)
		assert.False(t, resp.Allowed)
	})
}

func TestService_List(t *testing.T) {
	callingService := authn.NewAccessTokenAuthInfo(authn.Claims[authn.AccessTokenClaims]{
		Claims: jwt.Claims{
			Subject:  types.NewTypeID(types.TypeAccessPolicy, "some-service"),
			Audience: []string{"authzservice"},
		},
		Rest: authn.AccessTokenClaims{Namespace: "org-12"},
	})

	type testCase struct {
		name        string
		req         *authzv1.ListRequest
		permissions []accesscontrol.Permission
		expected    *authzv1.ListResponse
		expectErr   bool
	}

	t.Run("Require auth info", func(t *testing.T) {
		s := setupService()
		ctx := context.Background()
		_, err := s.List(ctx, &authzv1.ListRequest{
			Namespace: "org-12",
			Subject:   "user:test-uid",
			Group:     "dashboard.grafana.app",
			Resource:  "dashboards",
			Verb:      "get",
		})
		require.Error(t, err)
		require.Contains(t, err.Error(), "could not get auth info")
	})

	testCases := []testCase{
		{
			name: "should error if no namespace is provided",
			req: &authzv1.ListRequest{
				Namespace: "",
				Subject:   "user:test-uid",
				Group:     "dashboard.grafana.app",
				Resource:  "dashboards",
				Verb:      "get",
			},
			expectErr: true,
		},
		{
			name: "should error if caller namespace does not match request namespace",
			req: &authzv1.ListRequest{
				Namespace: "org-13",
				Subject:   "user:test-uid",
				Group:     "dashboard.grafana.app",
				Resource:  "dashboards",
				Verb:      "get",
			},
			expectErr: true,
		},
		{
			name: "should error if no subject is provided",
			req: &authzv1.ListRequest{
				Namespace: "org-12",
				Subject:   "",
				Group:     "dashboard.grafana.app",
				Resource:  "dashboards",
				Verb:      "get",
			},
			expectErr: true,
		},
		{
			name: "should error if an unsupported subject type is provided",
			req: &authzv1.ListRequest{
				Namespace: "org-12",
				Subject:   "api-key:12",
				Group:     "dashboard.grafana.app",
				Resource:  "dashboards",
				Verb:      "get",
			},
			expectErr: true,
		},
		{
			name: "should error if an invalid subject is provided",
			req: &authzv1.ListRequest{
				Namespace: "org-12",
				Subject:   "invalid:12",
				Group:     "dashboard.grafana.app",
				Resource:  "dashboards",
				Verb:      "get",
			},
			expectErr: true,
		},
		{
			name: "should error if an unknown group is provided",
			req: &authzv1.ListRequest{
				Namespace: "org-12",
				Subject:   "user:test-uid",
				Group:     "unknown.grafana.app",
				Resource:  "unknown",
				Verb:      "get",
			},
			expectErr: true,
		},
		{
			name: "should error if an unknown verb is provided",
			req: &authzv1.ListRequest{
				Namespace: "org-12",
				Subject:   "user:test-uid",
				Group:     "dashboard.grafana.app",
				Resource:  "dashboards",
				Verb:      "unknown",
			},
			expectErr: true,
		},
	}
	t.Run("Request validation", func(t *testing.T) {
		for _, tc := range testCases {
			t.Run(tc.name, func(t *testing.T) {
				s := setupService()
				ctx := types.WithAuthInfo(context.Background(), callingService)
				userID := &store.UserIdentifiers{UID: "test-uid", ID: 1}
				store := &fakeStore{
					userID:          userID,
					userPermissions: tc.permissions,
				}
				s.store = store
				s.permissionStore = store
				s.identityStore = &fakeIdentityStore{}

				_, err := s.List(ctx, tc.req)
				require.Error(t, err)
			})
		}
	})

	testCases = []testCase{
		{
			name: "should list permissions for user with permission",
			req: &authzv1.ListRequest{
				Namespace: "org-12",
				Subject:   "user:test-uid",
				Group:     "dashboard.grafana.app",
				Resource:  "dashboards",
				Verb:      "get",
			},
			permissions: []accesscontrol.Permission{
				{Action: "dashboards:read", Scope: "dashboards:uid:dash1"},
				{Action: "dashboards:read", Scope: "dashboards:uid:dash2"},
				{Action: "dashboards:read", Scope: "folders:uid:fold1"},
			},
			expected: &authzv1.ListResponse{
				Items:   []string{"dash1", "dash2"},
				Folders: []string{"fold1"},
			},
		},
		{
			name: "should return empty list for user without permission",
			req: &authzv1.ListRequest{
				Namespace: "org-12",
				Subject:   "user:test-uid",
				Group:     "dashboard.grafana.app",
				Resource:  "dashboards",
				Verb:      "get",
			},
			permissions: []accesscontrol.Permission{},
			expected:    &authzv1.ListResponse{},
		},
	}
	t.Run("User permission list", func(t *testing.T) {
		for _, tc := range testCases {
			t.Run(tc.name, func(t *testing.T) {
				s := setupService()
				ctx := types.WithAuthInfo(context.Background(), callingService)
				userID := &store.UserIdentifiers{UID: "test-uid", ID: 1}
				store := &fakeStore{
					userID:          userID,
					userPermissions: tc.permissions,
				}
				s.store = store
				s.permissionStore = store
				s.identityStore = &fakeIdentityStore{}

				resp, err := s.List(ctx, tc.req)
				require.NoError(t, err)
				require.ElementsMatch(t, resp.Items, tc.expected.Items)
				require.ElementsMatch(t, resp.Folders, tc.expected.Folders)

				// Check cache
				id, ok := s.idCache.Get(ctx, userIdentifierCacheKey("org-12", "test-uid"))
				require.True(t, ok)
				require.Equal(t, id.UID, "test-uid")
				perms, ok := s.permCache.Get(ctx, userPermCacheKey("org-12", "test-uid", "dashboards:read"))
				require.True(t, ok)
				require.Len(t, perms, len(tc.expected.Items)+len(tc.expected.Folders))
			})
		}
	})

	testCases = []testCase{
		{
			name: "should list permissions for anonymous with permission",
			req: &authzv1.ListRequest{
				Namespace: "org-12",
				Subject:   "anonymous:0",
				Group:     "dashboard.grafana.app",
				Resource:  "dashboards",
				Verb:      "get",
			},
			permissions: []accesscontrol.Permission{
				{Action: "dashboards:read", Scope: "dashboards:uid:dash1"},
				{Action: "dashboards:read", Scope: "dashboards:uid:dash2"},
				{Action: "dashboards:read", Scope: "folders:uid:fold1"},
			},
			expected: &authzv1.ListResponse{
				Items:   []string{"dash1", "dash2"},
				Folders: []string{"fold1"},
			},
		},
		{
			name: "should return empty list for anonymous without permission",
			req: &authzv1.ListRequest{
				Namespace: "org-12",
				Subject:   "anonymous:0",
				Group:     "dashboard.grafana.app",
				Resource:  "dashboards",
				Verb:      "get",
			},
			permissions: []accesscontrol.Permission{},
			expected:    &authzv1.ListResponse{},
		},
	}
	t.Run("Anonymous permission list", func(t *testing.T) {
		for _, tc := range testCases {
			t.Run(tc.name, func(t *testing.T) {
				s := setupService()
				ctx := types.WithAuthInfo(context.Background(), callingService)
				store := &fakeStore{userPermissions: tc.permissions}
				s.store = store
				s.permissionStore = store
				s.identityStore = &fakeIdentityStore{}

				resp, err := s.List(ctx, tc.req)
				require.NoError(t, err)
				require.ElementsMatch(t, resp.Items, tc.expected.Items)
				require.ElementsMatch(t, resp.Folders, tc.expected.Folders)

				// Check cache
				perms, ok := s.permCache.Get(ctx, anonymousPermCacheKey("org-12", "dashboards:read"))
				require.True(t, ok)
				require.Len(t, perms, len(tc.expected.Items)+len(tc.expected.Folders))
			})
		}
	})

	testCases = []testCase{
		{
			name: "should list permissions for rendering",
			req: &authzv1.ListRequest{
				Namespace: "org-12",
				Subject:   "render:0",
				Group:     "dashboard.grafana.app",
				Resource:  "dashboards",
				Verb:      "get",
			},
			expected: &authzv1.ListResponse{
				All: true,
			},
		},
		{
			name: "should deny rendering access to another app resources",
			req: &authzv1.ListRequest{
				Namespace: "org-12",
				Subject:   "render:0",
				Group:     "another.grafana.app",
				Resource:  "dashboards",
				Verb:      "get",
			},
			expectErr: true,
		},
	}
	t.Run("Rendering permission list", func(t *testing.T) {
		for _, tc := range testCases {
			t.Run(tc.name, func(t *testing.T) {
				s := setupService()
				ctx := types.WithAuthInfo(context.Background(), callingService)

				resp, err := s.List(ctx, tc.req)
				if tc.expectErr {
					require.Error(t, err)
					return
				}
				require.NoError(t, err)
				assert.Equal(t, tc.expected.All, resp.All)
			})
		}
	})
}

func TestService_getAnonymousPermissions(t *testing.T) {
	type testCase struct {
		name          string
		permissions   []accesscontrol.Permission
		action        string
		expectedPerms map[string]bool
		expectedError bool
		anonRole      string
	}

	testCases := []testCase{
		{
			name: "should return permissions from store if not in cache",
			permissions: []accesscontrol.Permission{
				{Action: "dashboards:read", Scope: "dashboards:uid:some_dashboard"},
			},
			action:        "dashboards:read",
			expectedPerms: map[string]bool{"dashboards:uid:some_dashboard": true},
			expectedError: false,
			anonRole:      "Viewer",
		},
		{
			name:          "should return error if store fails",
			permissions:   nil,
			action:        "dashboards:read",
			expectedPerms: nil,
			expectedError: true,
			anonRole:      "Viewer",
		},
		{
			name: "should handle wildcard permissions",
			permissions: []accesscontrol.Permission{
				{Action: "dashboards:read", Scope: "*", Kind: "*"},
			},
			action:        "dashboards:read",
			expectedPerms: map[string]bool{"*": true},
			expectedError: false,
			anonRole:      "Viewer",
		},
		{
			name: "should use custom anonymous role when specified",
			permissions: []accesscontrol.Permission{
				{Action: "dashboards:read", Scope: "dashboards:uid:some_dashboard"},
			},
			action:        "dashboards:read",
			expectedPerms: map[string]bool{"dashboards:uid:some_dashboard": true},
			expectedError: false,
			anonRole:      "Editor",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			ctx := context.Background()
			s := setupService()
			if tc.anonRole != "" {
				s.settings.AnonOrgRole = tc.anonRole
			}
			ns := types.NamespaceInfo{Value: "stacks-12", OrgID: 1, StackID: 12}
			store := &fakeStore{
				userPermissions: tc.permissions,
				err:             tc.expectedError,
				disableNsCheck:  true,
			}
			s.store = store
			s.permissionStore = store

			perms, err := s.getAnonymousPermissions(ctx, ns, tc.action, []string{})
			if tc.expectedError {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)
			require.Equal(t, tc.expectedPerms, perms)

			// cache should then be set
			cached, ok := s.permCache.Get(ctx, anonymousPermCacheKey(ns.Value, tc.action))
			require.True(t, ok)
			require.Equal(t, tc.expectedPerms, cached)
		})
	}
}

func TestService_CacheList(t *testing.T) {
	callingService := authn.NewAccessTokenAuthInfo(authn.Claims[authn.AccessTokenClaims]{
		Claims: jwt.Claims{
			Subject:  types.NewTypeID(types.TypeAccessPolicy, "some-service"),
			Audience: []string{"authzservice"},
		},
		Rest: authn.AccessTokenClaims{Namespace: "org-12"},
	})

	t.Run("List based on cached permissions", func(t *testing.T) {
		s := setupService()
		ctx := types.WithAuthInfo(context.Background(), callingService)
		userID := &store.UserIdentifiers{UID: "test-uid", ID: 1}
		s.idCache.Set(ctx, userIdentifierCacheKey("org-12", "test-uid"), *userID)
		s.permCache.Set(ctx,
			userPermCacheKey("org-12", "test-uid", "dashboards:read"),
			map[string]bool{"dashboards:uid:dash1": true, "dashboards:uid:dash2": true, "folders:uid:fold1": true},
		)
		s.identityStore = &fakeIdentityStore{}

		resp, err := s.List(ctx, &authzv1.ListRequest{
			Namespace: "org-12",
			Subject:   "user:test-uid",
			Group:     "dashboard.grafana.app",
			Resource:  "dashboards",
			Verb:      "list",
		})

		require.NoError(t, err)
		require.ElementsMatch(t, resp.Items, []string{"dash1", "dash2"})
		require.ElementsMatch(t, resp.Folders, []string{"fold1"})
	})
}

func setupService() *Service {
	cache := cache.NewLocalCache(cache.Config{Expiry: 5 * time.Minute, CleanupInterval: 5 * time.Minute})
	logger := log.New("authz-rbac-service")
	fStore := &fakeStore{}
	tracer := tracing.NewNoopTracerService()
	return &Service{
		logger:          logger,
		mapper:          NewMapperRegistry(),
		tracer:          tracer,
		metrics:         newMetrics(nil),
		idCache:         newCacheWrap[store.UserIdentifiers](cache, logger, tracer, longCacheTTL),
		permCache:       newCacheWrap[map[string]bool](cache, logger, tracer, shortCacheTTL),
		permDenialCache: newCacheWrap[bool](cache, logger, tracer, shortCacheTTL),
		userTeamCache:   newCacheWrap[[]int64](cache, logger, tracer, shortCacheTTL),
		basicRoleCache:  newCacheWrap[store.BasicRole](cache, logger, tracer, longCacheTTL),
		folderCache:     newCacheWrap[folderTree](cache, logger, tracer, shortCacheTTL),
		teamIDCache:     newCacheWrap[map[int64]string](cache, logger, tracer, shortCacheTTL),
		settings:        Settings{AnonOrgRole: "Viewer"},
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
	// The namespace has to be set in the handlers for the correct organization to be picked up.
	disableNsCheck  bool
	folders         []store.Folder
	basicRole       *store.BasicRole
	userID          *store.UserIdentifiers
	userPermissions []accesscontrol.Permission
	err             bool
	calls           int
}

func (f *fakeStore) GetBasicRoles(ctx context.Context, namespace types.NamespaceInfo, query store.BasicRoleQuery) (*store.BasicRole, error) {
	if ns, ok := request.NamespaceFrom(ctx); !f.disableNsCheck && (!ok || ns != namespace.Value) {
		return nil, fmt.Errorf("namespace mismatch")
	}
	f.calls++
	if f.err {
		return nil, fmt.Errorf("store error")
	}
	return f.basicRole, nil
}

func (f *fakeStore) GetUserIdentifiers(ctx context.Context, query store.UserIdentifierQuery) (*store.UserIdentifiers, error) {
	if _, ok := request.NamespaceFrom(ctx); !f.disableNsCheck && !ok {
		return nil, fmt.Errorf("namespace not found")
	}
	f.calls++
	if f.err {
		return nil, fmt.Errorf("store error")
	}
	return f.userID, nil
}

func (f *fakeStore) GetUserPermissions(ctx context.Context, namespace types.NamespaceInfo, query store.PermissionsQuery) ([]accesscontrol.Permission, error) {
	if ns, ok := request.NamespaceFrom(ctx); !f.disableNsCheck && (!ok || ns != namespace.Value) {
		return nil, fmt.Errorf("namespace mismatch")
	}
	f.calls++
	if f.err {
		return nil, fmt.Errorf("store error")
	}
	return f.userPermissions, nil
}

func (f *fakeStore) ListFolders(ctx context.Context, namespace types.NamespaceInfo) ([]store.Folder, error) {
	if ns, ok := request.NamespaceFrom(ctx); !f.disableNsCheck && (!ok || ns != namespace.Value) {
		return nil, fmt.Errorf("namespace mismatch")
	}
	f.calls++
	if f.err {
		return nil, fmt.Errorf("store error")
	}
	return f.folders, nil
}

type fakeIdentityStore struct {
	legacy.LegacyIdentityStore
	userTeams      []int64
	teams          []team.Team
	disableNsCheck bool
	err            bool
	calls          int
}

func (f *fakeIdentityStore) ListUserTeams(ctx context.Context, namespace types.NamespaceInfo, query legacy.ListUserTeamsQuery) (*legacy.ListUserTeamsResult, error) {
	if ns, ok := request.NamespaceFrom(ctx); !f.disableNsCheck && (!ok || ns != namespace.Value) {
		return nil, fmt.Errorf("namespace mismatch")
	}
	f.calls++
	if f.err {
		return nil, fmt.Errorf("identity store error")
	}
	items := make([]legacy.UserTeam, 0, len(f.userTeams))
	for _, teamID := range f.userTeams {
		items = append(items, legacy.UserTeam{ID: teamID})
	}
	return &legacy.ListUserTeamsResult{
		Items:    items,
		Continue: 0,
	}, nil
}

func (f *fakeIdentityStore) ListTeams(ctx context.Context, namespace types.NamespaceInfo, query legacy.ListTeamQuery) (*legacy.ListTeamResult, error) {
	if ns, ok := request.NamespaceFrom(ctx); !f.disableNsCheck && (!ok || ns != namespace.Value) {
		return nil, fmt.Errorf("namespace mismatch")
	}
	f.calls++
	if f.err {
		return nil, fmt.Errorf("identity store error")
	}
	return &legacy.ListTeamResult{Teams: f.teams}, nil
}
