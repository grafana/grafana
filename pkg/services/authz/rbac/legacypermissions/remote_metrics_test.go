package legacypermissions_test

import (
	"context"
	"errors"
	"testing"

	authn "github.com/grafana/authlib/authn"
	"github.com/grafana/authlib/types"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/accesscontrol/resourcepermissions"
	authzv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
	"github.com/grafana/grafana/pkg/services/authz/rbac/legacypermissions"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/util/testutil"
)

type remoteMetricsStream struct {
	grpc.ServerStream
	ctx  context.Context
	send func() error
}

func (s remoteMetricsStream) Context() context.Context                             { return s.ctx }
func (s remoteMetricsStream) Send(*authzv1.LegacyGetUserPermissionsResponse) error { return s.send() }

func remoteMetricCounts(t *testing.T, reg *prometheus.Registry) map[string]uint64 {
	t.Helper()
	families, err := reg.Gather()
	require.NoError(t, err)
	counts := map[string]uint64{}
	for _, family := range families {
		if family.GetName() != "grafana_authz_legacy_get_user_permissions_duration_seconds" {
			continue
		}
		for _, metric := range family.Metric {
			labels := map[string]string{}
			for _, label := range metric.Label {
				labels[label.GetName()] = label.GetValue()
			}
			require.Equal(t, "remote", labels["implementation"])
			require.Len(t, labels, 2)
			counts[labels["status"]] = metric.GetHistogram().GetSampleCount()
		}
	}
	require.Len(t, counts, 2)
	return counts
}

func TestIntegrationRemoteMetrics(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	sql := db.NewTestStore(t)
	seedRemoteIdentity(t, sql)
	for _, scenario := range []string{"success", "authorization", "validation", "load", "stream", "canceled"} {
		t.Run(scenario, func(t *testing.T) {
			reg := prometheus.NewRegistry()
			ctx, cancel := context.WithCancel(context.Background())
			defer cancel()
			ctx = types.WithAuthInfo(ctx, authn.NewAccessTokenAuthInfo(authn.Claims[authn.AccessTokenClaims]{Rest: authn.AccessTokenClaims{Namespace: "stacks-1", Permissions: []string{"authz.grafana.app/userpermissions:get"}}}))
			injected := errors.New("injected failure")
			loader := legacypermissions.NewEnforcedLoader(func(ctx context.Context) (*legacysql.LegacyDatabaseHelper, error) {
				if scenario == "load" {
					return nil, injected
				}
				return legacysql.NewDatabaseProvider(sql)(ctx)
			}, resourcepermissions.NewActionSetService(), localcache.New(0, 0), loaderConfig(false), featuremgmt.WithFeatures(), nil, nil)
			server := legacypermissions.NewRemoteServer(loader, reg, tracing.InitializeTracerForTest())
			require.Equal(t, map[string]uint64{"ok": 0, "error": 0}, remoteMetricCounts(t, reg))
			id := int64(7)
			req := &authzv1.LegacyGetUserPermissionsRequest{Namespace: "stacks-1", Identity: &authzv1.LegacyPermissionIdentity{Type: "user", Uid: "user-7", InternalId: &id, HasUniqueId: true, OrgRole: "None"}}
			if scenario == "authorization" {
				ctx = context.Background()
			}
			if scenario == "validation" {
				req.Identity = nil
			}
			if scenario == "canceled" {
				cancel()
			}
			sends := 0
			err := server.LegacyGetUserPermissions(req, remoteMetricsStream{ctx: ctx, send: func() error {
				sends++
				// Observe only after the complete response, not after loading permissions.
				require.Equal(t, map[string]uint64{"ok": 0, "error": 0}, remoteMetricCounts(t, reg))
				if scenario == "stream" {
					return injected
				}
				return nil
			}})
			if scenario == "success" {
				require.NoError(t, err)
				require.Positive(t, sends)
				require.Equal(t, map[string]uint64{"ok": 1, "error": 0}, remoteMetricCounts(t, reg))
			} else {
				require.Error(t, err)
				if scenario == "load" || scenario == "stream" {
					require.ErrorIs(t, err, injected)
				}
				require.Equal(t, map[string]uint64{"ok": 0, "error": 1}, remoteMetricCounts(t, reg))
			}
		})
	}
}
