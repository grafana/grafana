package live

import (
	"context"
	"testing"

	claims "github.com/grafana/authlib/types"
	"github.com/grafana/grafana-plugin-sdk-go/live"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/apps/live/pkg/liveserver"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/usagestats"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tests/testsuite"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func TestIntegration_provideLiveService_RedisUnavailable(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	cfg := setting.NewCfg()

	cfg.LiveHAEngine = "testredisunavailable"

	_, err := setupLiveService(cfg, t)

	// Proceeds without live HA if redis is unavailable
	require.NoError(t, err)
}

func Test_getHistogramMetric(t *testing.T) {
	type args struct {
		val          int
		bounds       []int
		metricPrefix string
	}

	tests := []struct {
		name string
		args args
		want string
	}{
		{
			"zero",
			args{0, []int{0, 10, 100, 1000, 10000, 100000}, "live_users_"},
			"live_users_le_0",
		},
		{
			"equal_to_bound",
			args{10, []int{0, 10, 100, 1000, 10000, 100000}, "live_users_"},
			"live_users_le_10",
		},
		{
			"in_the_middle",
			args{30000, []int{0, 10, 100, 1000, 10000, 100000}, "live_users_"},
			"live_users_le_100000",
		},
		{
			"more_than_upper_bound",
			args{300000, []int{0, 10, 100, 1000, 10000, 100000}, "live_users_"},
			"live_users_le_inf",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := getHistogramMetric(tt.args.val, tt.args.bounds, tt.args.metricPrefix); got != tt.want {
				t.Errorf("getHistogramMetric() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestProvideService_RegistersScopes(t *testing.T) {
	g, err := setupLiveService(nil, t)
	require.NoError(t, err)

	user := &identity.StaticRequester{Type: claims.TypeUser, UserUID: "u1", OrgID: 1, Namespace: "default"}
	// The plugin and datasource scopes need the plugin store, which this setup
	// leaves nil, so only the scopes that run without it are resolved here.
	for _, scope := range []string{live.ScopeGrafana, live.ScopeWatch, live.ScopeStream} {
		_, err := g.dispatcher.GetChannelHandlerFactory(context.Background(), user, scope, "x")
		require.NotErrorIs(t, err, liveserver.ErrScopeNotAvailable, "scope %s", scope)
	}

	factory, err := g.dispatcher.GetChannelHandlerFactory(context.Background(), user, live.ScopeGrafana, "dashboard")
	require.NoError(t, err)
	require.Same(t, g.GrafanaScope.Dashboards, factory)
}

func setupLiveService(cfg *setting.Cfg, t *testing.T) (*GrafanaLive, error) {
	if cfg == nil {
		cfg = setting.NewCfg()
	}

	return ProvideService(cfg,
		routing.NewRouteRegister(),
		nil, nil, nil,
		nil,
		&usagestats.UsageStatsMock{T: t},
		featuremgmt.WithFeatures(),
		&dashboards.FakeDashboardService{},
		nil)
}
