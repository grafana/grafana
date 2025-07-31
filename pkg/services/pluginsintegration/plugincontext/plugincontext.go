package plugincontext

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/adapters"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginconfig"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginsettings"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
	"github.com/grafana/grafana/pkg/setting"
)

const (
	pluginSettingsCacheTTL    = 5 * time.Second
	pluginSettingsCachePrefix = "plugin-setting-"
)

func ProvideService(settingsProvider setting.SettingsProvider, cacheService *localcache.CacheService, pluginStore pluginstore.Store,
	dataSourceCache datasources.CacheService, dataSourceService datasources.DataSourceService,
	pluginSettingsService pluginsettings.Service, pluginRequestConfigProvider pluginconfig.PluginRequestConfigProvider,
) *Provider {
	return &Provider{
		BaseProvider:          newBaseProvider(settingsProvider, pluginRequestConfigProvider),
		cacheService:          cacheService,
		pluginStore:           pluginStore,
		dataSourceCache:       dataSourceCache,
		dataSourceService:     dataSourceService,
		pluginSettingsService: pluginSettingsService,
		logger:                log.New("plugin.context"),
	}
}

type Provider struct {
	*BaseProvider
	cacheService          *localcache.CacheService
	pluginStore           pluginstore.Store
	dataSourceCache       datasources.CacheService
	dataSourceService     datasources.DataSourceService
	pluginSettingsService pluginsettings.Service
	logger                log.Logger
}

// Get will retrieve plugin context by the provided pluginID and orgID.
// This is intended to be used for app plugin requests.
// PluginContext.AppInstanceSettings will be resolved and appended to the returned context.
// Note: identity.Requester can be nil.
func (p *Provider) Get(ctx context.Context, pluginID string, user identity.Requester, orgID int64) (backend.PluginContext, error) {
	plugin, exists := p.pluginStore.Plugin(ctx, pluginID)
	if !exists {
		return backend.PluginContext{}, plugins.ErrPluginNotRegistered
	}

	pCtx := p.GetBasePluginContext(ctx, plugin, user)
	if plugin.IsApp() {
		appSettings, err := p.appInstanceSettings(ctx, pluginID, orgID)
		if err != nil {
			return backend.PluginContext{}, err
		}
		pCtx.AppInstanceSettings = appSettings
	}

	return pCtx, nil
}

// GetWithDataSource will retrieve plugin context by the provided pluginID and datasource.
// This is intended to be used for datasource plugin requests.
// PluginContext.DataSourceInstanceSettings will be resolved and appended to the returned context.
// Note: identity.Requester can be nil.
func (p *Provider) GetWithDataSource(ctx context.Context, pluginID string, user identity.Requester, ds *datasources.DataSource) (backend.PluginContext, error) {
	plugin, exists := p.pluginStore.Plugin(ctx, pluginID)
	if !exists {
		return backend.PluginContext{}, plugins.ErrPluginNotRegistered
	}

	pCtx := p.GetBasePluginContext(ctx, plugin, user)

	datasourceSettings, err := adapters.ModelToInstanceSettings(ds, p.decryptSecureJsonDataFn(ctx))
	if err != nil {
		return pCtx, err
	}
	pCtx.DataSourceInstanceSettings = datasourceSettings

	return pCtx, nil
}

func (p *Provider) GetDataSourceInstanceSettings(ctx context.Context, uid string) (*backend.DataSourceInstanceSettings, error) {
	user, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, err
	}
	ds, err := p.dataSourceCache.GetDatasourceByUID(ctx, uid, user, false)
	if err != nil {
		return nil, err
	}
	return adapters.ModelToInstanceSettings(ds, p.decryptSecureJsonDataFn(ctx))
}

// PluginContextForDataSource will retrieve plugin context by the provided pluginID and datasource UID / K8s name.
// This is intended to be used for datasource API server plugin requests.
func (p *Provider) PluginContextForDataSource(ctx context.Context, datasourceSettings *backend.DataSourceInstanceSettings) (backend.PluginContext, error) {
	pluginID := datasourceSettings.Type
	plugin, exists := p.pluginStore.Plugin(ctx, pluginID)
	if !exists {
		return backend.PluginContext{}, plugins.ErrPluginNotRegistered
	}

	user, err := identity.GetRequester(ctx)
	if err != nil {
		return backend.PluginContext{}, err
	}
	pCtx := p.GetBasePluginContext(ctx, plugin, user)
	pCtx.DataSourceInstanceSettings = datasourceSettings

	return pCtx, nil
}

func (p *Provider) appInstanceSettings(ctx context.Context, pluginID string, orgID int64) (*backend.AppInstanceSettings, error) {
	jsonData := json.RawMessage{}
	decryptedSecureJSONData := map[string]string{}
	var updated time.Time

	ps, err := p.getCachedPluginSettings(ctx, pluginID, orgID)
	if err != nil {
		// pluginsettings.ErrPluginSettingNotFound is expected if there's no row found for plugin setting in database (if non-app plugin).
		// Otherwise, something is wrong with cache or database, and we return the error to the client.
		if !errors.Is(err, pluginsettings.ErrPluginSettingNotFound) {
			return nil, fmt.Errorf("%v: %w", "Failed to get plugin settings", err)
		}
	} else {
		jsonData, err = json.Marshal(ps.JSONData)
		if err != nil {
			return nil, fmt.Errorf("%v: %w", "Failed to unmarshal plugin json data", err)
		}
		decryptedSecureJSONData = p.pluginSettingsService.DecryptedValues(ps)
		updated = ps.Updated
	}

	return &backend.AppInstanceSettings{
		JSONData:                jsonData,
		DecryptedSecureJSONData: decryptedSecureJSONData,
		Updated:                 updated,
	}, nil
}

func (p *Provider) InvalidateSettingsCache(_ context.Context, pluginID string) {
	p.cacheService.Delete(getCacheKey(pluginID))
}

func (p *Provider) getCachedPluginSettings(ctx context.Context, pluginID string, orgID int64) (*pluginsettings.DTO, error) {
	cacheKey := getCacheKey(pluginID)

	if cached, found := p.cacheService.Get(cacheKey); found {
		ps := cached.(*pluginsettings.DTO)
		if ps.OrgID == orgID {
			return ps, nil
		}
	}

	ps, err := p.pluginSettingsService.GetPluginSettingByPluginID(ctx, &pluginsettings.GetByPluginIDArgs{
		PluginID: pluginID,
		OrgID:    orgID,
	})
	if err != nil {
		return nil, err
	}

	p.cacheService.Set(cacheKey, ps, pluginSettingsCacheTTL)
	return ps, nil
}

func (p *Provider) decryptSecureJsonDataFn(ctx context.Context) func(ds *datasources.DataSource) (map[string]string, error) {
	return func(ds *datasources.DataSource) (map[string]string, error) {
		return p.dataSourceService.DecryptedValues(ctx, ds)
	}
}

func getCacheKey(pluginID string) string {
	return pluginSettingsCachePrefix + pluginID
}
