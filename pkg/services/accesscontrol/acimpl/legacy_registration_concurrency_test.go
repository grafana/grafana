package acimpl

import (
	"context"
	"fmt"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/authz/rbac/legacypermissions"
	"github.com/grafana/grafana/pkg/services/licensing"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginaccesscontrol"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/util/testutil"
)

// Pause the real registration loop when it ignores a plugin's app-access grant.
// The preceding fixed role has already been applied, but the plugin grant hasn't.
type registrationPauseLogger struct {
	log.Logger
	once    sync.Once
	entered chan struct{}
	release chan struct{}
}

func (l *registrationPauseLogger) Debug(message string, args ...any) {
	l.once.Do(func() {
		close(l.entered)
		<-l.release
	})
	l.Logger.Debug(message, args...)
}

type registrationReadResult struct {
	permissions []ac.Permission
	err         error
}

func TestIntegrationLegacyRegistrationPublishesCompleteBatch(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	for _, cached := range []bool{false, true} {
		t.Run(fmt.Sprintf("cache=%t", cached), func(t *testing.T) {
			s := setupTestEnv(t, false)
			s.cfg.RBAC.PermissionCache = cached
			client := legacypermissions.NewEmbeddedClient(newContractLoader(s, s.cache), s.cfg)
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
			paused := &registrationPauseLogger{Logger: s.log, entered: make(chan struct{}), release: make(chan struct{})}
			s.log = paused
			var release sync.Once
			unblock := func() { release.Do(func() { close(paused.release) }) }
			defer unblock()
			registered := make(chan error, 1)
			go func() { registered <- s.RegisterFixedRoles(t.Context()) }()
			<-paused.entered

			requester := &user.SignedInUser{UserID: 7, OrgID: 1, OrgRole: org.RoleViewer}
			read := make(chan registrationReadResult, 1)
			started := make(chan struct{})
			go func() {
				close(started)
				permissions, err := GetLegacyUserPermissions(t.Context(), client, requester, ac.Options{}, s.cfg)
				read <- registrationReadResult{permissions, err}
			}()
			<-started
			var result registrationReadResult
			returnedEarly := false
			select {
			case result = <-read:
				returnedEarly = true
			case <-time.After(100 * time.Millisecond):
			}
			unblock()
			require.NoError(t, <-registered)
			if !returnedEarly {
				result = <-read
			}
			require.NoError(t, result.err)
			require.False(t, returnedEarly, "enumeration must wait for the complete registration batch")
			require.Contains(t, rawPermissions(result.permissions), first)
			require.Contains(t, rawPermissions(result.permissions), second)
			warm, err := GetLegacyUserPermissions(t.Context(), client, requester, ac.Options{}, s.cfg)
			require.NoError(t, err)
			require.Contains(t, rawPermissions(warm), second, "no reload is needed after registration")
		})
	}
}

type registrationPauseDB struct {
	db.DB
	once    sync.Once
	entered chan struct{}
	release chan struct{}
}

func (d *registrationPauseDB) WithDbSession(ctx context.Context, callback sqlstore.DBTransactionFunc) error {
	d.once.Do(func() {
		close(d.entered)
		<-d.release
	})
	return d.DB.WithDbSession(ctx, callback)
}

func TestIntegrationLegacyRegistrationDrainsCacheFills(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	s := setupTestEnv(t, false)
	s.cfg.RBAC.PermissionCache = true
	paused := &registrationPauseDB{DB: s.sql, entered: make(chan struct{}), release: make(chan struct{})}
	loader := legacypermissions.NewLoader(paused, s.RoleCatalog(), s.actionResolver, s.cache, s.cfg, s.features, &licensing.OSSLicensingService{}, nil)
	client := legacypermissions.NewEmbeddedClient(loader, s.cfg)
	grant := ac.Permission{Action: "users:create"}
	require.NoError(t, s.DeclareFixedRoles(ac.RoleRegistration{
		Role: ac.RoleDTO{Name: "fixed:catalog:reader", Permissions: []ac.Permission{grant}}, Grants: []string{"Viewer"},
	}))
	var release sync.Once
	unblock := func() { release.Do(func() { close(paused.release) }) }
	defer unblock()
	requester := &user.SignedInUser{UserID: 7, OrgID: 1, OrgRole: org.RoleViewer}
	read := make(chan registrationReadResult, 1)
	go func() {
		permissions, err := GetLegacyUserPermissions(t.Context(), client, requester, ac.Options{}, s.cfg)
		read <- registrationReadResult{permissions, err}
	}()
	<-paused.entered
	registered := make(chan error, 1)
	started := make(chan struct{})
	go func() {
		close(started)
		registered <- s.RegisterFixedRoles(t.Context())
	}()
	<-started
	var registrationErr error
	registeredEarly := false
	select {
	case registrationErr = <-registered:
		registeredEarly = true
	case <-time.After(100 * time.Millisecond):
	}
	unblock()
	result := <-read
	if !registeredEarly {
		registrationErr = <-registered
	}
	require.NoError(t, result.err)
	require.NoError(t, registrationErr)
	require.False(t, registeredEarly, "registration must drain old cache fills before invalidating")
	require.NotContains(t, rawPermissions(result.permissions), grant)
	warm, err := GetLegacyUserPermissions(t.Context(), client, requester, ac.Options{}, s.cfg)
	require.NoError(t, err)
	require.Contains(t, rawPermissions(warm), grant, "the old cache fill must be invalidated after registration")
}
