package acimpl

import (
	"context"
	"sync"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/authz/rbac/legacypermissions"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginaccesscontrol"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/util/testutil"
)

type catalogRegistrationLogger struct {
	log.Logger
	once    sync.Once
	entered chan struct{}
	release chan struct{}
}

func (l *catalogRegistrationLogger) Debug(message string, args ...any) {
	l.once.Do(func() {
		close(l.entered)
		<-l.release
	})
	l.Logger.Debug(message, args...)
}

type catalogLegacyFillStore struct {
	ac.Store
	once    sync.Once
	entered chan struct{}
	release chan struct{}
}

func (s *catalogLegacyFillStore) GetBasicRolesPermissions(ctx context.Context, query ac.GetUserPermissionsQuery) ([]ac.Permission, error) {
	s.once.Do(func() {
		close(s.entered)
		<-s.release
	})
	return s.Store.GetBasicRolesPermissions(ctx, query)
}

func TestIntegrationLegacyCatalogIgnoresOverlappingLegacyCacheFill(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	s := setupTestEnv(t, false)
	s.cfg.RBAC.PermissionCache = true
	require.NoError(t, s.RegisterFixedRoles(t.Context()))
	loader := newContractLoader(s, s.cache)
	blocked := &catalogLegacyFillStore{Store: s.store, entered: make(chan struct{}), release: make(chan struct{})}
	s.store = blocked
	unblock := sync.OnceFunc(func() { close(blocked.release) })
	t.Cleanup(unblock)
	requester := &user.SignedInUser{UserID: 7, OrgID: 1, OrgRole: org.RoleViewer}
	finished := make(chan error, 1)
	go func() {
		_, err := s.getLocalUserPermissions(t.Context(), requester, ac.Options{})
		finished <- err
	}()
	<-blocked.entered // The legacy reader already copied the old static grants.
	plugin := ac.Permission{Action: "overlap-app:read", Scope: "overlap-app:*"}
	require.NoError(t, s.DeclarePluginRoles(t.Context(), "overlap-app", "Overlap", []plugins.RoleRegistration{{
		Role:   plugins.Role{Name: "Reader", Permissions: []plugins.Permission{{Action: plugin.Action, Scope: plugin.Scope}}},
		Grants: []string{"Viewer"},
	}}))
	unblock()
	require.NoError(t, <-finished)
	value, ok := s.cache.Get(ac.GetBasicRolePermissionCacheKey("Viewer", 1))
	require.True(t, ok)
	require.NotContains(t, rawPermissions(value.([]ac.Permission)), plugin, "legacy fill intentionally retains its existing stale-cache behavior")
	got, err := loader.GetUserPermissions(t.Context(), requester, ac.Options{})
	require.NoError(t, err)
	require.Contains(t, rawPermissions(got), plugin)
}

func TestIntegrationLegacyRegistrationPublishesCompleteBatch(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	s := setupTestEnv(t, false)
	s.cfg.RBAC.PermissionCache = true
	client := legacypermissions.NewEmbeddedClient(newContractLoader(s, s.cache), s.cfg)
	requester := &user.SignedInUser{UserID: 7, OrgID: 1, OrgRole: org.RoleViewer}
	before := s.RoleCatalog().Permissions("Viewer")
	first := ac.Permission{Action: "users:create"}
	second := ac.Permission{Action: "catalog-app:read", Scope: "catalog-app:*"}
	require.NoError(t, s.DeclareFixedRoles(ac.RoleRegistration{
		Role: ac.RoleDTO{Name: "fixed:catalog:first", Permissions: []ac.Permission{first}}, Grants: []string{"Viewer"},
	}))
	require.NoError(t, s.DeclarePluginRoles(t.Context(), "catalog-app", "Catalog", []plugins.RoleRegistration{{
		Role: plugins.Role{Name: "Reader", Permissions: []plugins.Permission{
			{Action: pluginaccesscontrol.ActionAppAccess, Scope: "plugins:id:catalog-app"},
			{Action: second.Action, Scope: second.Scope},
		}}, Grants: []string{"Viewer"},
	}}))
	// This existing log point pauses the real batch after the first role
	// has been applied, but before the second role has been applied.
	paused := &catalogRegistrationLogger{Logger: s.log, entered: make(chan struct{}), release: make(chan struct{})}
	s.log = paused
	unblock := sync.OnceFunc(func() { close(paused.release) })
	t.Cleanup(unblock)
	registered := make(chan error, 1)
	go func() { registered <- s.RegisterFixedRoles(t.Context()) }()
	<-paused.entered
	permissions, err := GetLegacyUserPermissions(t.Context(), client, requester, ac.Options{}, s.cfg)
	unblock()
	require.NoError(t, <-registered)
	require.NoError(t, err)
	require.ElementsMatch(t, append(rawPermissions(before), SharedWithMeFolderPermission), rawPermissions(permissions))
	warm, err := GetLegacyUserPermissions(t.Context(), client, requester, ac.Options{}, s.cfg)
	require.NoError(t, err)
	require.Contains(t, rawPermissions(warm), first)
	require.Contains(t, rawPermissions(warm), second, "publication must be visible without reload")
}
