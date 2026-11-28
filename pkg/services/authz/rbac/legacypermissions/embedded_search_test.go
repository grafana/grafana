package legacypermissions

import (
	"context"
	"errors"
	"fmt"
	"sync/atomic"
	"testing"
	"testing/synctest"
	"time"

	"github.com/grafana/authlib/types"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/infra/log"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/resourcepermissions"
	"github.com/grafana/grafana/pkg/services/accesscontrol/shadow"
	"github.com/grafana/grafana/pkg/services/authz/legacyclient"
	"github.com/grafana/grafana/pkg/services/authz/zanzana/legacyscopes"
	"github.com/grafana/grafana/pkg/services/licensing"
	"github.com/grafana/grafana/pkg/services/licensing/licensingtest"
	"github.com/grafana/grafana/pkg/setting"
)

type searchTestStore struct {
	search func(context.Context, int64, ac.SearchOptions) (map[int64][]ac.Permission, error)
}

func (s searchTestStore) SearchUsersPermissions(ctx context.Context, orgID int64, options ac.SearchOptions) (map[int64][]ac.Permission, error) {
	return s.search(ctx, orgID, options)
}

func (s searchTestStore) GetUsersBasicRoles(context.Context, []int64, int64) (map[int64][]string, error) {
	return map[int64][]string{1: {"Viewer"}, 2: {"Viewer"}, 3: {"Viewer"}}, nil
}

func newSearchTestEngine(store SearchStore, resolver *ZanzanaPermissionResolver) *PermissionSearch {
	return NewPermissionSearch(store, func() map[string][]ac.Permission { return nil },
		resourcepermissions.NewActionSetService(), localcache.New(0, 0), nil, resolver, log.New("test"))
}

func embeddedSearchTestRequest() legacyclient.LegacySearchUsersPermissionsRequest {
	return legacyclient.LegacySearchUsersPermissionsRequest{
		Namespace: "default",
		Options:   ac.SearchOptions{Action: "test:read"},
		Requester: legacyclient.LegacySearchRequester{
			Identity: legacyclient.LegacyPermissionIdentity{Type: types.TypeUser, UID: "caller"},
			OrgID:    1,
			EffectivePermissions: map[string][]string{
				ac.ActionUsersPermissionsRead: {"users:*"},
			},
		},
	}
}

func TestEmbeddedSearchExecutesAuthZWithEffectivePermissions(t *testing.T) {
	type requestKey struct{}
	ctx := context.WithValue(t.Context(), requestKey{}, "original request")
	req := embeddedSearchTestRequest()
	req.Options.Scope = "tests:id:one"
	req.Requester.EffectivePermissions[ac.ActionUsersPermissionsRead] = []string{"users:id:3", "global.users:*"}
	grant := ac.Permission{
		ID: 5, RoleID: 6, Action: "test:read", Scope: "tests:id:one", Kind: "tests", Attribute: "id", Identifier: "one",
		DatasourceType: "test", Created: time.Unix(1000, 0).UTC(), Updated: time.Unix(2000, 0).UTC(),
	}
	grants := make([]ac.Permission, 1001)
	for i := range grants {
		grants[i] = grant
	}
	store := searchTestStore{search: func(ctx context.Context, orgID int64, opts ac.SearchOptions) (map[int64][]ac.Permission, error) {
		require.Nil(t, ctx.Value(requestKey{}))
		require.Equal(t, int64(1), orgID)
		require.Equal(t, req.Options.Scope, opts.Scope)
		return map[int64][]ac.Permission{2: {grant}, 3: grants}, nil
	}}
	client := NewEmbeddedClient(&Loader{license: &licensing.OSSLicensingService{}, search: newSearchTestEngine(store, nil)}, setting.NewCfg())
	got, err := client.LegacySearchUsersPermissions(ctx, LegacySearchPermissionCaller("default"), req)
	require.NoError(t, err)
	require.Equal(t, map[int64][]ac.Permission{3: grants}, got.Permissions)
}

