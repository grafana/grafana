//go:build wireinject && oss
// +build wireinject,oss

package wire

import (
	"context"

	"github.com/google/wire"
	sdkhttpclient "github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/mock"

	"github.com/grafana/grafana/pkg/api"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/httpclient"
	"github.com/grafana/grafana/pkg/infra/httpclient/httpclientprovider"
	"github.com/grafana/grafana/pkg/infra/leaderelection"
	"github.com/grafana/grafana/pkg/router"
	"github.com/grafana/grafana/pkg/server"
	"github.com/grafana/grafana/pkg/server/wireext"
	"github.com/grafana/grafana/pkg/services/apiserver/standalone"
	ngmetrics "github.com/grafana/grafana/pkg/services/ngalert/metrics"
	ngrules "github.com/grafana/grafana/pkg/services/ngalert/store/rules"
	"github.com/grafana/grafana/pkg/services/notifications"
	"github.com/grafana/grafana/pkg/services/oauthtoken"
	"github.com/grafana/grafana/pkg/services/preference/prefimpl"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/sqlstore/sqlutil"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/legacysql/legacywatch"
)

func Initialize(ctx context.Context, cfg *setting.Cfg, opts server.Options, apiOpts api.ServerOptions) (*server.Server, error) {
	wire.Build(Server, wireext.BasicSet, router.ProvidePluginLoaderDependencies, router.ProvideRoutesLoader)
	return &server.Server{}, nil
}

func InitializeForTest(ctx context.Context, t sqlutil.ITestDB, testingT interface {
	mock.TestingT
	Cleanup(func())
}, cfg *setting.Cfg, opts server.Options, apiOpts api.ServerOptions,
) (*server.TestEnv, error) {
	wire.Build(Test, wireext.BasicSet, router.ProvidePluginLoaderDependencies, router.ProvideRoutesLoader)
	return &server.TestEnv{Server: &server.Server{}, TestingT: testingT, SQLStore: &sqlstore.SQLStore{}, Cfg: &setting.Cfg{}}, nil
}

func InitializeForCLI(ctx context.Context, cfg *setting.Cfg) (server.Runner, error) {
	wire.Build(CLI, wireext.BasicSet)
	return server.Runner{}, nil
}

// InitializeForCLITarget is a simplified set of dependencies for the CLI, used
// by the server target subcommand to launch specific dskit modules.
func InitializeForCLITarget(ctx context.Context, cfg *setting.Cfg) (server.ModuleRunner, error) {
	wire.Build(BaseCLISet)
	return server.ModuleRunner{}, nil
}

// Initialize the standalone APIServer factory
func InitializeAPIServerFactory() (standalone.APIServerFactory, error) {
	wire.Build(StandaloneAPIServerSet)
	return &standalone.NoOpAPIServerFactory{}, nil // Wire will replace this with a real interface
}

// InitializeRoutesLoader uses the same configured OSS dependency graph as the
// app-plugin API registration.
func InitializeRoutesLoader(cfg *setting.Cfg, clients router.RoutesLoaderClients) (router.RoutesLoader, error) {
	wire.Build(CLI, wireext.BasicSet, provideRoutesLoaderContext, router.ProvidePluginLoaderDependenciesWithClients, router.ProvideRoutesLoader)
	return nil, nil
}

func provideRoutesLoaderContext() context.Context {
	return context.Background()
}

// InitializeAPIServices reuses the production graph with an owned test database
// and registry, including HTTPServer's production route registration.
func InitializeAPIServices(ctx context.Context, cfg *setting.Cfg, store *sqlstore.SQLStore, reg *prometheus.Registry) (*server.APIServices, error) {
	wire.Build(Basic, wireext.BasicSet,
		httpclientprovider.NewForConfig,
		wire.Bind(new(httpclient.Provider), new(*sdkhttpclient.Provider)),
		wire.Bind(new(db.DB), new(*sqlstore.SQLStore)),
		wire.Bind(new(prometheus.Registerer), new(*prometheus.Registry)),
		wire.Bind(new(prometheus.Gatherer), new(*prometheus.Registry)),
		wire.Value(api.ServerOptions{}),
		legacywatch.ProvideDisabledPublisher,
		leaderelection.NewDefaultElector,
		wire.Bind(new(leaderelection.Elector), new(*leaderelection.DefaultElector)),
		oauthtoken.ProvideService,
		wire.Bind(new(oauthtoken.OAuthTokenService), new(*oauthtoken.Service)),
		wire.Bind(new(notifications.Service), new(*notifications.NotificationService)),
		ngmetrics.ProvideService,
		wire.Bind(new(ngrules.MaintenanceStore), new(*ngrules.RuleStore)),
		prefimpl.ProvideService,
		wire.Struct(new(server.APIServices), "*"),
	)
	return nil, nil
}
