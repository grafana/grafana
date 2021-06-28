package plugincontext

import (
	"encoding/json"
	"errors"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/adapters"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/util/errutil"
)

func init() {
	registry.Register(&registry.Descriptor{
		Name:     "PluginContextProvider",
		Instance: newProvider(),
	})
}

func newProvider() *Provider {
	return &Provider{}
}

type Provider struct {
	Bus             bus.Bus                  `inject:""`
	CacheService    *localcache.CacheService `inject:""`
	PluginManager   plugins.Manager          `inject:""`
	DatasourceCache datasources.CacheService `inject:""`
}

func (p *Provider) Init() error {
	return nil
}

// Get allows getting plugin context by its id. If datasourceUID is not empty string
// then PluginContext.DataSourceInstanceSettings will be resolved and appended to
// returned context.
func (p *Provider) Get(pluginID string, datasourceUID string, user *models.SignedInUser, skipCache bool) (backend.PluginContext, bool, error) {
	pc := backend.PluginContext{}
	plugin := p.PluginManager.GetPlugin(pluginID)
	if plugin == nil {
		return pc, false, nil
	}

	jsonData := json.RawMessage{}
	decryptedSecureJSONData := map[string]string{}
	var updated time.Time

	ps, err := p.getCachedPluginSettings(pluginID, user)
	if err != nil {
		// models.ErrPluginSettingNotFound is expected if there's no row found for plugin setting in database (if non-app plugin).
		// If it's not this expected error something is wrong with cache or database and we return the error to the client.
		if !errors.Is(err, models.ErrPluginSettingNotFound) {
			return pc, false, errutil.Wrap("Failed to get plugin settings", err)
		}
	} else {
		jsonData, err = json.Marshal(ps.JsonData)
		if err != nil {
			return pc, false, errutil.Wrap("Failed to unmarshal plugin json data", err)
		}
		decryptedSecureJSONData = ps.DecryptedValues()
		updated = ps.Updated
	}

	pCtx := backend.PluginContext{
		OrgID:    user.OrgId,
		PluginID: plugin.Id,
		User:     adapters.BackendUserFromSignedInUser(user),
		AppInstanceSettings: &backend.AppInstanceSettings{
			JSONData:                jsonData,
			DecryptedSecureJSONData: decryptedSecureJSONData,
			Updated:                 updated,
		},
	}

	if datasourceUID != "" {
		ds, err := p.DatasourceCache.GetDatasourceByUID(datasourceUID, user, skipCache)
		if err != nil {
			return pc, false, errutil.Wrap("Failed to get datasource", err)
		}
		datasourceSettings, err := adapters.ModelToInstanceSettings(ds)
		if err != nil {
			return pc, false, errutil.Wrap("Failed to convert datasource", err)
		}
		pCtx.DataSourceInstanceSettings = datasourceSettings
	}

	return pCtx, true, nil
}

const pluginSettingsCacheTTL = 5 * time.Second
const pluginSettingsCachePrefix = "plugin-setting-"

func (p *Provider) getCachedPluginSettings(pluginID string, user *models.SignedInUser) (*models.PluginSetting, error) {
	cacheKey := pluginSettingsCachePrefix + pluginID

	if cached, found := p.CacheService.Get(cacheKey); found {
		ps := cached.(*models.PluginSetting)
		if ps.OrgId == user.OrgId {
			return ps, nil
		}
	}

	query := models.GetPluginSettingByIdQuery{PluginId: pluginID, OrgId: user.OrgId}
	if err := p.Bus.Dispatch(&query); err != nil {
		return nil, err
	}

	p.CacheService.Set(cacheKey, query.Result, pluginSettingsCacheTTL)
	return query.Result, nil
}
