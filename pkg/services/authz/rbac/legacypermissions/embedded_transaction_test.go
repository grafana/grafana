package legacypermissions_test

import (
	"context"
	"errors"
	"fmt"
	"testing"
	"time"

	"github.com/grafana/authlib/types"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/localcache"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/acimpl"
	"github.com/grafana/grafana/pkg/services/accesscontrol/resourcepermissions"
	"github.com/grafana/grafana/pkg/services/authz/legacyclient"
	"github.com/grafana/grafana/pkg/services/authz/rbac/legacypermissions"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/util/testutil"
)

// Model a database operation that takes time to unwind after cancellation.
// The caller must not regain ownership of its transaction while it is in use.
type cancelingTransactionDB struct {
	db.DB
	started  chan struct{}
	canceled chan struct{}
	release  chan struct{}
	finished chan struct{}
}

func (d *cancelingTransactionDB) WithDbSession(ctx context.Context, _ sqlstore.DBTransactionFunc) error {
	defer close(d.finished)
	return d.DB.WithDbSession(ctx, func(_ *db.Session) error {
		close(d.started)
		<-ctx.Done()
		close(d.canceled)
		<-d.release
		return ctx.Err()
	})
}

func TestIntegrationEmbeddedLegacyTransactionCancellation(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	sql := db.NewTestStore(t)
	blocked := &cancelingTransactionDB{DB: sql, started: make(chan struct{}), canceled: make(chan struct{}), release: make(chan struct{}), finished: make(chan struct{})}
	cfg := loaderConfig(false)
	loader := legacypermissions.NewLoader(blocked, legacypermissions.NewRoleCatalog(), resourcepermissions.NewActionSetService(),
		localcache.New(0, 0), cfg, featuremgmt.WithFeatures(), &enforcementLicense{}, nil)
	client := legacypermissions.NewEmbeddedClient(loader, cfg)
	requester := &user.SignedInUser{UserID: 7, UserUID: "seven", OrgID: 1}
	require.NoError(t, sql.InTransaction(t.Context(), func(ctx context.Context) error {
		ctx, cancel := context.WithCancel(ctx)
		defer cancel()
		result := make(chan error, 1)
		go func() {
			_, err := acimpl.GetLegacyUserPermissions(ctx, client, requester, ac.Options{}, cfg)
			result <- err
		}()
		<-blocked.started
		cancel()
		<-blocked.canceled
		var err error
		returnedEarly := false
		select {
		case err = <-result:
			returnedEarly = true
		case <-time.After(100 * time.Millisecond):
		}
		close(blocked.release)
		if !returnedEarly {
			err = <-result
		}
		<-blocked.finished
		require.ErrorIs(t, err, context.Canceled)
		require.False(t, returnedEarly, "RPC returned while the server was still using the caller's transaction")
		return nil
	}))
}

func TestIntegrationEmbeddedLegacyTransactionRejectedCalls(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	sql := db.NewTestStore(t)
	cfg := loaderConfig(false)
	loader := legacypermissions.NewLoader(sql, legacypermissions.NewRoleCatalog(), resourcepermissions.NewActionSetService(),
		localcache.New(0, 0), cfg, featuremgmt.WithFeatures(), &enforcementLicense{}, nil)
	client := legacypermissions.NewEmbeddedClient(loader, cfg)
	requester := &user.SignedInUser{UserID: 7, UserUID: "seven", OrgID: 1}
	require.NoError(t, sql.InTransaction(t.Context(), func(ctx context.Context) error {
		// Client-side validation can return without ever starting a handler.
		_, err := client.LegacyGetUserPermissions(ctx, legacypermissions.LegacyPermissionCaller("default"), legacyclient.LegacyGetUserPermissionsRequest{Namespace: "*"})
		require.Error(t, err)
		canceled, cancel := context.WithCancel(ctx)
		cancel()
		permissions, err := acimpl.GetLegacyUserPermissions(canceled, client, requester, ac.Options{}, cfg)
		require.ErrorIs(t, err, context.Canceled)
		require.Empty(t, permissions)
		expired, cancel := context.WithDeadline(ctx, time.Now().Add(-time.Second))
		defer cancel()
		permissions, err = acimpl.GetLegacyUserPermissions(expired, client, requester, ac.Options{}, cfg)
		require.ErrorIs(t, err, context.DeadlineExceeded)
		require.Empty(t, permissions)
		return nil
	}))
}

type callerContextKey struct{}

type contextCheckingDB struct {
	db.DB
	check func(context.Context)
}

func (d contextCheckingDB) WithDbSession(ctx context.Context, callback sqlstore.DBTransactionFunc) error {
	d.check(ctx)
	return d.DB.WithDbSession(ctx, callback)
}

