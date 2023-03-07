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
	"github.com/grafana/grafana/pkg/plugins/log"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/adapters"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginsettings"
	"github.com/grafana/grafana/pkg/services/user"
)

func ProvideService(cacheService *localcache.CacheService, pluginStore plugins.Store,
	dataSourceCache datasources.CacheService, dataSourceService datasources.DataSourceService,
	pluginSettingsService pluginsettings.Service) *Provider {
	return &Provider{
		cacheService:          cacheService,
		pluginStore:           pluginStore,
		dataSourceCache:       dataSourceCache,
		dataSourceService:     dataSourceService,
		pluginSettingsService: pluginSettingsService,
		logger:                log.New("plugincontext"),
	}
}

type Provider struct {
	cacheService          *localcache.CacheService
	pluginStore           plugins.Store
	dataSourceCache       datasources.CacheService
	dataSourceService     datasources.DataSourceService
	pluginSettingsService pluginsettings.Service
	logger                log.Logger
}

// Get allows getting plugin context by its ID. If datasourceUID is not empty string
// then PluginContext.DataSourceInstanceSettings will be resolved and appended to
// returned context.
func (p *Provider) Get(ctx context.Context, pluginID string, user *user.SignedInUser) (backend.PluginContext, bool, error) {
	return p.pluginContext(ctx, pluginID, user)
}

// GetWithDataSource allows getting plugin context by its ID and PluginContext.DataSourceInstanceSettings will be
// resolved and appended to the returned context.
func (p *Provider) GetWithDataSource(ctx context.Context, pluginID string, user *user.SignedInUser, ds *datasources.DataSource) (backend.PluginContext, bool, error) {
	pCtx, exists, err := p.pluginContext(ctx, pluginID, user)
	if err != nil {
		return pCtx, exists, err
	}

	datasourceSettings, err := adapters.ModelToInstanceSettings(ds, p.decryptSecureJsonDataFn(ctx))
	if err != nil {
		return pCtx, exists, fmt.Errorf("%v: %w", "Failed to convert datasource", err)
	}
	pCtx.DataSourceInstanceSettings = datasourceSettings

	return pCtx, true, nil
}

const pluginSettingsCacheTTL = 5 * time.Second
const pluginSettingsCachePrefix = "plugin-setting-"

func (p *Provider) pluginContext(ctx context.Context, pluginID string, user *user.SignedInUser) (backend.PluginContext, bool, error) {
	plugin, exists := p.pluginStore.Plugin(ctx, pluginID)
	if !exists {
		return backend.PluginContext{}, false, nil
	}

	jsonData := json.RawMessage{}
	decryptedSecureJSONData := map[string]string{}
	var updated time.Time

	ps, err := p.getCachedPluginSettings(ctx, pluginID, user)
	if err != nil {
		// pluginsettings.ErrPluginSettingNotFound is expected if there's no row found for plugin setting in database (if non-app plugin).
		// If it's not this expected error something is wrong with cache or database and we return the error to the client.
		if !errors.Is(err, pluginsettings.ErrPluginSettingNotFound) {
			return backend.PluginContext{}, false, fmt.Errorf("%v: %w", "Failed to get plugin settings", err)
		}
	} else {
		jsonData, err = json.Marshal(ps.JSONData)
		if err != nil {
			return backend.PluginContext{}, false, fmt.Errorf("%v: %w", "Failed to unmarshal plugin json data", err)
		}
		decryptedSecureJSONData = p.pluginSettingsService.DecryptedValues(ps)
		updated = ps.Updated
	}

	return backend.PluginContext{
		OrgID:    user.OrgID,
		PluginID: plugin.ID,
		User:     adapters.BackendUserFromSignedInUser(user),
		AppInstanceSettings: &backend.AppInstanceSettings{
			JSONData:                jsonData,
			DecryptedSecureJSONData: decryptedSecureJSONData,
			Updated:                 updated,
		},
	}, true, nil
}

func (p *Provider) getCachedPluginSettings(ctx context.Context, pluginID string, user *user.SignedInUser) (*pluginsettings.DTO, error) {
	cacheKey := getCacheKey(pluginID)

	if cached, found := p.cacheService.Get(cacheKey); found {
		ps := cached.(*pluginsettings.DTO)
		if ps.OrgID == user.OrgID {
			return ps, nil
		}
	}

	ps, err := p.pluginSettingsService.GetPluginSettingByPluginID(ctx, &pluginsettings.GetByPluginIDArgs{
		PluginID: pluginID,
		OrgID:    user.OrgID,
	})
	if err != nil {
		return nil, err
	}

	p.cacheService.Set(cacheKey, ps, pluginSettingsCacheTTL)
	return ps, nil
}

func (p *Provider) InvalidateSettingsCache(_ context.Context, pluginID string) {
	p.cacheService.Delete(getCacheKey(pluginID))
}

func (p *Provider) decryptSecureJsonDataFn(ctx context.Context) func(ds *datasources.DataSource) (map[string]string, error) {
	return func(ds *datasources.DataSource) (map[string]string, error) {
		return p.dataSourceService.DecryptedValues(ctx, ds)
	}
}

func getCacheKey(pluginID string) string {
	return pluginSettingsCachePrefix + pluginID
}
