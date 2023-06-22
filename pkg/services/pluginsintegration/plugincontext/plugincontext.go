package plugincontext

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"

	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/adapters"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginsettings"
	"github.com/grafana/grafana/pkg/services/user"
)

var ErrPluginNotFound = errors.New("plugin not found")

func ProvideService(cacheService *localcache.CacheService, pluginStore plugins.Store,
	dataSourceService datasources.DataSourceService, pluginSettingsService pluginsettings.Service) *Provider {
	return &Provider{
		cacheService:          cacheService,
		pluginStore:           pluginStore,
		dataSourceService:     dataSourceService,
		pluginSettingsService: pluginSettingsService,
	}
}

type Provider struct {
	cacheService          *localcache.CacheService
	pluginStore           plugins.Store
	dataSourceService     datasources.DataSourceService
	pluginSettingsService pluginsettings.Service
}

// Get allows getting plugin context by its ID. If datasourceUID is not empty string
// then PluginContext.DataSourceInstanceSettings will be resolved and appended to
// returned context.
// Note: *user.SignedInUser can be nil.
func (p *Provider) Get(ctx context.Context, pluginID string, user *user.SignedInUser, orgID int64) (backend.PluginContext, error) {
	plugin, exists := p.pluginStore.Plugin(ctx, pluginID)
	if !exists {
		return backend.PluginContext{}, ErrPluginNotFound
	}

	pCtx := backend.PluginContext{
		PluginID: pluginID,
	}
	if user != nil {
		pCtx.OrgID = user.OrgID
		pCtx.User = adapters.BackendUserFromSignedInUser(user)
	}

	if plugin.IsApp() {
		appSettings, err := p.appInstanceSettings(ctx, pluginID, orgID)
		if err != nil {
			return backend.PluginContext{}, err
		}
		pCtx.AppInstanceSettings = appSettings
	}

	return pCtx, nil
}

// GetWithDataSource allows getting plugin context by its ID and PluginContext.DataSourceInstanceSettings will be
// resolved and appended to the returned context.
// Note: *user.SignedInUser can be nil.
func (p *Provider) GetWithDataSource(ctx context.Context, pluginID string, user *user.SignedInUser, ds *datasources.DataSource) (backend.PluginContext, error) {
	_, exists := p.pluginStore.Plugin(ctx, pluginID)
	if !exists {
		return backend.PluginContext{}, ErrPluginNotFound
	}

	pCtx := backend.PluginContext{
		PluginID: pluginID,
	}
	if user != nil {
		pCtx.OrgID = user.OrgID
		pCtx.User = adapters.BackendUserFromSignedInUser(user)
	}

	datasourceSettings, err := adapters.ModelToInstanceSettings(ds, p.decryptSecureJsonDataFn(ctx))
	if err != nil {
		return pCtx, err
	}
	pCtx.DataSourceInstanceSettings = datasourceSettings

	return pCtx, nil
}

const pluginSettingsCacheTTL = 5 * time.Second
const pluginSettingsCachePrefix = "plugin-setting-"

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
