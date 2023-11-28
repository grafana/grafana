//go:build wireinject
// +build wireinject

package apiserver

import (
	"context"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/kvstore"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/infra/usagestats"
	uss "github.com/grafana/grafana/pkg/infra/usagestats/service"
	"github.com/grafana/grafana/pkg/registry"
	apiregistry "github.com/grafana/grafana/pkg/registry/apis"
	"github.com/grafana/grafana/pkg/registry/apis/snapshots"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/acimpl"
	"github.com/grafana/grafana/pkg/services/dashboardsnapshots"
	dashsnapstore "github.com/grafana/grafana/pkg/services/dashboardsnapshots/database"
	dashsnapsvc "github.com/grafana/grafana/pkg/services/dashboardsnapshots/service"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	// "github.com/grafana/grafana/pkg/services/navtree/navtreeimpl"
	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/services/secrets"
	secretsmanager "github.com/grafana/grafana/pkg/services/secrets/manager"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrations"
	"github.com/grafana/grafana/pkg/services/supportbundles"
	"github.com/grafana/grafana/pkg/services/supportbundles/bundleregistry"
	"github.com/grafana/grafana/pkg/setting"

	"github.com/google/wire"
)

var featureManagerWireSet = wire.NewSet(
	featuremgmt.ProvideManagerService,
	featuremgmt.ProvideToggles,
)

var accessControlWireSet = wire.NewSet(
	// navtreeimpl.ProvideService,
	acimpl.ProvideService,
	wire.Bind(new(accesscontrol.Service), new(*acimpl.Service)),
	// acimpl.ProvideAccessControl,
	// wire.Bind(new(accesscontrol.AccessControl), new(*acimpl.AccessControl)),
)

var dbWireSet = wire.NewSet(
	routing.ProvideRegister,
	wire.Bind(new(routing.RouteRegister), new(*routing.RouteRegisterImpl)),
	kvstore.ProvideService,
	uss.ProvideService,
	wire.Bind(new(usagestats.Service), new(*uss.UsageStats)),
	bundleregistry.ProvideService,
	wire.Bind(new(supportbundles.Service), new(*bundleregistry.Service)),
	secretsmanager.ProvideSecretsService,
	wire.Bind(new(secrets.Service), new(*secretsmanager.SecretsService)),
	migrations.ProvideOSSMigrations,
	wire.Bind(new(registry.DatabaseMigrator), new(*migrations.OSSMigrations)),
	tracing.ProvideService,
	wire.Bind(new(tracing.Tracer), new(*tracing.TracingService)),
	bus.ProvideBus,
	wire.Bind(new(bus.Bus), new(*bus.InProcBus)),
	localcache.ProvideService,
	sqlstore.ProvideService,
	wire.Bind(new(db.DB), new(*sqlstore.SQLStore)),
)

var dashboardSnapshotsWireSet = wire.NewSet(
	wire.Bind(new(dashboardsnapshots.Store), new(*dashsnapstore.DashboardSnapshotStore)),
	dashsnapstore.ProvideStore,
	wire.Bind(new(dashboardsnapshots.Service), new(*dashsnapsvc.ServiceImpl)),
	dashsnapsvc.ProvideService,
)

func initializeSnapshotsAPIBuilder(ctx context.Context, cfg *setting.Cfg) (*snapshots.SnapshotsAPIBuilder, error) {
	wire.Build(
		featureManagerWireSet,
		accessControlWireSet,
		dbWireSet,
		dashboardSnapshotsWireSet,
		apiregistry.WireSetSansApiReg,
	)
	return &snapshots.SnapshotsAPIBuilder{}, nil
}
