package apiregistry

import (
	"github.com/grafana/grafana/pkg/build/wire"

	"github.com/grafana/grafana/pkg/registry/apis/dashboard"
	"github.com/grafana/grafana/pkg/registry/apis/dashboardsnapshot"
	"github.com/grafana/grafana/pkg/registry/apis/datasource"
	"github.com/grafana/grafana/pkg/registry/apis/example"
	"github.com/grafana/grafana/pkg/registry/apis/featuretoggle"
	"github.com/grafana/grafana/pkg/registry/apis/folders"
	"github.com/grafana/grafana/pkg/registry/apis/peakq"
	"github.com/grafana/grafana/pkg/registry/apis/playlist"
	"github.com/grafana/grafana/pkg/registry/apis/query"
	"github.com/grafana/grafana/pkg/registry/apis/scope"
	"github.com/grafana/grafana/pkg/registry/apis/service"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/plugincontext"
)

var WireSet = wire.NewSet(
	ProvideRegistryServiceSink, // dummy background service that forces registration

	// read-only datasource abstractions
	plugincontext.ProvideService,
	wire.Bind(new(datasource.PluginContextWrapper), new(*plugincontext.Provider)),
	datasource.ProvideDefaultPluginConfigs,

	// Each must be added here *and* in the ServiceSink above
	playlist.RegisterAPIService,
	dashboard.RegisterAPIService,
	example.RegisterAPIService,
	dashboardsnapshot.RegisterAPIService,
	featuretoggle.RegisterAPIService,
	datasource.RegisterAPIService,
	folders.RegisterAPIService,
	peakq.RegisterAPIService,
	service.RegisterAPIService,
	query.RegisterAPIService,
	scope.RegisterAPIService,
)