func TestIntegrationEmbeddedLegacyTransactionContextIsolation(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	sql := db.NewTestStore(t)
	cfg := loaderConfig(false)
	checked := make(chan struct{}, 1)
	store := contextCheckingDB{DB: sql, check: func(ctx context.Context) {
		// Only the SQL session is shared; caller values and authentication are not.
		if ctx.Value(callerContextKey{}) != nil {
			t.Error("unrelated caller context reached the server")
		}
		info, ok := types.AuthInfoFrom(ctx)
		if !ok || info.GetNamespace() != "*" || info.GetSubject() != "access-policy:embedded-grafana" {
			t.Error("server did not install its own authentication context")
		}
		checked <- struct{}{}
	}}
	loader := legacypermissions.NewLoader(store, legacypermissions.NewRoleCatalog(), resourcepermissions.NewActionSetService(),
		localcache.New(0, 0), cfg, featuremgmt.WithFeatures(), &enforcementLicense{}, nil)
	client := legacypermissions.NewEmbeddedClient(loader, cfg)
	ctx := types.WithAuthInfo(context.WithValue(t.Context(), callerContextKey{}, "private"), legacypermissions.LegacyPermissionCaller("org-2"))
	require.NoError(t, sql.InTransaction(ctx, func(ctx context.Context) error {
		_, err := acimpl.GetLegacyUserPermissions(ctx, client, &user.SignedInUser{UserID: 7, OrgID: 1}, ac.Options{}, cfg)
		return err
	}))
	select {
	case <-checked:
	default:
		t.Fatal("loader did not query the database")
	}
}

func TestIntegrationEmbeddedLegacyTransactionRollback(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	sql := db.NewTestStore(t)
	cfg := loaderConfig(false)
	loader := legacypermissions.NewLoader(sql, legacypermissions.NewRoleCatalog(), resourcepermissions.NewActionSetService(),
		localcache.New(0, 0), cfg, featuremgmt.WithFeatures(), &enforcementLicense{}, nil)
	client := legacypermissions.NewEmbeddedClient(loader, cfg)
	requester := &user.SignedInUser{UserID: 7, UserUID: "seven", OrgID: 1}
	grant := ac.Permission{Action: "users:read", Scope: "users:uid:seven"}
	seedGrant(t, sql, "managed:direct", 1, 7, grant)
	rollback := errors.New("rollback")
	err := sql.InTransaction(t.Context(), func(ctx context.Context) error {
		if err := sql.WithDbSession(ctx, func(sess *db.Session) error {
			_, err := sess.Exec("DELETE FROM permission WHERE scope = ?", grant.Scope)
			return err
		}); err != nil {
			return err
		}
		permissions, err := acimpl.GetLegacyUserPermissions(ctx, client, requester, ac.Options{}, cfg)
		require.NoError(t, err)
		require.NotContains(t, permissions, grant)
		return rollback
	})
	require.ErrorIs(t, err, rollback)
	permissions, err := acimpl.GetLegacyUserPermissions(t.Context(), client, requester, ac.Options{}, cfg)
	require.NoError(t, err)
	require.Contains(t, permissions, grant)
}

func TestIntegrationEmbeddedLegacyTransactionRefresh(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	for _, enterprise := range []bool{false, true} {
		for _, cached := range []bool{false, true} {
			t.Run(fmt.Sprintf("enterprise=%t/cache=%t", enterprise, cached), func(t *testing.T) {
				sql := db.NewTestStore(t)
				cfg := loaderConfig(cached)
				loader := legacypermissions.NewLoader(sql, legacypermissions.NewRoleCatalog(), resourcepermissions.NewActionSetService(),
					localcache.New(0, 0), cfg, featuremgmt.WithFeatures(), &enforcementLicense{enabled: enterprise}, nil)
				client := legacypermissions.NewEmbeddedClient(loader, cfg)
				requester := &user.SignedInUser{UserID: 7, UserUID: "seven", OrgID: 1}
				oldGrant := ac.Permission{Action: "alert.notifications.receivers:read", Scope: "receivers:uid:old"}
				newGrant := ac.Permission{Action: "alert.notifications.receivers:read", Scope: "receivers:uid:new"}
				shared := ac.Permission{Action: "folders:read", Scope: "folders:uid:sharedwithme"}
				seedGrant(t, sql, "managed:receiver", 1, 7, oldGrant)

				permissions, err := acimpl.GetLegacyUserPermissions(t.Context(), client, requester, ac.Options{}, cfg)
				require.NoError(t, err)
				require.ElementsMatch(t, []ac.Permission{shared, oldGrant}, permissions)

				// Receiver renames refresh before the enclosing transaction commits.
				// A separate SQL session would cache the old scope until expiry.
				require.NoError(t, sql.InTransaction(t.Context(), func(ctx context.Context) error {
					if err := sql.WithDbSession(ctx, func(sess *db.Session) error {
						_, err := sess.Exec("UPDATE permission SET scope = ? WHERE scope = ?", newGrant.Scope, oldGrant.Scope)
						return err
					}); err != nil {
						return err
					}
					permissions, err := acimpl.GetLegacyUserPermissions(ctx, client, requester, ac.Options{ReloadCache: true}, cfg)
					require.NoError(t, err)
					require.ElementsMatch(t, []ac.Permission{shared, newGrant}, permissions)
					return nil
				}))
				permissions, err = acimpl.GetLegacyUserPermissions(t.Context(), client, requester, ac.Options{}, cfg)
				require.NoError(t, err)
				require.ElementsMatch(t, []ac.Permission{shared, newGrant}, permissions)
			})
		}
	}
}
