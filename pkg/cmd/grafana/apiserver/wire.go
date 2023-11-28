//go:build wireinject
// +build wireinject

package apiserver

import (
	"context"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/registry"
	apiregistry "github.com/grafana/grafana/pkg/registry/apis"
	"github.com/grafana/grafana/pkg/registry/apis/playlist"
	"github.com/grafana/grafana/pkg/registry/apis/snapshots"
	"github.com/grafana/grafana/pkg/services/dashboardsnapshots"
	dashsnapstore "github.com/grafana/grafana/pkg/services/dashboardsnapshots/database"
	dashsnapsvc "github.com/grafana/grafana/pkg/services/dashboardsnapshots/service"
	"github.com/grafana/grafana/pkg/services/playlist/playlistimpl"
	secrets "github.com/grafana/grafana/pkg/services/secrets"
	secretsfakeimpl "github.com/grafana/grafana/pkg/services/secrets/fakes"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrations"
	"github.com/grafana/grafana/pkg/setting"

	"github.com/google/wire"
)

var dbWireSet = wire.NewSet(
	secretsfakeimpl.ProvideFakeSecretsService,
	wire.Bind(new(secrets.Service), new(*secretsfakeimpl.FakeSecretsService)),
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

func initializeSnapshotsAPIBuilder(ctx context.Context, cfg *setting.Cfg) (*snapshots.SnapshotsAPIBuilder, error) {
	wire.Build(
		dbWireSet,
		dashboardSnapshotsWireSet,
		apiregistry.WireSetSansApiReg,
	)
	return &snapshots.SnapshotsAPIBuilder{}, nil
}

func initializePlaylistsAPIBuilder(ctx context.Context, cfg *setting.Cfg) (*playlist.PlaylistAPIBuilder, error) {
	wire.Build(
		dbWireSet,
		playlistsWireSet,
		apiregistry.WireSetSansApiReg,
	)
	return &playlist.PlaylistAPIBuilder{}, nil
}
