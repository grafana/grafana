// +build wireinject

package main

import (
	"github.com/google/wire"
	"github.com/grafana/grafana/pkg/api"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/infra/usagestats"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/backendplugin"
	backendmanager "github.com/grafana/grafana/pkg/plugins/backendplugin/manager"
	"github.com/grafana/grafana/pkg/plugins/manager"
	"github.com/grafana/grafana/pkg/server"
	"github.com/grafana/grafana/pkg/services/alerting"
	"github.com/grafana/grafana/pkg/services/hooks"
	"github.com/grafana/grafana/pkg/services/rendering"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/validations"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tsdb"
	"github.com/grafana/grafana/pkg/tsdb/azuremonitor"
	"github.com/grafana/grafana/pkg/tsdb/cloudmonitoring"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch"
	"github.com/grafana/grafana/pkg/tsdb/postgres"
)

var wireSet = wire.NewSet(
	tsdb.NewService,
	wire.Bind(new(plugins.DataRequestHandler), new(*tsdb.Service)),
	alerting.ProvideAlertEngine,
	wire.Bind(new(alerting.UsageStatsQuerier), new(*alerting.AlertEngine)),
	setting.NewCfg,
	server.New,
	api.ProvideHTTPServer,
	bus.ProvideBus,
	wire.Bind(new(bus.Bus), new(*bus.InProcBus)),
	rendering.ProvideService,
	wire.Bind(new(rendering.Service), new(*rendering.RenderingService)),
	routing.ProvideRegister,
	wire.Bind(new(routing.RouteRegister), new(*routing.RouteRegisterImpl)),
	hooks.ProvideService,
	sqlstore.ProvideService,
	localcache.ProvideService,
	usagestats.ProvideService,
	validations.ProvideValidator,
	wire.Bind(new(models.PluginRequestValidator), new(*validations.OSSPluginRequestValidator)),
	manager.ProvideService,
	wire.Bind(new(plugins.Manager), new(*manager.PluginManager)),
	backendmanager.ProvideService,
	wire.Bind(new(backendplugin.Manager), new(*backendmanager.Manager)),
	cloudwatch.ProvideService,
	cloudwatch.ProvideLogsService,
	cloudmonitoring.ProvideService,
	azuremonitor.ProvideService,
	postgres.ProvideService,
)

func initializeServer(cla setting.CommandLineArgs, opts server.Options, apiOpts api.ServerOptions) (*server.Server, error) {
	wire.Build(wireExtsSet)
	return &server.Server{}, nil
}
