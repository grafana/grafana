package legacypermissions_test

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/localcache"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/resourcepermissions"
	"github.com/grafana/grafana/pkg/services/authz/rbac/legacypermissions"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/licensing"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/util/testutil"
)

type migratedGrants struct {
	mu          sync.Mutex
	permissions []ac.Permission
	err         error
	calls       int
}

func (m *migratedGrants) ResolveCurrentUserPermissions(context.Context, identity.Requester) ([]ac.Permission, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.calls++
	return m.permissions, m.err
}

func TestIntegrationLoaderCacheOptionsAndFailures(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	for _, enterprise := range []bool{false, true} {
		t.Run(fmt.Sprintf("enterprise=%t", enterprise), func(t *testing.T) {
			sql := db.NewTestStore(t)
			a := ac.Permission{Action: "users:read", Scope: "users:*"}
			b := ac.Permission{Action: "users:create"}
			c := ac.Permission{Action: "dashboards:read", Scope: "dashboards:uid:new"}
			seedGrant(t, sql, "managed:one", 1, 7, a)
			z := &migratedGrants{permissions: []ac.Permission{a, b, b}}
			loader := legacypermissions.NewLoader(sql, legacypermissions.NewRoleCatalog(),
				resourcepermissions.NewActionSetService(), localcache.New(0, 0),
				loaderConfig(true), featuremgmt.WithFeatures(), &enforcementLicense{enabled: enterprise}, z,
			)
			requester := &user.SignedInUser{UserID: 7, OrgID: 1, OrgRole: org.RoleViewer}
			check := func(options ac.Options, want ...ac.Permission) {
				t.Helper()
				got, err := loader.GetUserPermissions(context.Background(), requester, options)
				require.NoError(t, err)
				require.ElementsMatch(t, append(want, ac.Permission{Action: "folders:read", Scope: "folders:uid:sharedwithme"}), got)
			}
			check(ac.Options{}, a, b)
			check(ac.Options{}, a, b)
			require.Equal(t, 1, z.calls)
			seedGrant(t, sql, "managed:two", 1, 7, a) // Legacy duplicates must survive merging.
			z.permissions = []ac.Permission{c}
			check(ac.Options{SkipZanzanaCache: true}, a, c)
			check(ac.Options{}, a, b) // Skip must not replace the cached Zanzana contribution.
			check(ac.Options{ReloadCache: true}, a, a, c)
			z.err = errors.New("Zanzana unavailable")
			check(ac.Options{ReloadCache: true}, a, a) // Best effort, not a partial SQL success.
			z.err, z.permissions = nil, []ac.Permission{b}
			check(ac.Options{}, a, a, c) // Failed reload retains the last successful cache entry.
			loader.ClearUserPermissionCache(requester)
			check(ac.Options{}, a, a, b)
			check(ac.Options{ReloadCache: true, SkipZanzanaCache: true}, a, a, b)
		})
	}
}

func TestIntegrationLoaderConcurrentSnapshots(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	sql := db.NewTestStore(t)
	permission := ac.Permission{Action: "users:read", Scope: "users:*"}
	seedGrant(t, sql, "managed:one", 1, 7, permission)
	loader := legacypermissions.NewLoader(sql, legacypermissions.NewRoleCatalog(),
		resourcepermissions.NewActionSetService(), localcache.New(0, 0),
		loaderConfig(true), featuremgmt.WithFeatures(), &licensing.OSSLicensingService{},
		&migratedGrants{permissions: []ac.Permission{{Action: "users:create"}}},
	)
	requester := &user.SignedInUser{UserID: 7, OrgID: 1, OrgRole: org.RoleViewer}
	type result struct {
		permissions []ac.Permission
		err         error
	}
	start := make(chan struct{})
	results := make(chan result, 32)
	for range cap(results) {
		go func() {
			<-start
			permissions, err := loader.GetUserPermissions(context.Background(), requester, ac.Options{})
			results <- result{permissions, err}
		}()
	}
	close(start)
	for range cap(results) {
		got := <-results
		require.NoError(t, got.err)
		require.ElementsMatch(t, []ac.Permission{permission, {Action: "users:create"}, {Action: "folders:read", Scope: "folders:uid:sharedwithme"}}, got.permissions)
	}
}

func TestRoleCatalogSnapshots(t *testing.T) {
	catalog := legacypermissions.NewRoleCatalog()
	roles := map[string][]ac.Permission{"Viewer": {{Action: "users:read"}, {Action: "users:read"}}}
	catalog.Replace(roles)
	roles["Viewer"][0].Action = "users:create"
	got := catalog.Permissions("Viewer")
	require.Equal(t, []ac.Permission{{Action: "users:read"}, {Action: "users:read"}}, got)
	got[0].Action = "users:delete"
	require.Equal(t, "users:read", catalog.Permissions("Viewer")[0].Action)
	catalog.Replace(nil)
	require.Empty(t, catalog.Permissions("Viewer"))
}
