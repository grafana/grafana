//go:build wireinject && oss
// +build wireinject,oss

package wire

import (
	"github.com/google/wire"

	"github.com/grafana/grafana/pkg/configprovider"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/leaderelection"
	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/extras"
	"github.com/grafana/grafana/pkg/router"
	"github.com/grafana/grafana/pkg/server"
	"github.com/grafana/grafana/pkg/services/apiserver/standalone"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/hooks"
	"github.com/grafana/grafana/pkg/services/licensing"
	ngmetrics "github.com/grafana/grafana/pkg/services/ngalert/metrics"
	"github.com/grafana/grafana/pkg/services/notifications"
	"github.com/grafana/grafana/pkg/services/oauthtoken"
	"github.com/grafana/grafana/pkg/services/preference/prefimpl"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
)

var provisioningExtras = wire.NewSet(
	extras.ProvideProvisioningOSSRepositoryExtras,
	extras.ProvideProvisioningOSSConnectionExtras,
	extras.ProvideFactoryFromConfig,
	extras.ProvideConnectionFactoryFromConfig,
)

var configProviderExtras = wire.NewSet(
	configprovider.ProvideService,
)

// BaseCLISet is a simplified set of dependencies for the OSS CLI, suitable for
// running background services and targeted dskit modules without starting the
// full Grafana server.
var BaseCLISet = wire.NewSet(
	server.NewModuleRunner,
	metrics.WireSet,
	featuremgmt.ProvideManagerService,
	featuremgmt.ProvideToggles,
	hooks.ProvideService,
	setting.ProvideProvider, wire.Bind(new(setting.Provider), new(*setting.OSSImpl)),
	licensing.ProvideService, wire.Bind(new(licensing.Licensing), new(*licensing.OSSLicensingService)),
	configProviderExtras,
)

var StandaloneAPIServerSet = wire.NewSet(
	standalone.ProvideAPIServerFactory,
)

var RouterFactorySet = wire.NewSet(
	router.ProvideRouterFactory,
)

// PluginRouterDepsSet builds the plugin stack the plugin-router module serves
// through. It is the CLI set's contents, with two deliberate differences.
//
// server.NewRunner is left out: this builds components, it does not run a
// server. And the metrics registry is this graph's own rather than the global
// one, because the process that asks for these components has already built
// some of them for itself -- the storage and vector metrics among them -- and
// two constructions registering the same collectors on one registry panics.
// The cost is that this graph's copies are not scraped, which is right: they
// are a second instance of the same collectors, and exporting both would
// double-count.
var PluginRouterDepsSet = wire.NewSet(
	Basic,
	provideIsolatedRegisterer,
	metrics.ProvideService,
	metrics.ProvideGatherer,
	sqlstore.ProvideService,
	ngmetrics.ProvideService,
	wire.Bind(new(notifications.Service), new(*notifications.NotificationService)),
	wire.Bind(new(notifications.WebhookSender), new(*notifications.NotificationService)),
	wire.Bind(new(notifications.EmailSender), new(*notifications.NotificationService)),
	wire.Bind(new(db.DB), new(*sqlstore.SQLStore)),
	prefimpl.ProvideService,
	oauthtoken.ProvideService,
	wire.Bind(new(oauthtoken.OAuthTokenService), new(*oauthtoken.Service)),
	leaderelection.NewDefaultElector,
	wire.Bind(new(leaderelection.Elector), new(*leaderelection.DefaultElector)),
)