func TestEmbeddedSearchRejectsInvalidCaller(t *testing.T) {
	client := NewEmbeddedClient(nil, setting.NewCfg())
	req := embeddedSearchTestRequest()
	_, err := client.LegacySearchUsersPermissions(t.Context(), LegacyPermissionCaller("default"), req)
	require.Equal(t, codes.PermissionDenied, status.Code(err))

	req.Requester.OrgID = 2
	_, err = client.LegacySearchUsersPermissions(t.Context(), LegacySearchPermissionCaller("default"), req)
	require.Equal(t, codes.PermissionDenied, status.Code(err))

	req.Requester.OrgID = 1
	req.Requester.Identity.Type = "invalid"
	_, err = client.LegacySearchUsersPermissions(t.Context(), LegacySearchPermissionCaller("default"), req)
	require.Equal(t, codes.InvalidArgument, status.Code(err))
	require.Equal(t, `unsupported legacy caller identity type "invalid"`, status.Convert(err).Message())
}

func TestEmbeddedSearchRejectsInvalidNamespace(t *testing.T) {
	client := NewEmbeddedClient(nil, setting.NewCfg())
	for _, tc := range []struct {
		name      string
		namespace string
		message   string
	}{
		{"malformed organization", "org-abc", "invalid namespace: invalid org id"},
		{"wildcard", "*", "concrete namespace required"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			req := embeddedSearchTestRequest()
			req.Namespace = tc.namespace
			_, err := client.LegacySearchUsersPermissions(t.Context(), LegacySearchPermissionCaller("*"), req)
			require.Equal(t, codes.InvalidArgument, status.Code(err))
			require.Equal(t, tc.message, status.Convert(err).Message())
		})
	}
}

func TestEmbeddedSearchWithDoneContext(t *testing.T) {
	client := NewEmbeddedClient(nil, setting.NewCfg())
	req := embeddedSearchTestRequest()
	caller := LegacySearchPermissionCaller("default")
	ctx, cancel := context.WithCancel(t.Context())
	cancel()
	_, err := client.LegacySearchUsersPermissions(ctx, caller, req)
	require.ErrorIs(t, err, context.Canceled)

	ctx, cancel = context.WithDeadline(t.Context(), time.Time{})
	defer cancel()
	_, err = client.LegacySearchUsersPermissions(ctx, caller, req)
	require.ErrorIs(t, err, context.DeadlineExceeded)
}

func TestEmbeddedSearchPreservesBackendFailureDuringCancellation(t *testing.T) {
	cause := errors.New("backend failed")
	for _, tc := range []struct {
		name    string
		fail    func() error
		code    codes.Code
		message string
		cause   error
	}{
		{
			name: "backend error",
			fail: func() error {
				return fmt.Errorf("%w: %w", status.Error(codes.Unavailable, "SQL unavailable"), cause)
			},
			code:  codes.Unavailable,
			cause: cause,
		},
		{
			name:    "backend panic",
			fail:    func() error { panic("private backend panic details") },
			code:    codes.Internal,
			message: "legacy permission search failed",
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			synctest.Test(t, func(t *testing.T) {
				ctx, cancel := context.WithCancel(t.Context())
				defer cancel()
				started, canceled, release := make(chan struct{}), make(chan struct{}), make(chan struct{})
				store := searchTestStore{search: func(ctx context.Context, _ int64, _ ac.SearchOptions) (map[int64][]ac.Permission, error) {
					close(started)
					<-ctx.Done()
					close(canceled)
					<-release
					return nil, tc.fail()
				}}
				client := NewEmbeddedClient(&Loader{license: &licensing.OSSLicensingService{}, search: newSearchTestEngine(store, nil)}, setting.NewCfg())
				result := make(chan error, 1)
				go func() {
					_, err := client.LegacySearchUsersPermissions(ctx, LegacySearchPermissionCaller("default"), embeddedSearchTestRequest())
					result <- err
				}()
				<-started
				cancel()
				<-canceled
				synctest.Wait()
				select {
				case err := <-result:
					close(release)
					t.Fatalf("client returned before the backend failure: %v", err)
				default:
				}
				close(release)
				err := <-result
				require.Equal(t, tc.code, status.Code(err))
				if tc.cause != nil {
					require.ErrorIs(t, err, tc.cause)
				}
				if tc.message != "" {
					require.Equal(t, tc.message, status.Convert(err).Message())
				}
			})
		})
	}
}

