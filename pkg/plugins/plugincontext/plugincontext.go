package plugincontext

import (
	"encoding/json"
	"errors"
	"time"

	"github.com/grafana/grafana/pkg/bus"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins/adapters"
	"github.com/grafana/grafana/pkg/plugins/manager"
	"github.com/grafana/grafana/pkg/util/errutil"
)

type cacheService interface {
	Get(k string) (interface{}, bool)
	Set(k string, x interface{}, d time.Duration)
}

type busDispatcher interface {
	Dispatch(msg bus.Msg) error
}

type datasourceGetter interface {
	GetDatasource(datasourceID int64, user *models.SignedInUser, skipCache bool) (*models.DataSource, error)
}

func Get(pluginID string, datasourceID int64, user *models.SignedInUser, cacheService cacheService, busDispatcher busDispatcher, datasourceGetter datasourceGetter) (backend.PluginContext, bool, error) {
	pc := backend.PluginContext{}
	plugin, exists := manager.Plugins[pluginID]
	if !exists {
		return pc, false, nil
	}

	jsonData := json.RawMessage{}
	decryptedSecureJSONData := map[string]string{}
	var updated time.Time

	ps, err := getCachedPluginSettings(pluginID, user, cacheService, busDispatcher)
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

	if datasourceID > 0 {
		ds, err := datasourceGetter.GetDatasource(datasourceID, user, false)
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

func getCachedPluginSettings(pluginID string, user *models.SignedInUser, cacheService cacheService, busDispatcher busDispatcher) (*models.PluginSetting, error) {
	cacheKey := pluginSettingsCachePrefix + pluginID

	if cached, found := cacheService.Get(cacheKey); found {
		ps := cached.(*models.PluginSetting)
		if ps.OrgId == user.OrgId {
			return ps, nil
		}
	}

	query := models.GetPluginSettingByIdQuery{PluginId: pluginID, OrgId: user.OrgId}
	if err := busDispatcher.Dispatch(&query); err != nil {
		return nil, err
	}

	cacheService.Set(cacheKey, query.Result, pluginSettingsCacheTTL)
	return query.Result, nil
}
