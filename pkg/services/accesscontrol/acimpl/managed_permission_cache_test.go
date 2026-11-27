package acimpl

import (
	"context"
	"fmt"
	"sync/atomic"
	"testing"
	"testing/synctest"
	"time"

	"github.com/open-feature/go-sdk/openfeature"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/actest"
	"github.com/grafana/grafana/pkg/services/accesscontrol/resourcepermissions"
	"github.com/grafana/grafana/pkg/services/authz/rbac/legacypermissions"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestIntegrationManagedPermissionCacheTransitions(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	require.NoError(t, openfeature.SetProviderAndWait(managedPermissionFeatureProvider{}))
	t.Cleanup(func() { require.NoError(t, openfeature.SetProviderAndWait(openfeature.NoopProvider{})) })

	for _, cached := range []bool{false, true} {
		for _, route := range []string{"local", "loader", "embedded"} {
			for _, initial := range []bool{false, true} {
				t.Run(fmt.Sprintf("cache=%t/%s/initial=%t", cached, route, initial), func(t *testing.T) {
					s := setupTestEnv(t, false)
					s.cfg.RBAC.PermissionCache = cached
					s.features = featuremgmt.WithFeatures(featuremgmt.FlagExcludeRedundantManagedPermissions)
					s.actionResolver.(resourcepermissions.ActionSetService).StoreActionSet("dashboards:view", []string{"dashboards:read"})
					const userID = 7
					const teamID = 11
					requester := &user.SignedInUser{UserID: userID, UserUID: "seven", OrgID: accesscontrol.GlobalOrgID, OrgRole: org.RoleNone}
					requester.TeamIDs = []int64{teamID} //nolint:staticcheck // Legacy permission caches use numeric team memberships.
					for _, grant := range []struct{ action, scope string }{
						{"dashboards:read", "dashboards:uid:individual"},
						{"dashboards:view", "dashboards:uid:action-set"},
					} {
						addContractUserGrant(t, s.sql, fmt.Sprintf("managed:%s", grant.action), requester.OrgID, userID,
							accesscontrol.Permission{Action: grant.action, Scope: grant.scope, Kind: "dashboards"})
					}
					addContractUserGrant(t, s.sql, "managed:team", requester.OrgID, userID+1,
						accesscontrol.Permission{Action: "dashboards:read", Scope: "dashboards:uid:team", Kind: "dashboards"})
					require.NoError(t, s.sql.WithDbSession(t.Context(), func(sess *db.Session) error {
						var role accesscontrol.Role
						found, err := sess.Where("name = ?", "managed:team").Get(&role)
						if err != nil {
							return err
						}
						if !found {
							return fmt.Errorf("managed team role was not created")
						}
						_, err = sess.Insert(&accesscontrol.TeamRole{OrgID: requester.OrgID, TeamID: teamID, RoleID: role.ID, Created: time.Now()})
						return err
					}))
					loader := newContractLoader(s, s.cache)
					embedded := legacypermissions.NewEmbeddedClient(loader, s.cfg)

					load := func(ctx context.Context, options accesscontrol.Options) ([]accesscontrol.Permission, error) {
						switch route {
						case "local":
							return s.GetLocalUserPermissions(ctx, requester, options)
						case "loader":
							return loader.GetUserPermissions(ctx, requester, options)
						default:
							return GetLegacyUserPermissions(ctx, embedded, requester, options, s.cfg)
						}
					}
					// Reuse the same cache across both transitions, including a return to an earlier decision.
					for _, enabled := range []bool{initial, !initial, initial, !initial} {
						target := "disabled"
						if enabled {
							target = "enabled"
						}
						ctx := openfeature.WithTransactionContext(t.Context(), openfeature.NewEvaluationContext(target, nil))
						got, err := load(ctx, accesscontrol.Options{})
						require.NoError(t, err)
						want := []accesscontrol.Permission{SharedWithMeFolderPermission, {Action: "dashboards:read", Scope: "dashboards:uid:action-set"}}
						if !enabled {
							want = append(want, accesscontrol.Permission{Action: "dashboards:read", Scope: "dashboards:uid:individual"}, accesscontrol.Permission{Action: "dashboards:read", Scope: "dashboards:uid:team"})
						}
						require.ElementsMatch(t, want, rawPermissions(got), "filter enabled=%t", enabled)
					}

					enabledCtx := openfeature.WithTransactionContext(t.Context(), openfeature.NewEvaluationContext("enabled", nil))
					disabledCtx := openfeature.WithTransactionContext(t.Context(), openfeature.NewEvaluationContext("disabled", nil))
					require.NoError(t, s.sql.WithDbSession(t.Context(), func(sess *db.Session) error {
						if _, err := sess.Exec("UPDATE permission SET scope = ? WHERE scope = ?", "dashboards:uid:refreshed", "dashboards:uid:action-set"); err != nil {
							return err
						}
						_, err := sess.Exec("UPDATE permission SET scope = ? WHERE scope = ?", "dashboards:uid:team-refreshed", "dashboards:uid:team")
						return err
					}))
					_, err := load(enabledCtx, accesscontrol.Options{ReloadCache: true})
					require.NoError(t, err)
					refreshed, err := load(disabledCtx, accesscontrol.Options{})
					require.NoError(t, err)
					require.ElementsMatch(t, []accesscontrol.Permission{
						SharedWithMeFolderPermission,
						{Action: "dashboards:read", Scope: "dashboards:uid:individual"},
						{Action: "dashboards:read", Scope: "dashboards:uid:refreshed"},
						{Action: "dashboards:read", Scope: "dashboards:uid:team-refreshed"},
					}, rawPermissions(refreshed))

					require.NoError(t, s.sql.WithDbSession(t.Context(), func(sess *db.Session) error {
						_, err := sess.Exec("DELETE FROM permission WHERE scope = ?", "dashboards:uid:refreshed")
						return err
					}))
					// Clear through the other reader to verify that shared invalidation still works.
					if route == "local" {
						require.NoError(t, loader.ClearUserPermissionCache(t.Context(), requester))
					} else {
						s.ClearUserPermissionCache(requester)
					}
					for _, ctx := range []context.Context{enabledCtx, disabledCtx} {
						got, err := load(ctx, accesscontrol.Options{})
						require.NoError(t, err)
						require.NotContains(t, rawPermissions(got), accesscontrol.Permission{Action: "dashboards:read", Scope: "dashboards:uid:refreshed"})
					}
				})
			}
		}
	}
}

type changingManagedPermissionProvider struct {
	openfeature.NoopProvider
	calls atomic.Int64
}

func (p *changingManagedPermissionProvider) BooleanEvaluation(_ context.Context, flag string, fallback bool, _ openfeature.FlattenedContext) openfeature.BoolResolutionDetail {
	if flag != featuremgmt.FlagExcludeRedundantManagedPermissions {
		return openfeature.BoolResolutionDetail{Value: fallback}
	}

	// A second evaluation in the same load would disagree with its cache key.
	const firstEvaluation = 1
	return openfeature.BoolResolutionDetail{Value: p.calls.Add(1) == firstEvaluation}
}

func TestManagedPermissionFilteringCapturedPerLoad(t *testing.T) {
	provider := &changingManagedPermissionProvider{}
	require.NoError(t, openfeature.SetProviderAndWait(provider))
	t.Cleanup(func() { require.NoError(t, openfeature.SetProviderAndWait(openfeature.NoopProvider{})) })

	const orgID int64 = 1
	const userID int64 = 7
	requester := &user.SignedInUser{UserID: userID, OrgID: orgID, OrgRole: org.RoleNone}
	cache := localcache.New(0, 0)
	cache.Set(accesscontrol.GetBasicRolePermissionCacheKey(string(org.RoleNone), orgID), []accesscontrol.Permission{}, accesscontrol.PermissionCacheTTL)
	cfg := setting.NewCfg()
	cfg.RBAC.PermissionCache = true
	store := actest.NewMockStore(t)
	s := &Service{
		openFeatureClient: openfeature.NewDefaultClient(),
		cache:             cache,
		cfg:               cfg,
		store:             store,
		actionResolver:    resourcepermissions.NewActionSetService(),
	}

	for _, filtered := range []bool{true, false} {
		store.On("GetUserPermissions", mock.Anything, accesscontrol.GetUserPermissionsQuery{
			OrgID:                              orgID,
			UserID:                             userID,
			RolePrefixes:                       OSSRolesPrefixes,
			ExcludeRedundantManagedPermissions: filtered,
		}).Return([]accesscontrol.Permission{}, nil).Once()

		got, err := s.GetRBACUserPermissions(t.Context(), requester, accesscontrol.Options{})
		require.NoError(t, err)
		require.Equal(t, []accesscontrol.Permission{SharedWithMeFolderPermission}, got)
	}

	const expectedEvaluations int64 = 2
	require.Equal(t, expectedEvaluations, provider.calls.Load())
}

type blockingManagedPermissionStore struct {
	accesscontrol.Store
	release <-chan struct{}
}

func (s blockingManagedPermissionStore) GetUserPermissions(_ context.Context, q accesscontrol.GetUserPermissionsQuery) ([]accesscontrol.Permission, error) {
	if q.ExcludeRedundantManagedPermissions {
		return nil, nil
	}
	<-s.release
	return []accesscontrol.Permission{{Action: "dashboards:read", Scope: "dashboards:uid:individual"}}, nil
}

func TestManagedPermissionFilteringConcurrentAssemblies(t *testing.T) {
	require.NoError(t, openfeature.SetProviderAndWait(managedPermissionFeatureProvider{}))
	t.Cleanup(func() { require.NoError(t, openfeature.SetProviderAndWait(openfeature.NoopProvider{})) })
	synctest.Test(t, func(t *testing.T) {
		cache := localcache.New(0, 0)
		cfg := setting.NewCfg()
		cfg.RBAC.PermissionCache = true
		release := make(chan struct{})
		s := &Service{openFeatureClient: openfeature.NewDefaultClient(), cache: cache, cfg: cfg, store: blockingManagedPermissionStore{release: release}, actionResolver: resourcepermissions.NewActionSetService()}
		requester := &user.SignedInUser{UserID: 7, OrgID: 1, OrgRole: org.RoleNone}
		cache.Set(accesscontrol.GetBasicRolePermissionCacheKey(string(org.RoleNone), requester.OrgID), []accesscontrol.Permission{}, accesscontrol.PermissionCacheTTL)
		filtered := []accesscontrol.Permission{SharedWithMeFolderPermission}
		unfiltered := append([]accesscontrol.Permission{{Action: "dashboards:read", Scope: "dashboards:uid:individual"}}, filtered...)
		type result struct {
			permissions []accesscontrol.Permission
			err         error
		}
		off, on := make(chan result, 1), make(chan result, 1)
		load := func(target string, results chan<- result) {
			ctx := openfeature.WithTransactionContext(t.Context(), openfeature.NewEvaluationContext(target, nil))
			permissions, err := s.GetRBACUserPermissions(ctx, requester, accesscontrol.Options{})
			results <- result{permissions, err}
		}
		go load("disabled", off)
		synctest.Wait()
		go load("enabled", on)
		synctest.Wait()
		select {
		case got := <-on:
			assert.NoError(t, got.err)
			assert.Equal(t, filtered, got.permissions)
		default:
			t.Error("filtered request joined an unfiltered assembly")
		}
		close(release)
		synctest.Wait()
		got := <-off
		require.NoError(t, got.err)
		require.Equal(t, unfiltered, got.permissions)
	})
}
