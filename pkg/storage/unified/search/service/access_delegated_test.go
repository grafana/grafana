package service

import (
	resourcecontract "github.com/grafana/grafana/pkg/storage/unified/resource/contract"

	searchmetrics "github.com/grafana/grafana/pkg/storage/unified/search/metrics"

	"context"
	"net/http"
	"testing"

	resource "github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/testutil"
	"github.com/stretchr/testify/require"

	otelcodes "go.opentelemetry.io/otel/codes"

	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	"go.opentelemetry.io/otel/sdk/trace/tracetest"

	authnlib "github.com/grafana/authlib/authn"

	authlib "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
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
				req.Options.Key.Group = resourcecontract.GlobalSearchGroup
				req.Options.Key.Resource = resourcecontract.GlobalSearchResource
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

func newPermissionTestSearchServer(client authlib.AccessClient) *searchServer {
	return &searchServer{access: client, indexMetrics: searchmetrics.ProvideIndexMetrics(nil).ServiceMetrics, log: log.NewNopLogger()}
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

func newLimitedClient(t *testing.T) authlib.AccessClient {
	t.Helper()
	return resource.NewAuthzLimitedClient(authlib.FixedAccessClient(true), resource.AuthzOptions{Registry: prometheus.NewRegistry()})
}
