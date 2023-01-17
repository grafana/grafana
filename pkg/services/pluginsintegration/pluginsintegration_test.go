package pluginsintegration

import (
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/plugins/config"
	"github.com/grafana/grafana/pkg/plugins/manager/fakes"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
)

func TestCreateMiddlewares(t *testing.T) {
	type args struct {
		cfg  *setting.Cfg
		pCfg *config.Cfg
	}

	cfg := setting.NewCfg()
	cfg.IsFeatureToggleEnabled = func(key string) bool {
		return featuremgmt.FlagDatasourceLogger == key
	}
	cfg.SendUserHeader = true
	pCfg := config.NewCfg(setting.ProvideProvider(cfg), cfg)

	tcs := []struct {
		name     string
		args     args
		expected []string
	}{
		{
			name: "Test that client middlewares are defined in a specific order",
			args: args{
				cfg:  cfg,
				pCfg: pCfg,
			},
			expected: []string{
				"*clientmiddleware.InstrumentationMiddleware",
				"*clientmiddleware.TracingHeaderMiddleware",
				"*clientmiddleware.ClearAuthHeadersMiddleware",
				"*clientmiddleware.OAuthTokenMiddleware",
				"*clientmiddleware.CookiesMiddleware",
				"*clientmiddleware.UserHeaderMiddleware",
				"*clientmiddleware.HTTPClientMiddleware",
			},
		},
	}
	for _, tc := range tcs {
		t.Run(tc.name, func(t *testing.T) {
			got := CreateMiddlewares(tc.args.cfg, tc.args.pCfg, nil, nil)
			require.Len(t, got, 7)
			for i, m := range got {
				c := m.CreateClientMiddleware(&fakes.FakePluginClient{})
				require.Equal(t, tc.expected[i], fmt.Sprintf("%T", c))
			}
		})
	}
}
