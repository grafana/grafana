package apiregistry

import (
	"github.com/google/wire"

	"github.com/grafana/grafana/pkg/registry/apis/dashboard"
	"github.com/grafana/grafana/pkg/registry/apis/datasource"
	"github.com/grafana/grafana/pkg/registry/apis/example"
	"github.com/grafana/grafana/pkg/registry/apis/featuretoggle"
	"github.com/grafana/grafana/pkg/registry/apis/folders"
	"github.com/grafana/grafana/pkg/registry/apis/playlist"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/plugincontext"
)

var WireSet = wire.NewSet(
	ProvideRegistryServiceSink, // dummy background service that forces registration

	// Should this be here? seems like it should live with standard plugin stuff
	plugincontext.ProvideService,
	datasource.ProvideDefaultPluginConfigs,

	// Each must be added here *and* in the ServiceSink above
	playlist.RegisterAPIService,
	dashboard.RegisterAPIService,
	example.RegisterAPIService,
	featuretoggle.RegisterAPIService,
	datasource.RegisterAPIService,
	folders.RegisterAPIService,
)
