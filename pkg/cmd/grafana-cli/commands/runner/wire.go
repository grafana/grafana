//go:build wireinject
// +build wireinject

package runner

import (
	"context"

	"github.com/google/wire"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/infra/usagestats"
	"github.com/grafana/grafana/pkg/services/secrets"
	secretsDatabase "github.com/grafana/grafana/pkg/services/secrets/database"
	secretsManager "github.com/grafana/grafana/pkg/services/secrets/manager"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"
)

var wireSet = wire.NewSet(
	New,
	localcache.ProvideService,
	bus.ProvideBus,
	wire.Bind(new(bus.Bus), new(*bus.InProcBus)),
	sqlstore.ProvideService,
	wire.InterfaceValue(new(usagestats.Service), noOpUsageStats{}),
	wire.InterfaceValue(new(routing.RouteRegister), noOpRouteRegister{}),
	secretsDatabase.ProvideSecretsStore,
	wire.Bind(new(secrets.Store), new(*secretsDatabase.SecretsStoreImpl)),
	secretsManager.ProvideSecretsService,
	wire.Bind(new(secrets.Service), new(*secretsManager.SecretsService)),
)

func Initialize(cfg *setting.Cfg) (Runner, error) {
	wire.Build(wireExtsSet)
	return Runner{}, nil
}

// NoOp implementations of those dependencies that makes no sense to
// inject on CLI command executions (like the route registerer, for instance).

type noOpUsageStats struct{}

func (noOpUsageStats) GetUsageReport(context.Context) (usagestats.Report, error) {
	return usagestats.Report{}, nil
}

func (noOpUsageStats) RegisterMetricsFunc(_ usagestats.MetricsFunc) {}

func (noOpUsageStats) RegisterSendReportCallback(_ usagestats.SendReportCallbackFunc) {}

func (noOpUsageStats) ShouldBeReported(string) bool { return false }

type noOpRouteRegister struct{}

func (noOpRouteRegister) Get(string, ...web.Handler) {}

func (noOpRouteRegister) Post(string, ...web.Handler) {}

func (noOpRouteRegister) Delete(string, ...web.Handler) {}

func (noOpRouteRegister) Put(string, ...web.Handler) {}

func (noOpRouteRegister) Patch(string, ...web.Handler) {}

func (noOpRouteRegister) Any(string, ...web.Handler) {}

func (noOpRouteRegister) Group(string, func(routing.RouteRegister), ...web.Handler) {}

func (noOpRouteRegister) Insert(string, func(routing.RouteRegister), ...web.Handler) {}

func (noOpRouteRegister) Register(routing.Router) {}

func (noOpRouteRegister) Reset() {}
