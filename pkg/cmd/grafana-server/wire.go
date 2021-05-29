// +build wireinject

package main

import (
	"github.com/google/wire"
	sdkhttpclient "github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/grafana/grafana/pkg/api"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/infra/httpclient"
	"github.com/grafana/grafana/pkg/infra/httpclient/httpclientprovider"
	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/infra/remotecache"
	"github.com/grafana/grafana/pkg/infra/serverlock"
	"github.com/grafana/grafana/pkg/infra/usagestats"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/backendplugin"
	backendmanager "github.com/grafana/grafana/pkg/plugins/backendplugin/manager"
	"github.com/grafana/grafana/pkg/plugins/manager"
	"github.com/grafana/grafana/pkg/server"
	"github.com/grafana/grafana/pkg/services/alerting"
	"github.com/grafana/grafana/pkg/services/auth"
	"github.com/grafana/grafana/pkg/services/cleanup"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/hooks"
	"github.com/grafana/grafana/pkg/services/provisioning"
	"github.com/grafana/grafana/pkg/services/quota"
	"github.com/grafana/grafana/pkg/services/rendering"
	"github.com/grafana/grafana/pkg/services/shorturls"
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
	httpclientprovider.New,
	wire.Bind(new(httpclient.Provider), new(*sdkhttpclient.Provider)),
	datasources.ProvideCacheService,
	wire.Bind(new(datasources.CacheService), new(*datasources.CacheServiceImpl)),
	auth.ProvideUserAuthTokenService,
	wire.Bind(new(models.UserTokenService), new(*auth.UserAuthTokenService)),
	serverlock.ProvideService,
	cleanup.ProvideService,
	shorturls.ProvideService,
	quota.ProvideService,
	remotecache.ProvideService,
	provisioning.ProvideService,
	wire.Bind(new(provisioning.ProvisioningService), new(*provisioning.ProvisioningServiceImpl)),
)

func initializeServer(cla setting.CommandLineArgs, opts server.Options, apiOpts api.ServerOptions) (*server.Server, error) {
	wire.Build(wireExtsSet)
	return &server.Server{}, nil
}
