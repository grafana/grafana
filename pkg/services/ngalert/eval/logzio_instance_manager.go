// LOGZ.IO GRAFANA CHANGE :: DEV-31493 Override datasource URL on alert evaluation
package eval

import (
	"fmt"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/instancemgmt"
	"strconv"
)

// LogzioInstanceProvider is the implementation of instancemgmt.InstanceProvider that overrides GetKey function to take
// into consideration Datasource URL to build a key. The reason for that is that for the sake of alert evaluation we need
// to override Datasource URL which causes stale values in the cache if we need to update URL to a different one as the default
// implementation of instance provider uses only datasource ID as a key.
//
// For the rest of operation (apart from GetKey) it delegates the call to the original instance provider.
type LogzioInstanceProvider struct {
	Delegate instancemgmt.InstanceProvider
}

func (ip *LogzioInstanceProvider) GetKey(pluginContext backend.PluginContext) (interface{}, error) {
	if pluginContext.DataSourceInstanceSettings == nil {
		return nil, fmt.Errorf("data source instance settings cannot be nil")
	}

	return strconv.FormatInt(pluginContext.DataSourceInstanceSettings.ID, 10) + ":" + pluginContext.DataSourceInstanceSettings.URL, nil
}

func (ip *LogzioInstanceProvider) NeedsUpdate(pluginContext backend.PluginContext, cachedInstance instancemgmt.CachedInstance) bool {
	return ip.Delegate.NeedsUpdate(pluginContext, cachedInstance)
}

func (ip *LogzioInstanceProvider) NewInstance(pluginContext backend.PluginContext) (instancemgmt.Instance, error) {
	return ip.Delegate.NewInstance(pluginContext)
}

// LOGZ.IO GRAFANA CHANGE :: end
