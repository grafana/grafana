package rbac

// Test infrastructure for the RBAC authorization service.
//
// This is deliberately a non-test file: the Zanzana parity suite
// (pkg/services/authz/zanzana/server) builds a real RBAC Service to compare the
// two engines' answers, and Service's fields are unexported, so the builder has
// to live in this package. NewTestService is the only exported entry point; the
// fakes below stay package-private and keep the field names the tests in this
// package already use.

import (
	"context"
	"fmt"
	"slices"
	"time"

	"golang.org/x/sync/singleflight"
	"k8s.io/apiserver/pkg/endpoints/request"

	"github.com/grafana/authlib/cache"
	"github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/registry/apis/iam/common"
	"github.com/grafana/grafana/pkg/registry/apis/iam/legacy"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/authz/rbac/store"
	"github.com/grafana/grafana/pkg/services/team"
)

// NewTestService returns a Service backed by in-memory fakes, seeded with the
// permissions the identity holds and the namespace's folder tree. Everything
// else (mapper, caches, folder-tree building) is the real implementation, so
// the service evaluates requests exactly as it does in production.
func NewTestService(userUID string, permissions []accesscontrol.Permission, folders []store.Folder) *Service {
	s := setupService()
	fake := &fakeStore{
		userID:          &store.UserIdentifiers{UID: userUID, ID: 1},
		userPermissions: permissions,
		folders:         folders,
	}
	s.store = fake
	s.permissionStore = fake
	s.folderStore = fake
	s.identityStore = &fakeIdentityStore{}
	return s
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
	// folderListCalls counts only ListFolders, since calls counts every store call.
	folderListCalls int
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
	var permissions []accesscontrol.Permission
	for _, p := range f.userPermissions {
		if p.Action == query.Action || slices.Contains(query.ActionSets, p.Action) {
			permissions = append(permissions, p)
		}
	}
	return permissions, nil
}

func (f *fakeStore) ListFolders(ctx context.Context, namespace types.NamespaceInfo) ([]store.Folder, error) {
	if ns, ok := request.NamespaceFrom(ctx); !f.disableNsCheck && (!ok || ns != namespace.Value) {
		return nil, fmt.Errorf("namespace mismatch")
	}
	f.calls++
	f.folderListCalls++
	if f.err {
		return nil, fmt.Errorf("store error")
	}
	return f.folders, nil
}

type fakeIdentityStore struct {
	legacy.LegacyIdentityStore
	userTeams       []int64
	teams           []team.Team
	serviceAccounts []legacy.ServiceAccount
	users           []common.UserWithRole
	pageSize        int // if > 0, simulates pagination with this page size
	disableNsCheck  bool
	err             bool
	calls           int
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
	if query.Pagination.Limit < 1 && f.pageSize > 0 {
		query.Pagination.Limit = int64(f.pageSize)
	}
	return paginateTeams(f.teams, query.Pagination), nil
}

func (f *fakeIdentityStore) ListServiceAccounts(ctx context.Context, namespace types.NamespaceInfo, query legacy.ListServiceAccountsQuery) (*legacy.ListServiceAccountResult, error) {
	if ns, ok := request.NamespaceFrom(ctx); !f.disableNsCheck && (!ok || ns != namespace.Value) {
		return nil, fmt.Errorf("namespace mismatch")
	}
	f.calls++
	if f.err {
		return nil, fmt.Errorf("identity store error")
	}
	if query.Pagination.Limit < 1 && f.pageSize > 0 {
		query.Pagination.Limit = int64(f.pageSize)
	}
	return paginateServiceAccounts(f.serviceAccounts, query.Pagination), nil
}

func (f *fakeIdentityStore) ListUsers(ctx context.Context, namespace types.NamespaceInfo, query legacy.ListUserQuery) (*legacy.ListUserResult, error) {
	if ns, ok := request.NamespaceFrom(ctx); !f.disableNsCheck && (!ok || ns != namespace.Value) {
		return nil, fmt.Errorf("namespace mismatch")
	}
	f.calls++
	if f.err {
		return nil, fmt.Errorf("identity store error")
	}
	if query.Pagination.Limit < 1 && f.pageSize > 0 {
		query.Pagination.Limit = int64(f.pageSize)
	}
	return paginateUsers(f.users, query.Pagination), nil
}

// paginateTeams simulates cursor-based pagination over a slice of teams.
func paginateTeams(items []team.Team, p common.Pagination) *legacy.ListTeamResult {
	limit := int(p.Limit)
	if limit < 1 {
		limit = len(items) // no limit = return all
	}
	start := 0
	if p.Continue > 0 {
		for i, t := range items {
			if t.ID >= p.Continue {
				start = i
				break
			}
		}
	}
	end := start + limit
	if end >= len(items) {
		return &legacy.ListTeamResult{Teams: items[start:]}
	}
	return &legacy.ListTeamResult{
		Teams:    items[start:end],
		Continue: items[end].ID,
	}
}

// paginateServiceAccounts simulates cursor-based pagination over a slice of service accounts.
func paginateServiceAccounts(items []legacy.ServiceAccount, p common.Pagination) *legacy.ListServiceAccountResult {
	limit := int(p.Limit)
	if limit < 1 {
		limit = len(items)
	}
	start := 0
	if p.Continue > 0 {
		for i, sa := range items {
			if sa.ID >= p.Continue {
				start = i
				break
			}
		}
	}
	end := start + limit
	if end >= len(items) {
		return &legacy.ListServiceAccountResult{Items: items[start:]}
	}
	return &legacy.ListServiceAccountResult{
		Items:    items[start:end],
		Continue: items[end].ID,
	}
}

// paginateUsers simulates cursor-based pagination over a slice of users.
func paginateUsers(items []common.UserWithRole, p common.Pagination) *legacy.ListUserResult {
	limit := int(p.Limit)
	if limit < 1 {
		limit = len(items)
	}
	start := 0
	if p.Continue > 0 {
		for i, u := range items {
			if u.ID >= p.Continue {
				start = i
				break
			}
		}
	}
	end := start + limit
	if end >= len(items) {
		return &legacy.ListUserResult{Items: items[start:]}
	}
	return &legacy.ListUserResult{
		Items:    items[start:end],
		Continue: items[end].ID,
	}
}
