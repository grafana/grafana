package resource

import (
	"context"
	"errors"
	"net/http"
	"testing"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/testutil"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	otelcodes "go.opentelemetry.io/otel/codes"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	"go.opentelemetry.io/otel/sdk/trace/tracetest"

	authnlib "github.com/grafana/authlib/authn"
	authlib "github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/log/logtest"
	"github.com/grafana/grafana/pkg/services/dashboards/dashboardaccess"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// userWithDelegatedPermissions mirrors what search-api sees when storage-api
// searches on behalf of a user.
func userWithDelegatedPermissions(delegated ...string) *identity.StaticRequester {
	return &identity.StaticRequester{
		Type:      authlib.TypeUser,
		UserID:    1,
		Namespace: "stacks-1",
		AccessTokenClaims: &authnlib.Claims[authnlib.AccessTokenClaims]{
			Rest: authnlib.AccessTokenClaims{
				Namespace:            "stacks-1",
				DelegatedPermissions: delegated,
			},
		},
	}
}

// tokenWithoutDelegation carries service permissions but no delegated ones,
// which is what storage-api's token looked like during the incident.
func tokenWithoutDelegation() *identity.StaticRequester {
	id := userWithDelegatedPermissions()
	id.AccessTokenClaims.Rest.Permissions = []string{"dashboards.insights:read"}
	return id
}

func newLimitedClient(t *testing.T) *authzLimitedClient {
	t.Helper()
	c, ok := NewAuthzLimitedClient(authlib.FixedAccessClient(true), AuthzOptions{Registry: prometheus.NewRegistry()}).(*authzLimitedClient)
	require.True(t, ok)
	return c
}

func missingDelegatedCount(c *authzLimitedClient, group, resource, verb string) float64 {
	return testutil.ToFloat64(c.metrics.missingDelegatedPermission.WithLabelValues(group, resource, verb))
}

func TestServiceCanDelegate(t *testing.T) {
	for name, tc := range map[string]struct {
		id        authlib.AuthInfo
		wantErr   bool
		wantCount float64
	}{
		// The incident shape: the token carries service permissions but cannot act
		// for a user on this resource.
		"token with permissions but none delegated": {
			id:        tokenWithoutDelegation(),
			wantErr:   true,
			wantCount: 1,
		},
		"access token with no visible permissions": {
			id: &identity.StaticRequester{
				Type: authlib.TypeUser, Namespace: "stacks-1", AccessToken: "verified-token",
			},
			wantErr:   true,
			wantCount: 1,
		},
		// Single-tenant and in-process callers carry no token permissions.
		"no token permissions at all": {
			id: userWithDelegatedPermissions(),
		},
		"delegated permission for the resource": {
			id: userWithDelegatedPermissions("dashboard.grafana.app/dashboards:get"),
		},
		// A permission without a resource covers every resource in the group.
		"delegated permission for the whole group": {
			id: userWithDelegatedPermissions("dashboard.grafana.app:get"),
		},
		// Without a user there is nothing to delegate.
		"service call without a user": {
			id: &identity.StaticRequester{Type: authlib.TypeAccessPolicy, Namespace: "stacks-1"},
		},
	} {
		t.Run(name, func(t *testing.T) {
			c := newLimitedClient(t)

			err := c.serviceCanDelegate(context.Background(), tc.id, "dashboard.grafana.app", "dashboards", utils.VerbGet)

			if tc.wantErr {
				require.ErrorIs(t, err, ErrServiceCannotDelegate)
				assert.Contains(t, err.Error(), "dashboard.grafana.app/dashboards:get")
			} else {
				require.NoError(t, err)
			}
			assert.Equal(t, tc.wantCount, missingDelegatedCount(c, "dashboard.grafana.app", "dashboards", utils.VerbGet))
		})
	}
}

// A token that cannot delegate is a deployment mistake, so every entry point
// fails instead of passing on a denial that reads as "the user has no access".
func TestAuthzLimitedClient_RefusesWhenServiceCannotDelegate(t *testing.T) {
	const group, res = "dashboard.grafana.app", "dashboards"
	id := tokenWithoutDelegation()

	t.Run("Check", func(t *testing.T) {
		c := newLimitedClient(t)
		resp, err := c.Check(context.Background(), id, authlib.CheckRequest{
			Namespace: "stacks-1", Group: group, Resource: res, Verb: utils.VerbGet, Name: "dash1",
		}, "folder1")
		require.ErrorIs(t, err, ErrServiceCannotDelegate)
		assert.False(t, resp.Allowed)
		assert.Equal(t, 1.0, missingDelegatedCount(c, group, res, utils.VerbGet))
	})

	t.Run("Compile", func(t *testing.T) {
		c := newLimitedClient(t)
		checker, _, err := c.Compile(context.Background(), id, authlib.ListRequest{
			Namespace: "stacks-1", Group: group, Resource: res, Verb: utils.VerbList,
		})
		require.ErrorIs(t, err, ErrServiceCannotDelegate)
		assert.Nil(t, checker)
		assert.Equal(t, 1.0, missingDelegatedCount(c, group, res, utils.VerbList))
	})

	t.Run("BatchCheck", func(t *testing.T) {
		c := newLimitedClient(t)
		_, err := c.BatchCheck(context.Background(), id, authlib.BatchCheckRequest{
			Namespace: "stacks-1",
			Checks: []authlib.BatchCheckItem{
				{CorrelationID: "1", Group: group, Resource: res, Verb: utils.VerbGet, Name: "dash1"},
				{CorrelationID: "2", Group: group, Resource: res, Verb: utils.VerbGet, Name: "dash2"},
			},
		})
		require.ErrorIs(t, err, ErrServiceCannotDelegate)
		// Once per group, resource and verb, however many hits share it.
		assert.Equal(t, 1.0, missingDelegatedCount(c, group, res, utils.VerbGet))
	})

	t.Run("resources that are not RBAC enforced are unaffected", func(t *testing.T) {
		c := newLimitedClient(t)
		resp, err := c.Check(context.Background(), id, authlib.CheckRequest{
			Namespace: "stacks-1", Group: "playlist.grafana.app", Resource: "playlists", Verb: utils.VerbGet, Name: "p1",
		}, "")
		require.NoError(t, err)
		assert.True(t, resp.Allowed)
		assert.Equal(t, 0.0, missingDelegatedCount(c, "playlist.grafana.app", "playlists", utils.VerbGet))
	})

	t.Run("a token that can delegate reaches the underlying client", func(t *testing.T) {
		c := newLimitedClient(t)
		resp, err := c.Check(context.Background(), userWithDelegatedPermissions("dashboard.grafana.app/dashboards:get"),
			authlib.CheckRequest{Namespace: "stacks-1", Group: group, Resource: res, Verb: utils.VerbGet, Name: "dash1"}, "folder1")
		require.NoError(t, err)
		assert.True(t, resp.Allowed)
	})
}

func serviceWithPermissions(permissions ...string) *identity.StaticRequester {
	return &identity.StaticRequester{
		Type:        authlib.TypeAccessPolicy,
		Namespace:   "stacks-1",
		AccessToken: "verified-access-token",
		AccessTokenClaims: &authnlib.Claims[authnlib.AccessTokenClaims]{
			Rest: authnlib.AccessTokenClaims{Permissions: permissions},
		},
	}
}

func TestAuthzLimitedClient_ServicePermissions(t *testing.T) {
	userWithoutGrants := userWithDelegatedPermissions()
	userWithoutGrants.AccessToken = "verified-access-token"
	for name, tc := range map[string]struct {
		id      authlib.AuthInfo
		wantErr error
	}{
		"direct service missing grant": {serviceWithPermissions("folder.grafana.app:get"), ErrServicePermissionMissing},
		"direct service empty grants":  {serviceWithPermissions(), ErrServicePermissionMissing},
		"direct service wrong verb":    {serviceWithPermissions("dashboard.grafana.app:update"), ErrServicePermissionMissing},
		"direct service valid grant":   {serviceWithPermissions("dashboard.grafana.app/dashboards:get"), nil},
		"delegated empty grants":       {userWithoutGrants, ErrServiceCannotDelegate},
		"delegated valid grant":        {userWithDelegatedPermissions("dashboard.grafana.app/dashboards:get"), nil},
		"tokenless caller":             {userWithDelegatedPermissions(), nil},
	} {
		t.Run(name, func(t *testing.T) {
			c := newLimitedClient(t)
			req := authlib.CheckRequest{Namespace: "stacks-1", Group: "dashboard.grafana.app", Resource: "dashboards", Verb: utils.VerbGet}
			t.Run("Check", func(t *testing.T) {
				resp, err := c.Check(t.Context(), tc.id, req, "folder-1")
				require.ErrorIs(t, err, tc.wantErr)
				require.Equal(t, tc.wantErr == nil, resp.Allowed)
			})
			t.Run("Compile", func(t *testing.T) {
				checker, _, err := c.Compile(t.Context(), tc.id, authlib.ListRequest{
					Namespace: req.Namespace, Group: req.Group, Resource: req.Resource, Verb: utils.VerbList,
				})
				require.ErrorIs(t, err, tc.wantErr)
				if tc.wantErr == nil {
					require.True(t, checker("dash-1", "folder-1"))
				} else {
					require.Nil(t, checker)
				}
			})
			t.Run("BatchCheck", func(t *testing.T) {
				resp, err := c.BatchCheck(t.Context(), tc.id, authlib.BatchCheckRequest{
					Namespace: req.Namespace,
					Checks:    []authlib.BatchCheckItem{{CorrelationID: "1", Group: req.Group, Resource: req.Resource, Verb: req.Verb}},
				})
				require.ErrorIs(t, err, tc.wantErr)
				if tc.wantErr == nil {
					require.True(t, resp.Results["1"].Allowed)
				} else {
					require.Empty(t, resp.Results)
				}
			})
		})
	}
}

func TestAuthzLimitedClient_BatchCheckReturnsItemErrors(t *testing.T) {
	recorder := recordPermissionSpans(t)
	logger := &permissionTestLogger{}
	boom := errors.New("authorization failed")
	inner := &callbackAccessClient{fn: func(authlib.CheckRequest, string) (authlib.CheckResponse, error) {
		return authlib.CheckResponse{}, boom
	}}
	c := newLimitedClient(t)
	c.client = inner
	c.logger = logger
	resp, err := c.BatchCheck(t.Context(), userWithDelegatedPermissions("dashboard.grafana.app:get"), authlib.BatchCheckRequest{
		Namespace: "stacks-1",
		Checks:    []authlib.BatchCheckItem{{CorrelationID: "1", Group: "dashboard.grafana.app", Resource: "dashboards", Verb: utils.VerbGet}},
	})
	require.ErrorIs(t, err, boom)
	require.Empty(t, resp.Results)
	require.Equal(t, 1.0, testutil.ToFloat64(c.metrics.errorsTotal.WithLabelValues("", "", "batch_check")))
	require.Equal(t, 1, logger.ErrorLogs.Calls)
	require.Len(t, recorder.Ended(), 1)
	require.Equal(t, otelcodes.Error, recorder.Ended()[0].Status().Code)
}

func TestSearchServicePermissions(t *testing.T) {
	for name, tc := range map[string]struct {
		permissions    []string
		mutate         func(*resourcepb.ResourceSearchRequest)
		wantPermission string
	}{
		"read":         {permissions: []string{"dashboard.grafana.app:get"}},
		"missing read": {wantPermission: "dashboard.grafana.app/dashboards:get"},
		"edit requires update": {
			permissions:    []string{"dashboard.grafana.app:get"},
			mutate:         func(req *resourcepb.ResourceSearchRequest) { req.Permission = int64(dashboardaccess.PERMISSION_EDIT) },
			wantPermission: "dashboard.grafana.app/dashboards:update",
		},
		"trash requires folder admin check": {
			permissions:    []string{"dashboard.grafana.app:get"},
			mutate:         func(req *resourcepb.ResourceSearchRequest) { req.IsDeleted = true },
			wantPermission: "dashboard.grafana.app/dashboards:set_permissions",
		},
		"trash valid grants": {
			permissions: []string{"dashboard.grafana.app:set_permissions"},
			mutate:      func(req *resourcepb.ResourceSearchRequest) { req.IsDeleted = true },
		},
		"federated requires both resources": {
			permissions: []string{"dashboard.grafana.app:get"},
			mutate: func(req *resourcepb.ResourceSearchRequest) {
				req.Federated = []*resourcepb.ResourceKey{{Group: "folder.grafana.app", Resource: "folders"}}
			},
			wantPermission: "folder.grafana.app/folders:get",
		},
		"global requires underlying resource grants": {
			permissions: []string{"dashboard.grafana.app:get"},
			mutate: func(req *resourcepb.ResourceSearchRequest) {
				req.Options.Key.Group = GlobalSearchGroup
				req.Options.Key.Resource = GlobalSearchResource
			},
			wantPermission: "folder.grafana.app/folders:get",
		},
	} {
		t.Run(name, func(t *testing.T) {
			req := &resourcepb.ResourceSearchRequest{Options: &resourcepb.ListOptions{Key: &resourcepb.ResourceKey{
				Namespace: "stacks-1", Group: "dashboard.grafana.app", Resource: "dashboards",
			}}}
			if tc.mutate != nil {
				tc.mutate(req)
			}
			s := newPermissionTestSearchServer(newLimitedClient(t))
			ctx := authlib.WithAuthInfo(t.Context(), serviceWithPermissions(tc.permissions...))
			if tc.wantPermission == "" {
				require.NoError(t, s.checkSearchServicePermissions(ctx, req))
				return
			}
			// No index is configured: the failure must precede any index lookup.
			resp, err := s.Search(ctx, req)
			require.NoError(t, err)
			require.Equal(t, int32(http.StatusInternalServerError), resp.Error.GetCode())
			require.Contains(t, resp.Error.GetMessage(), tc.wantPermission)
		})
	}
}

func TestSearchServicePermissionExemptions(t *testing.T) {
	const group, resource = "playlist.grafana.app", "playlists"
	for mode, id := range map[string]authlib.AuthInfo{
		"direct":    serviceWithPermissions(),
		"delegated": tokenWithoutDelegation(),
	} {
		for _, tc := range []struct {
			name            string
			opts            AuthzOptions
			requestGroup    string
			requestResource string
			federated       bool
			namespace       string
			wantErr         error
			wantExempt      float64
		}{
			{name: "exempt", opts: AuthzOptions{ExemptionEnabled: true, ExemptResources: []string{group + "/" + resource}}, wantExempt: 1},
			{name: "legacy bypass", wantExempt: 1},
			{name: "not exempt", opts: AuthzOptions{ExemptionEnabled: true}, wantErr: ErrServicePermissionMissing},
			{name: "sibling resource", opts: AuthzOptions{ExemptionEnabled: true, ExemptResources: []string{group + "/other"}}, wantErr: ErrServicePermissionMissing},
			{name: "always enforced", requestGroup: "dashboard.grafana.app", requestResource: "dashboards", opts: AuthzOptions{ExemptionEnabled: true, ExemptResources: []string{group + "/" + resource}}, wantErr: ErrServicePermissionMissing},
			{name: "federated enforced resource", opts: AuthzOptions{ExemptionEnabled: true, ExemptResources: []string{group + "/" + resource}}, federated: true, wantExempt: 1, wantErr: ErrServicePermissionMissing},
			{name: "namespace mismatch", opts: AuthzOptions{ExemptionEnabled: true, ExemptResources: []string{group + "/" + resource}}, namespace: "stacks-2", wantErr: authlib.ErrNamespaceMismatch},
		} {
			t.Run(mode+"/"+tc.name, func(t *testing.T) {
				requestGroup, requestResource := tc.requestGroup, tc.requestResource
				if requestGroup == "" {
					requestGroup, requestResource = group, resource
				}
				namespace := tc.namespace
				if namespace == "" {
					namespace = "stacks-1"
				}
				logger := &permissionTestLogger{}
				s := newPermissionTestSearchServer(NewAuthzLimitedClient(authlib.FixedAccessClient(false), tc.opts))
				s.log = logger
				req := &resourcepb.ResourceSearchRequest{Options: &resourcepb.ListOptions{Key: &resourcepb.ResourceKey{
					Namespace: namespace, Group: requestGroup, Resource: requestResource,
				}}}
				if tc.federated {
					req.Federated = []*resourcepb.ResourceKey{{Group: "folder.grafana.app", Resource: "folders"}}
				}
				wantErr := tc.wantErr
				if mode == "delegated" && wantErr == ErrServicePermissionMissing {
					wantErr = ErrServiceCannotDelegate
				}
				err := s.checkSearchServicePermissions(authlib.WithAuthInfo(t.Context(), id), req)
				require.ErrorIs(t, err, wantErr)
				require.Equal(t, tc.wantExempt, testutil.ToFloat64(s.indexMetrics.SearchServicePermissionExemptions.WithLabelValues(group, resource, mode)))
				wantFailures := 0
				if wantErr != nil && wantErr != authlib.ErrNamespaceMismatch {
					wantFailures = 1
				}
				require.Equal(t, float64(wantFailures), testutil.ToFloat64(s.indexMetrics.SearchServicePermissionFailures.WithLabelValues(mode)))
				require.Equal(t, wantFailures, logger.ErrorLogs.Calls)
			})
		}
	}
}

func TestAuthzLimitedClient_UserDenialRemainsDenial(t *testing.T) {
	c := NewAuthzLimitedClient(authlib.FixedAccessClient(false), AuthzOptions{})
	id := userWithDelegatedPermissions("dashboard.grafana.app:get")
	resp, err := c.BatchCheck(t.Context(), id, authlib.BatchCheckRequest{
		Namespace: "stacks-1",
		Checks:    []authlib.BatchCheckItem{{CorrelationID: "1", Group: "dashboard.grafana.app", Resource: "dashboards", Verb: utils.VerbGet}},
	})
	require.NoError(t, err)
	require.Contains(t, resp.Results, "1")
	require.False(t, resp.Results["1"].Allowed)
}

func TestSearchServicePermissionsIdentityErrors(t *testing.T) {
	for name, tc := range map[string]struct {
		id       authlib.AuthInfo
		wantCode int32
	}{
		"missing identity": {wantCode: http.StatusUnauthorized},
		"wrong namespace":  {id: &identity.StaticRequester{Namespace: "stacks-2"}, wantCode: http.StatusForbidden},
	} {
		t.Run(name, func(t *testing.T) {
			ctx := t.Context()
			if tc.id != nil {
				ctx = authlib.WithAuthInfo(ctx, tc.id)
			}
			s := newPermissionTestSearchServer(newLimitedClient(t))
			resp, err := s.Search(ctx, &resourcepb.ResourceSearchRequest{Options: &resourcepb.ListOptions{Key: &resourcepb.ResourceKey{
				Namespace: "stacks-1", Group: "dashboard.grafana.app", Resource: "dashboards",
			}}})
			require.NoError(t, err)
			require.Equal(t, tc.wantCode, resp.Error.GetCode())
		})
	}
}

type incompleteAccessClient struct{ authlib.AccessClient }

func (incompleteAccessClient) BatchCheck(context.Context, authlib.AuthInfo, authlib.BatchCheckRequest) (authlib.BatchCheckResponse, error) {
	return authlib.BatchCheckResponse{Results: map[string]authlib.BatchCheckResult{}}, nil
}

func TestAuthzLimitedClient_BatchCheckReturnsMissingResultError(t *testing.T) {
	recorder := recordPermissionSpans(t)
	logger := &permissionTestLogger{}
	c := newLimitedClient(t)
	c.client = incompleteAccessClient{}
	c.logger = logger
	resp, err := c.BatchCheck(t.Context(), userWithDelegatedPermissions("dashboard.grafana.app:get"), authlib.BatchCheckRequest{
		Namespace: "stacks-1",
		Checks:    []authlib.BatchCheckItem{{CorrelationID: "1", Group: "dashboard.grafana.app", Resource: "dashboards", Verb: utils.VerbGet}},
	})
	require.ErrorContains(t, err, "missing authorization result")
	require.Empty(t, resp.Results)
	require.Equal(t, 1.0, testutil.ToFloat64(c.metrics.errorsTotal.WithLabelValues("", "", "batch_check")))
	require.Equal(t, 1, logger.ErrorLogs.Calls)
	require.Len(t, recorder.Ended(), 1)
	require.Equal(t, otelcodes.Error, recorder.Ended()[0].Status().Code)
}

func newPermissionTestSearchServer(client authlib.AccessClient) *searchServer {
	return &searchServer{access: client, indexMetrics: ProvideIndexMetrics(nil), log: log.NewNopLogger()}
}

type permissionTestLogger struct{ logtest.Fake }

func (l *permissionTestLogger) FromContext(context.Context) log.Logger { return l }

func recordPermissionSpans(t *testing.T) *tracetest.SpanRecorder {
	t.Helper()
	recorder := tracetest.NewSpanRecorder()
	provider := sdktrace.NewTracerProvider(sdktrace.WithSpanProcessor(recorder))
	original := tracer
	tracer = provider.Tracer("permissions-test")
	t.Cleanup(func() { tracer = original })
	return recorder
}

func TestSearchPermissionFailureMonitoring(t *testing.T) {
	for mode, id := range map[string]authlib.AuthInfo{
		"direct":    serviceWithPermissions("folder.grafana.app:get"),
		"delegated": tokenWithoutDelegation(),
	} {
		t.Run(mode, func(t *testing.T) {
			recorder := recordPermissionSpans(t)
			logger := &permissionTestLogger{}
			s := newPermissionTestSearchServer(authlib.FixedAccessClient(true))
			s.log = logger
			resp, err := s.Search(authlib.WithAuthInfo(t.Context(), id), &resourcepb.ResourceSearchRequest{Options: &resourcepb.ListOptions{Key: &resourcepb.ResourceKey{
				Namespace: "stacks-1", Group: "dashboard.grafana.app", Resource: "dashboards",
			}}})
			require.NoError(t, err)
			require.Equal(t, int32(http.StatusInternalServerError), resp.Error.GetCode())
			require.Equal(t, 1.0, testutil.ToFloat64(s.indexMetrics.SearchServicePermissionFailures.WithLabelValues(mode)))
			require.Equal(t, 1, logger.ErrorLogs.Calls)
			require.Contains(t, logger.ErrorLogs.Ctx, "dashboard.grafana.app/dashboards:get")
			require.Equal(t, 1, logger.DebugLogs.Calls, "rejected searches still report their stats")
			require.Len(t, recorder.Ended(), 1)
			require.Equal(t, otelcodes.Error, recorder.Ended()[0].Status().Code)
		})
	}
}

func TestSearchServicePermissionsDoesNotDependOnClient(t *testing.T) {
	for name, client := range map[string]authlib.AccessClient{
		"limited client":   newLimitedClient(t),
		"fixed client":     authlib.FixedAccessClient(true),
		"decorated client": struct{ authlib.AccessClient }{newLimitedClient(t)},
		"no client":        nil,
	} {
		t.Run(name, func(t *testing.T) {
			s := newPermissionTestSearchServer(client)
			req := &resourcepb.ResourceSearchRequest{Options: &resourcepb.ListOptions{Key: &resourcepb.ResourceKey{
				Namespace: "stacks-1", Group: "dashboard.grafana.app", Resource: "dashboards",
			}}}
			for mode, id := range map[string]authlib.AuthInfo{
				"direct":    serviceWithPermissions("folder.grafana.app:get"),
				"delegated": tokenWithoutDelegation(),
			} {
				t.Run(mode, func(t *testing.T) {
					resp, err := s.Search(authlib.WithAuthInfo(t.Context(), id), req)
					require.NoError(t, err)
					require.Equal(t, int32(http.StatusInternalServerError), resp.Error.GetCode())
					require.Contains(t, resp.Error.GetMessage(), "dashboard.grafana.app/dashboards:get")
				})
			}
			// Local callers without tokens still use their access client's rules.
			require.NoError(t, s.checkSearchServicePermissions(authlib.WithAuthInfo(t.Context(), userWithDelegatedPermissions()), req))
		})
	}
}
