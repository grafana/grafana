package checks

import (
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/registry/apis/datasource"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
)

// AdvisorConfig contains the list of wire services checks are allowed to use.
type AdvisorConfig struct {
	DatasourceSvc         datasources.DataSourceService
	PluginStore           pluginstore.Store
	PluginContextProvider datasource.PluginContextWrapper
	PluginClient          plugins.Client
}
