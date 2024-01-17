package plugincontext

import (
	"context"
	"runtime"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/useragent"

	"github.com/grafana/grafana/pkg/infra/appcontext"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/config"
	"github.com/grafana/grafana/pkg/plugins/envvars"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/adapters"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
	"github.com/grafana/grafana/pkg/setting"
)

type DataSourcePluginContextProvider interface {
	Get(ctx context.Context, pluginID, name string) (backend.PluginContext, error)
}

func ProvideDataSourceProvider(cfg *setting.Cfg, dataSourceCache datasources.CacheService, pluginStore pluginstore.Store,
	dataSourceService datasources.DataSourceService, licensing plugins.Licensing, pCfg *config.Cfg) *DataSourceProvider {
	return &DataSourceProvider{
		cfg:               cfg,
		pluginStore:       pluginStore,
		dataSourceService: dataSourceService,
		dataSourceCache:   dataSourceCache,
		pluginEnvVars:     envvars.NewProvider(pCfg, licensing),
		logger:            log.New("plugin.context"),
	}
}

type DataSourceProvider struct {
	cfg               *setting.Cfg
	pluginEnvVars     *envvars.Service
	pluginStore       pluginstore.Store
	dataSourceCache   datasources.CacheService
	dataSourceService datasources.DataSourceService
	logger            log.Logger
}

func (p *DataSourceProvider) Get(ctx context.Context, pluginID, name string) (backend.PluginContext, error) {
	plugin, exists := p.pluginStore.Plugin(ctx, pluginID)
	if !exists {
		return backend.PluginContext{}, plugins.ErrPluginNotRegistered
	}

	user, err := appcontext.User(ctx)
	if err != nil {
		return backend.PluginContext{}, err
	}
	ds, err := p.dataSourceCache.GetDatasourceByUID(ctx, name, user, false)
	if err != nil {
		return backend.PluginContext{}, err
	}

	pCtx := backend.PluginContext{
		PluginID:      plugin.ID,
		PluginVersion: plugin.Info.Version,
	}
	if user != nil && !user.IsNil() {
		pCtx.OrgID = user.GetOrgID()
		pCtx.User = adapters.BackendUserFromSignedInUser(user)
	}

	datasourceSettings, err := adapters.ModelToInstanceSettings(ds, p.decryptSecureJsonDataFn(ctx))
	if err != nil {
		return pCtx, err
	}
	pCtx.DataSourceInstanceSettings = datasourceSettings

	settings := p.pluginEnvVars.GetConfigMap(ctx, pluginID, plugin.ExternalService)
	pCtx.GrafanaConfig = backend.NewGrafanaCfg(settings)

	ua, err := useragent.New(p.cfg.BuildVersion, runtime.GOOS, runtime.GOARCH)
	if err != nil {
		p.logger.Warn("Could not create user agent", "error", err)
	}
	pCtx.UserAgent = ua

	return pCtx, nil
}

func (p *DataSourceProvider) decryptSecureJsonDataFn(ctx context.Context) func(ds *datasources.DataSource) (map[string]string, error) {
	return func(ds *datasources.DataSource) (map[string]string, error) {
		return p.dataSourceService.DecryptedValues(ctx, ds)
	}
}
