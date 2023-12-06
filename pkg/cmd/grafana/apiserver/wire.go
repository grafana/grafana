//go:build wireinject
// +build wireinject

package apiserver

import (
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/kvstore"
	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/infra/usagestats"
	uss "github.com/grafana/grafana/pkg/infra/usagestats/service"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/registry/apis/example"
	"github.com/grafana/grafana/pkg/registry/apis/playlist"
	"github.com/grafana/grafana/pkg/registry/apis/snapshots"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/acimpl"
	"github.com/grafana/grafana/pkg/services/dashboardsnapshots"
	dashsnapstore "github.com/grafana/grafana/pkg/services/dashboardsnapshots/database"
	dashsnapsvc "github.com/grafana/grafana/pkg/services/dashboardsnapshots/service"
	"github.com/grafana/grafana/pkg/services/encryption"
	encryptionprovider "github.com/grafana/grafana/pkg/services/encryption/provider"
	encryptionservice "github.com/grafana/grafana/pkg/services/encryption/service"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/hooks"
	"github.com/grafana/grafana/pkg/services/kmsproviders"
	"github.com/grafana/grafana/pkg/services/kmsproviders/osskmsproviders"
	"github.com/grafana/grafana/pkg/services/licensing"
	"github.com/grafana/grafana/pkg/services/playlist/playlistimpl"
	"github.com/grafana/grafana/pkg/services/secrets"
	secretsDatabase "github.com/grafana/grafana/pkg/services/secrets/database"
	secretsmanager "github.com/grafana/grafana/pkg/services/secrets/manager"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrations"
	"github.com/grafana/grafana/pkg/services/supportbundles"
	"github.com/grafana/grafana/pkg/services/supportbundles/bundleregistry"
	"github.com/grafana/grafana/pkg/setting"

	"github.com/google/wire"
)

var secretServiceWireSet = wire.NewSet(
	encryptionprovider.ProvideEncryptionProvider,
	wire.Bind(new(encryption.Provider), new(encryptionprovider.Provider)),
	hooks.ProvideService,
	licensing.ProvideService, wire.Bind(new(licensing.Licensing), new(*licensing.OSSLicensingService)),
	encryptionservice.ProvideEncryptionService,
	wire.Bind(new(encryption.Internal), new(*encryptionservice.Service)),
	featuremgmt.ProvideManagerService,
	featuremgmt.ProvideToggles,
	osskmsproviders.ProvideService,
	wire.Bind(new(kmsproviders.Service), new(osskmsproviders.Service)),
	acimpl.ProvideAccessControl,
	wire.Bind(new(accesscontrol.AccessControl), new(*acimpl.AccessControl)),
	acimpl.ProvideService,
	wire.Bind(new(accesscontrol.RoleRegistry), new(*acimpl.Service)),
	wire.Bind(new(accesscontrol.Service), new(*acimpl.Service)),
	routing.ProvideRegister,
	wire.Bind(new(routing.RouteRegister), new(*routing.RouteRegisterImpl)),
	kvstore.ProvideService,
	uss.ProvideService,
	wire.Bind(new(usagestats.Service), new(*uss.UsageStats)),
	bundleregistry.ProvideService,
	wire.Bind(new(supportbundles.Service), new(*bundleregistry.Service)),
	secretsDatabase.ProvideSecretsStore,
	wire.Bind(new(secrets.Store), new(*secretsDatabase.SecretsStoreImpl)),
	secretsmanager.ProvideSecretsService,
	wire.Bind(new(secrets.Service), new(*secretsmanager.SecretsService)),
)

var dbWireSet = wire.NewSet(
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

var playlistsWireSet = wire.NewSet(
	playlistimpl.ProvideService,
)

func initializeExampleAPIBuilder(cfg *setting.Cfg) (*example.TestingAPIBuilder, error) {
	wire.Build(example.NewTestingAPIBuilder)
	return &example.TestingAPIBuilder{}, nil
}

func initializeSnapshotsAPIBuilder(cfg *setting.Cfg) (*snapshots.SnapshotsAPIBuilder, error) {
	wire.Build(
		secretServiceWireSet,
		dbWireSet,
		dashboardSnapshotsWireSet,
		snapshots.NewSnapshotsAPIBuilder,
	)
	return &snapshots.SnapshotsAPIBuilder{}, nil
}

func initializePlaylistsAPIBuilder(cfg *setting.Cfg) (*playlist.PlaylistAPIBuilder, error) {
	wire.Build(
		dbWireSet,
		playlistsWireSet,
		playlist.NewPlaylistAPIBuilder,
	)
	return &playlist.PlaylistAPIBuilder{}, nil
}
