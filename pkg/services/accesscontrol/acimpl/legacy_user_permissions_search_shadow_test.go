package acimpl

import (
	"context"
	"errors"
	"slices"
	"testing"
	"testing/synctest"
	"time"

	"github.com/grafana/authlib/types"
	"github.com/open-feature/go-sdk/openfeature"
	promtest "github.com/prometheus/client_golang/prometheus/testutil"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/registry/apis/iam"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/resourcepermissions"
	"github.com/grafana/grafana/pkg/services/accesscontrol/shadow"
	"github.com/grafana/grafana/pkg/services/authz/legacyclient"
	"github.com/grafana/grafana/pkg/services/contexthandler/ctxkey"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

type searchShadowClient struct {
	legacyclient.LegacyUserPermissionsClient
	search func(context.Context, legacyclient.LegacySearchUsersPermissionsRequest) (legacyclient.LegacySearchUsersPermissionsResponse, error)
}

func (c searchShadowClient) LegacySearchUsersPermissions(ctx context.Context, _ types.AuthInfo, req legacyclient.LegacySearchUsersPermissionsRequest) (legacyclient.LegacySearchUsersPermissionsResponse, error) {
	return c.search(ctx, req)
}

type failingSearchShadowStore struct{ ac.Store }

func (failingSearchShadowStore) GetUsersBasicRoles(context.Context, []int64, int64) (map[int64][]string, error) {
	return nil, errors.New("direct search failed")
}

func TestPermissionSearchShadowPreservesDirectResult(t *testing.T) {
	featuremgmt.WithFlagValues(t, map[string]any{featuremgmt.FlagAuthzLegacyUserPermissionsSearch: true, featuremgmt.FlagAuthzLegacyUserPermissionsSearchShadow: true})
	synctest.Test(t, func(t *testing.T) {
		called := make(chan struct{}, 1)
		release := make(chan struct{})
		searchShadow, err := NewLegacyUserPermissionsSearchShadow(nil)
		require.NoError(t, err)
		svc := &Service{searchShadow: searchShadow, store: failingSearchShadowStore{}, legacyClient: searchShadowClient{search: func(context.Context, legacyclient.LegacySearchUsersPermissionsRequest) (legacyclient.LegacySearchUsersPermissionsResponse, error) {
			called <- struct{}{}
			<-release
			return legacyclient.LegacySearchUsersPermissionsResponse{}, errors.New("RPC failed")
		}}}
		_, err = svc.SearchUsersPermissions(t.Context(), &user.SignedInUser{OrgID: 1}, ac.SearchOptions{Action: "dashboards:read"})
		close(release)
		require.ErrorContains(t, err, "direct search failed")
		synctest.Wait()
		require.Len(t, called, 1)
	})
}

type permissionSearchTestStore struct{ ac.Store }

func (permissionSearchTestStore) GetUsersBasicRoles(context.Context, []int64, int64) (map[int64][]string, error) {
	return map[int64][]string{2: {"Viewer"}}, nil
}

func (permissionSearchTestStore) SearchUsersPermissions(context.Context, int64, ac.SearchOptions) (map[int64][]ac.Permission, error) {
	return map[int64][]ac.Permission{2: {{Action: "dashboards:read", Scope: "dashboards:uid:direct"}}}, nil
}

func TestPermissionSearchShadowFlagMatrix(t *testing.T) {
	for _, tc := range []struct {
		name           string
		search, shadow bool
		wantScope      string
		calls          int
	}{
		{"both off", false, false, "direct", 0},
		{"shadow only", false, true, "direct", 0},
		{"search only", true, false, "rpc", 1},
		{"both on", true, true, "direct", 1},
	} {
		t.Run(tc.name, func(t *testing.T) {
			provider := permissionSearchFlagProvider{search: tc.search, shadow: tc.shadow}
			require.NoError(t, openfeature.SetProviderAndWait(provider))
			t.Cleanup(func() { require.NoError(t, openfeature.SetProviderAndWait(openfeature.NoopProvider{})) })
			synctest.Test(t, func(t *testing.T) {
				calls := make(chan bool, 1)
				client := searchShadowClient{search: func(ctx context.Context, _ legacyclient.LegacySearchUsersPermissionsRequest) (legacyclient.LegacySearchUsersPermissionsResponse, error) {
					calls <- shadow.IsShadow(ctx)
					return legacyclient.LegacySearchUsersPermissionsResponse{Permissions: map[int64][]ac.Permission{
						2: {{Action: "dashboards:read", Scope: "dashboards:uid:rpc"}},
					}}, nil
				}}
				svc, err := ProvideOSSService(setting.NewCfg(), permissionSearchTestStore{}, resourcepermissions.NewActionSetService(),
					nil, nil, nil, nil, nil, nil, iam.Features{}, client, nil)
				require.NoError(t, err)
				ctx := openfeature.WithTransactionContext(t.Context(), openfeature.NewEvaluationContext("search-test", nil))
				caller := &user.SignedInUser{OrgID: 1, Permissions: map[int64]map[string][]string{1: {ac.ActionUsersPermissionsRead: {"users:*"}}}}
				got, err := svc.SearchUsersPermissions(ctx, caller, ac.SearchOptions{Action: "dashboards:read"})
				require.NoError(t, err)
				require.Equal(t, map[int64][]ac.Permission{2: {{Action: "dashboards:read", Scope: "dashboards:uid:" + tc.wantScope}}}, got)
				synctest.Wait()
				require.Len(t, calls, tc.calls)
				if tc.calls != 0 {
					require.Equal(t, tc.shadow, <-calls)
				}
			})
		})
	}
}

type permissionSearchFlagProvider struct {
	openfeature.NoopProvider
	search, shadow bool
}

func (p permissionSearchFlagProvider) BooleanEvaluation(ctx context.Context, flag string, defaultValue bool, eval openfeature.FlattenedContext) openfeature.BoolResolutionDetail {
	if eval[openfeature.TargetingKey] == "search-test" {
		switch flag {
		case featuremgmt.FlagAuthzLegacyUserPermissionsSearch:
			return openfeature.BoolResolutionDetail{Value: p.search}
		case featuremgmt.FlagAuthzLegacyUserPermissionsSearchShadow:
			return openfeature.BoolResolutionDetail{Value: p.shadow}
		}
	}
	return p.NoopProvider.BooleanEvaluation(ctx, flag, defaultValue, eval)
}

func TestPermissionSearchShadowSnapshots(t *testing.T) {
	enablePermissionSearchShadow(t)
	synctest.Test(t, func(t *testing.T) {
		type requestKey struct{}
		eval := openfeature.NewEvaluationContext("stacks-42", map[string]any{"namespace": "stacks-42"})
		ctx, cancel := context.WithCancel(openfeature.WithTransactionContext(t.Context(), eval))
		defer cancel()
		ctx = context.WithValue(ctx, requestKey{}, "request value")
		teamIDs := []int64{1}
		caller := &user.SignedInUser{
			OrgID: 1, Namespace: "stacks-42", UserID: 5, UserUID: "caller",
			TeamIDs:  teamIDs, //nolint:staticcheck // The legacy Search RPC still snapshots numeric team membership.
			TeamUIDs: []string{"team"}, ExternalGroups: []string{"group"},
			IDToken: "test-id-token", AccessToken: "test-access-token",
			Permissions: map[int64]map[string][]string{1: {"users:read": {"users:id:2"}}, ac.GlobalOrgID: {"global.users:read": {"global.users:id:2"}}},
		}
		ctx = ctxkey.Set(ctx, &contextmodel.ReqContext{SignedInUser: caller})
		options := ac.SearchOptions{Action: "dashboards:read", Scope: "dashboards:uid:one", ActionSets: []string{"set"}, RolePrefixes: []string{"managed:"}}
		wildcards := options.Wildcards()
		originalWildcard := wildcards[0]
		expected := map[int64][]ac.Permission{2: {{Action: "dashboards:read", Scope: "dashboards:uid:one"}}, 3: nil}
		primary := map[int64][]ac.Permission{2: slices.Clone(expected[2]), 3: nil}
		release := make(chan struct{})
		client := searchShadowClient{search: func(ctx context.Context, req legacyclient.LegacySearchUsersPermissionsRequest) (legacyclient.LegacySearchUsersPermissionsResponse, error) {
			<-release
			assert.NoError(t, ctx.Err())
			assert.Nil(t, ctx.Value(requestKey{}))
			assert.Nil(t, ctxkey.Get(ctx))
			assert.True(t, shadow.IsShadow(ctx))
			assert.Equal(t, eval, openfeature.TransactionContext(ctx))
			assert.Equal(t, "stacks-42", req.Namespace)
			assert.Equal(t, []int64{1}, req.Requester.Identity.TeamIDs)
			assert.Equal(t, []string{"team"}, req.Requester.Identity.Groups)
			assert.Equal(t, []string{"group"}, req.Requester.ExternalGroups)
			assert.Equal(t, []string{"users:id:2"}, req.Requester.EffectivePermissions["users:read"])
			assert.Equal(t, []string{"global.users:id:2"}, req.Requester.GlobalPermissions["global.users:read"])
			assert.Equal(t, []string{"set"}, req.Options.ActionSets)
			assert.Equal(t, []string{"managed:"}, req.Options.RolePrefixes)
			assert.Equal(t, originalWildcard, req.Options.Wildcards()[0])
			assert.True(t, req.Requester.HasDirectoryContext)
			assert.Equal(t, "test-id-token", req.Requester.IAMIDToken)
			assert.Equal(t, "test-access-token", req.Requester.IAMAccessToken)
			return legacyclient.LegacySearchUsersPermissionsResponse{Permissions: expected}, nil
		}}
		adapter, err := NewLegacyUserPermissionsSearchShadow(nil)
		require.NoError(t, err)
		got, err := adapter.Search(ctx, client, caller, options, nil, func() (map[int64][]ac.Permission, error) {
			caller.Permissions[1]["users:read"][0] = "mutated within primary"
			return primary, nil
		})
		require.NoError(t, err)
		require.Equal(t, expected, got)

		teamIDs[0], caller.TeamUIDs[0], caller.ExternalGroups[0] = 9, "different team", "different group"
		caller.Permissions[ac.GlobalOrgID]["global.users:read"][0] = "different global grants"
		options.ActionSets[0], options.RolePrefixes[0] = "different set", "different prefix"
		wildcards[0] = "different wildcard"
		caller.IDToken, caller.AccessToken = "different ID token", "different access token"
		got[2][0].Scope = "different scope"
		delete(got, 3)
		cancel()
		close(release)
		synctest.Wait()
		require.EqualValues(t, 1, promtest.ToFloat64(adapter.results.WithLabelValues(string(shadow.Match))))
	})
}

func TestPermissionSearchShadowComparison(t *testing.T) {
	enablePermissionSearchShadow(t)
	for _, tc := range []struct {
		name    string
		rpc     map[int64][]ac.Permission
		outcome shadow.Outcome
	}{
		{"ordering duplicate and covered scope", map[int64][]ac.Permission{2: {
			{Action: "teams:read", Scope: "teams:id:6"},
			{Action: "dashboards:read", Scope: "dashboards:uid:one"},
			{Action: "teams:read", Scope: "teams:id:5"},
			{Action: "teams:read", Scope: "teams:id:6"},
			{Action: "dashboards:read", Scope: "dashboards:*"},
		}, 3: {}}, shadow.Match},
		{"missing empty user", map[int64][]ac.Permission{2: {
			{Action: "dashboards:read", Scope: "dashboards:*"},
			{Action: "teams:read", Scope: "teams:id:5"},
			{Action: "teams:read", Scope: "teams:id:6"},
		}}, shadow.Mismatch},
		{"extra empty user", map[int64][]ac.Permission{2: {
			{Action: "dashboards:read", Scope: "dashboards:*"},
			{Action: "teams:read", Scope: "teams:id:5"},
			{Action: "teams:read", Scope: "teams:id:6"},
		}, 3: nil, 4: nil}, shadow.Mismatch},
		{"changed scope", map[int64][]ac.Permission{2: {
			{Action: "dashboards:read", Scope: "dashboards:*"},
			{Action: "teams:read", Scope: "teams:id:5"},
			{Action: "teams:read", Scope: "teams:id:7"},
		}, 3: nil}, shadow.Mismatch},
		{"changed action", map[int64][]ac.Permission{2: {
			{Action: "dashboards:read", Scope: "dashboards:*"},
			{Action: "teams:write", Scope: "teams:id:5"},
			{Action: "teams:write", Scope: "teams:id:6"},
		}, 3: nil}, shadow.Mismatch},
	} {
		t.Run(tc.name, func(t *testing.T) {
			synctest.Test(t, func(t *testing.T) {
				adapter, err := NewLegacyUserPermissionsSearchShadow(nil)
				require.NoError(t, err)
				client := searchShadowClient{search: func(context.Context, legacyclient.LegacySearchUsersPermissionsRequest) (legacyclient.LegacySearchUsersPermissionsResponse, error) {
					return legacyclient.LegacySearchUsersPermissionsResponse{Permissions: tc.rpc}, nil
				}}
				_, err = adapter.Search(t.Context(), client, &user.SignedInUser{OrgID: 1}, ac.SearchOptions{}, nil, func() (map[int64][]ac.Permission, error) {
					return map[int64][]ac.Permission{2: {
						{Action: "dashboards:read", Scope: "dashboards:*"},
						{Action: "teams:read", Scope: "teams:id:5"},
						{Action: "teams:read", Scope: "teams:id:6"},
					}, 3: nil}, nil
				})
				require.NoError(t, err)
				synctest.Wait()
				require.EqualValues(t, 1, promtest.ToFloat64(adapter.results.WithLabelValues(string(tc.outcome))))
			})
		})
	}
}

func TestPermissionSearchShadowFailuresLeaveResponseAlone(t *testing.T) {
	enablePermissionSearchShadow(t)
	for _, tc := range []struct {
		name string
		call func(context.Context)
	}{
		{"RPC error", func(context.Context) {}},
		{"timeout", func(ctx context.Context) { <-ctx.Done() }},
		{"panic", func(context.Context) { panic("test RPC panic") }},
	} {
		t.Run(tc.name, func(t *testing.T) {
			synctest.Test(t, func(t *testing.T) {
				adapter, err := NewLegacyUserPermissionsSearchShadow(nil)
				require.NoError(t, err)
				unblock, done := make(chan struct{}), make(chan struct{})
				client := searchShadowClient{search: func(ctx context.Context, _ legacyclient.LegacySearchUsersPermissionsRequest) (legacyclient.LegacySearchUsersPermissionsResponse, error) {
					defer close(done)
					<-unblock
					tc.call(ctx)
					return legacyclient.LegacySearchUsersPermissionsResponse{}, errors.New("test RPC failure")
				}}
				want := map[int64][]ac.Permission{2: {{Action: "dashboards:read"}}}
				start := time.Now()
				got, err := adapter.Search(t.Context(), client, &user.SignedInUser{OrgID: 1}, ac.SearchOptions{}, nil, func() (map[int64][]ac.Permission, error) {
					return want, nil
				})
				require.NoError(t, err)
				require.Equal(t, want, got)
				close(unblock)
				<-done
				synctest.Wait()
				require.EqualValues(t, 1, promtest.ToFloat64(adapter.results.WithLabelValues(string(shadow.Failed))))
				require.Zero(t, promtest.ToFloat64(adapter.results.WithLabelValues(string(shadow.Mismatch))))
				if tc.name == "timeout" {
					require.Equal(t, 10*time.Second, time.Since(start))
				}
			})
		})
	}
}

func TestPermissionSearchShadowSkipsBusyAndTransactionalCalls(t *testing.T) {
	enablePermissionSearchShadow(t)
	synctest.Test(t, func(t *testing.T) {
		adapter, err := NewLegacyUserPermissionsSearchShadow(nil)
		require.NoError(t, err)
		release := make(chan struct{})
		calls := make(chan struct{}, 3)
		client := searchShadowClient{search: func(context.Context, legacyclient.LegacySearchUsersPermissionsRequest) (legacyclient.LegacySearchUsersPermissionsResponse, error) {
			calls <- struct{}{}
			<-release
			return legacyclient.LegacySearchUsersPermissionsResponse{}, nil
		}}
		caller := &user.SignedInUser{OrgID: 1}
		primaryCalls := 0
		primary := func() (map[int64][]ac.Permission, error) {
			primaryCalls++
			return nil, nil
		}
		txCtx := context.WithValue(t.Context(), sqlstore.ContextSessionKey{}, &sqlstore.DBSession{})
		_, err = adapter.Search(txCtx, client, caller, ac.SearchOptions{}, nil, primary)
		require.NoError(t, err)
		_, err = adapter.Search(t.Context(), client, caller, ac.SearchOptions{}, nil, primary)
		require.NoError(t, err)
		_, err = adapter.Search(t.Context(), client, caller, ac.SearchOptions{}, nil, primary)
		require.NoError(t, err)
		_, err = adapter.Search(shadow.WithContext(t.Context()), client, caller, ac.SearchOptions{}, nil, primary)
		require.NoError(t, err)
		close(release)
		synctest.Wait()
		require.Equal(t, 4, primaryCalls)
		require.Len(t, calls, 1)
		require.EqualValues(t, 1, promtest.ToFloat64(adapter.skipped.WithLabelValues(string(shadow.Transaction))))
		require.EqualValues(t, 1, promtest.ToFloat64(adapter.skipped.WithLabelValues(string(shadow.Capacity))))
		require.EqualValues(t, 1, promtest.ToFloat64(adapter.results.WithLabelValues(string(shadow.Match))))
	})
}

func enablePermissionSearchShadow(t *testing.T) {
	t.Helper()
	featuremgmt.WithFlagValues(t, map[string]any{
		featuremgmt.FlagAuthzLegacyUserPermissionsSearch:       true,
		featuremgmt.FlagAuthzLegacyUserPermissionsSearchShadow: true,
	})
}
