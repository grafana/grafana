package rbac

import (
	"context"
	"fmt"
	"testing"

	"github.com/grafana/authlib/claims"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/infra/log"
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
			s := &Service{logger: log.New("test"), actionMapper: mappers.NewK8sRbacMapper()}
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
			req := &CheckRequest{Namespace: claims.NamespaceInfo{Value: "stacks-12", OrgID: 1, StackID: 12}}

			userIdentifiers := &store.UserIdentifiers{UID: "test-uid"}
			identityStore := &fakeIdentityStore{teams: tc.teams, err: tc.expectedError}

			cacheService := localcache.New(shortCacheTTL, shortCleanupInterval)
			if tc.cacheHit {
				cacheService.Set(userTeamCacheKey(req.Namespace.Value, userIdentifiers.UID), tc.expectedTeams, 0)
			}

			s := &Service{
				teamCache:     cacheService,
				identityStore: identityStore,
				logger:        log.New("test"),
			}

			teams, err := s.getUserTeams(ctx, req, userIdentifiers)
			if tc.expectedError {
				require.Error(t, err)
				return
			}

			require.NoError(t, err)
			require.Equal(t, tc.expectedTeams, teams)
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
		basicRole     *store.BasicRole
		cacheHit      bool
		expectedRole  *store.BasicRole
		expectedError bool
		storeError    bool
	}

	testCases := []testCase{
		{
			name: "should return basic role from cache if available",
			basicRole: &store.BasicRole{
				Role:    "viewer",
				IsAdmin: false,
			},
			cacheHit: true,
			expectedRole: &store.BasicRole{
				Role:    "viewer",
				IsAdmin: false,
			},
			expectedError: false,
		},
		{
			name: "should return basic role from store if not in cache",
			basicRole: &store.BasicRole{
				Role:    "editor",
				IsAdmin: false,
			},
			cacheHit: false,
			expectedRole: &store.BasicRole{
				Role:    "editor",
				IsAdmin: false,
			},
			expectedError: false,
		},
		{
			name:          "should return error if store fails",
			basicRole:     nil,
			cacheHit:      false,
			expectedRole:  nil,
			expectedError: true,
			storeError:    true,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			ctx := context.Background()
			req := &CheckRequest{Namespace: claims.NamespaceInfo{Value: "stacks-12", OrgID: 1, StackID: 12}}

			userIdentifiers := &store.UserIdentifiers{UID: "test-uid", ID: 1}
			store := &fakeStore{basicRole: tc.basicRole, err: tc.storeError}

			cacheService := localcache.New(shortCacheTTL, shortCleanupInterval)
			if tc.cacheHit {
				cacheService.Set(userBasicRoleCacheKey(req.Namespace.Value, userIdentifiers.UID), tc.expectedRole, 0)
			}

			s := &Service{
				basicRoleCache: cacheService,
				store:          store,
				logger:         log.New("test"),
			}

			role, err := s.getUserBasicRole(ctx, req, userIdentifiers)
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

type fakeStore struct {
	store.StoreImpl
	basicRole *store.BasicRole
	err       bool
	calls     int
}

func (f *fakeStore) GetBasicRoles(ctx context.Context, namespace claims.NamespaceInfo, query store.BasicRoleQuery) (*store.BasicRole, error) {
	f.calls++
	if f.err {
		return nil, fmt.Errorf("store error")
	}
	return f.basicRole, nil
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
