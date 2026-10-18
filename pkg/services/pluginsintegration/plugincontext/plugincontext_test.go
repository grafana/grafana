package plugincontext_test

import (
	"context"
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/db/dbtest"
	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/manager/pluginfakes"
	"github.com/grafana/grafana/pkg/plugins/manager/registry"
	"github.com/grafana/grafana/pkg/services/datasources"
	fakeDatasources "github.com/grafana/grafana/pkg/services/datasources/fakes"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginconfig"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/plugincontext"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginsettings"
	pluginSettings "github.com/grafana/grafana/pkg/services/pluginsintegration/pluginsettings/service"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
	secretstest "github.com/grafana/grafana/pkg/services/secrets/fakes"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

func TestGet(t *testing.T) {
	const (
		pluginID = "plugin-id"
		alias    = "alias"
	)

	preg := registry.NewInMemory()
	require.NoError(t, preg.Add(context.Background(), &plugins.Plugin{
		JSONData: plugins.JSONData{
			ID:       pluginID,
			AliasIDs: []string{alias},
		},
	}))

	cfg := setting.NewCfg()
	cfg.DataProxyTimeout = 175
	cfg.DataProxyDialTimeout = 12
	cfg.DataProxyKeepAlive = 45
	cfg.DataProxyTLSHandshakeTimeout = 15
	cfg.DataProxyExpectContinueTimeout = 2
	cfg.DataProxyMaxConnsPerHost = 50
	cfg.DataProxyMaxIdleConns = 200
	cfg.DataProxyIdleConnTimeout = 120
	expectedTimeouts := httpclient.TimeoutOptions{
		Timeout:               175 * time.Second,
		DialTimeout:           12 * time.Second,
		KeepAlive:             45 * time.Second,
		TLSHandshakeTimeout:   15 * time.Second,
		ExpectContinueTimeout: 2 * time.Second,
		MaxConnsPerHost:       50,
		MaxIdleConns:          200,
		MaxIdleConnsPerHost:   200,
		IdleConnTimeout:       120 * time.Second,
	}
	ds := &fakeDatasources.FakeDataSourceService{}
	db := &dbtest.FakeDB{ExpectedError: pluginsettings.ErrPluginSettingNotFound}
	store, err := pluginstore.NewPluginStoreForTest(preg, &pluginfakes.FakeLoader{}, &pluginfakes.FakeSourceRegistry{})
	require.NoError(t, err)
	pcp := plugincontext.ProvideService(cfg, localcache.ProvideService(),
		store, &fakeDatasources.FakeCacheService{},
		ds, pluginSettings.ProvideService(db, secretstest.NewFakeSecretsService()), pluginconfig.NewFakePluginRequestConfigProvider(),
	)
	requester := &user.SignedInUser{OrgID: int64(1), Login: "admin"}
	ctx := identity.WithRequester(context.Background(), requester)

	for _, tc := range []struct {
		name  string
		input string
	}{
		{"with id", pluginID},
		{"with alias", alias},
	} {
		t.Run(tc.name, func(t *testing.T) {
			t.Run("Get", func(t *testing.T) {
				pCtx, err := pcp.Get(ctx, tc.input, requester, requester.OrgID)
				require.NoError(t, err)
				require.Equal(t, pluginID, pCtx.PluginID)
				require.NotNil(t, pCtx.GrafanaConfig)
			})

			t.Run("GetWithDataSource", func(t *testing.T) {
				datasource := &datasources.DataSource{
					ID:       1,
					OrgID:    1,
					Name:     "test",
					Type:     pluginID,
					JsonData: simplejson.New(),
				}
				pCtx, err := pcp.GetWithDataSource(ctx, tc.input, requester, datasource)
				require.NoError(t, err)
				require.Equal(t, pluginID, pCtx.PluginID)
				require.NotNil(t, pCtx.GrafanaConfig)
				opts, err := pCtx.DataSourceInstanceSettings.HTTPClientOptions(ctx)
				require.NoError(t, err)
				require.Equal(t, expectedTimeouts, *opts.Timeouts)
				require.Empty(t, datasource.JsonData.MustMap())
			})

			t.Run("PluginContextForDataSource", func(t *testing.T) {
				settings := &backend.DataSourceInstanceSettings{
					Type:     tc.input,
					JSONData: []byte(`{"timeout":60,"httpKeepAlive":0,"custom":9007199254740993}`),
				}
				original := string(settings.JSONData)
				pCtx, err := pcp.PluginContextForDataSource(ctx, settings)
				require.NoError(t, err)
				opts, err := pCtx.DataSourceInstanceSettings.HTTPClientOptions(ctx)
				require.NoError(t, err)
				expected := expectedTimeouts
				expected.Timeout = 60 * time.Second
				expected.KeepAlive = 0
				require.Equal(t, expected, *opts.Timeouts)
				require.Equal(t, original, string(settings.JSONData))
				require.Contains(t, string(pCtx.DataSourceInstanceSettings.JSONData), `"custom":9007199254740993`)
			})
		})
	}
}