func TestEmbeddedSearchShadowDoesNotReadOrWriteNamedUserCache(t *testing.T) {
	req := embeddedSearchTestRequest()
	req.Options.UserID = 2
	grant := ac.Permission{Action: "test:read", Scope: "tests:id:one"}
	var dbReads atomic.Int64
	store := searchTestStore{search: func(context.Context, int64, ac.SearchOptions) (map[int64][]ac.Permission, error) {
		p := grant
		p.Scope = fmt.Sprintf("tests:id:%d", dbReads.Add(1))
		return map[int64][]ac.Permission{2: {p}}, nil
	}}
	client := NewEmbeddedClient(&Loader{license: &licensing.OSSLicensingService{}, search: newSearchTestEngine(store, nil)}, setting.NewCfg())
	caller := LegacySearchPermissionCaller(req.Namespace)

	search := func(ctx context.Context, want string, reads int64) {
		t.Helper()
		got, err := client.LegacySearchUsersPermissions(ctx, caller, req)
		require.NoError(t, err)
		require.Equal(t, want, got.Permissions[2][0].Scope)
		require.Equal(t, reads, dbReads.Load())
	}

	// A cold shadow read must not fill the cache. A hot shadow read must
	// still query storage and must not replace the ordinary result.
	search(shadow.WithContext(t.Context()), "tests:id:1", 1)
	search(t.Context(), "tests:id:2", 2)
	search(shadow.WithContext(t.Context()), "tests:id:3", 3)
	search(t.Context(), "tests:id:2", 3)
}

func TestEmbeddedSearchShadowAppliesUnlicensedOuterScopeFiltering(t *testing.T) {
	store := searchTestStore{search: func(context.Context, int64, ac.SearchOptions) (map[int64][]ac.Permission, error) {
		return map[int64][]ac.Permission{2: {{Action: "teams:read", Scope: "teams:id:7"}}}, nil
	}}
	engine := newSearchTestEngine(store, nil)
	engine.scopeResolver = searchScopeResolverFunc(func(_ context.Context, _ types.NamespaceInfo, ref legacyscopes.ScopeReference) (string, error) {
		if ref == (legacyscopes.ScopeReference{Resource: "teams", Attribute: "id", Value: "7"}) {
			return "target-team", nil
		}
		t.Errorf("unexpected scope lookup: %v", ref)
		return "", nil
	})
	license := licensingtest.NewFakeLicensing()
	license.On("FeatureEnabled", "accesscontrol.enforcement").Return(false)
	license.On("Edition").Return("Enterprise")
	client := NewEmbeddedClient(&Loader{license: license, search: engine}, setting.NewCfg())
	req := embeddedSearchTestRequest()
	req.Options.Action, req.Options.Scope = "teams:read", "teams:id:7"
	originalScope := "teams:uid:target-team"
	req.FallbackScope = &originalScope
	caller := LegacySearchPermissionCaller(req.Namespace)

	ordinary, err := client.LegacySearchUsersPermissions(t.Context(), caller, req)
	require.NoError(t, err)
	require.Equal(t, map[int64][]ac.Permission{2: {{Action: "teams:read", Scope: "teams:id:7"}}}, ordinary.Permissions)
	observed, err := client.LegacySearchUsersPermissions(shadow.WithContext(t.Context()), caller, req)
	require.NoError(t, err)
	require.Equal(t, map[int64][]ac.Permission{2: {{Action: "teams:read", Scope: originalScope}}}, observed.Permissions)
}
