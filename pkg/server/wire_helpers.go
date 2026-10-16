package server

import (
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/trace"

	collectionsmigration "github.com/grafana/grafana/pkg/registry/apis/collections"
	legacystars "github.com/grafana/grafana/pkg/registry/apis/collections/legacy"
	dashboardmigration "github.com/grafana/grafana/pkg/registry/apis/dashboard"
	dashboardmigrator "github.com/grafana/grafana/pkg/registry/apis/dashboard/migrator"
	snapshotmigration "github.com/grafana/grafana/pkg/registry/apis/dashboard/snapshot"
	snapshotmigrator "github.com/grafana/grafana/pkg/registry/apis/dashboard/snapshot/migrator"
	dsmigration "github.com/grafana/grafana/pkg/registry/apis/datasource"
	dsmigrator "github.com/grafana/grafana/pkg/registry/apis/datasource/migrator"
	preferencesmigration "github.com/grafana/grafana/pkg/registry/apis/preferences"
	legacypreferences "github.com/grafana/grafana/pkg/registry/apis/preferences/legacy"
	playlistmigration "github.com/grafana/grafana/pkg/registry/apps/playlist"
	playlistmigrator "github.com/grafana/grafana/pkg/registry/apps/playlist/migrator"
	querycachingmigration "github.com/grafana/grafana/pkg/registry/apps/querycaching"
	querycachingmigrator "github.com/grafana/grafana/pkg/registry/apps/querycaching/migrator"
	shorturlmigration "github.com/grafana/grafana/pkg/registry/apps/shorturl"
	shorturlmigrator "github.com/grafana/grafana/pkg/registry/apps/shorturl/migrator"
	unifiedmigrations "github.com/grafana/grafana/pkg/storage/unified/migrations"
)

func OtelTracer() trace.Tracer {
	return otel.GetTracerProvider().Tracer("grafana")
}

// ProvideMigrationRegistry builds the MigrationRegistry from individual
// resource migrators. When adding a new resource migration, register it with
// the registry here.
func ProvideMigrationRegistry(
	dashMigrator dashboardmigrator.FoldersDashboardsMigrator,
	playlistMigrator playlistmigrator.PlaylistMigrator,
	shortURLMigrator shorturlmigrator.ShortURLMigrator,
	snapshotMigrator snapshotmigrator.SnapshotMigrator,
	dataSourceMigrator dsmigrator.DataSourceMigrator,
	starsMigrator legacystars.StarsMigrator,
	preferencesMigrator legacypreferences.PreferencesMigrator,
	queryCacheConfigMigrator querycachingmigrator.QueryCacheConfigMigrator,
) *unifiedmigrations.MigrationRegistry {
	r := unifiedmigrations.NewMigrationRegistry()
	r.Register(dashboardmigration.FoldersDashboardsMigration(dashMigrator))
	r.Register(playlistmigration.PlaylistMigration(playlistMigrator))
	r.Register(shorturlmigration.ShortURLMigration(shortURLMigrator))
	r.Register(snapshotmigration.SnapshotMigration(snapshotMigrator))
	r.Register(dsmigration.DataSourceMigration(dataSourceMigrator))
	r.Register(collectionsmigration.StarsMigration(starsMigrator))
	r.Register(preferencesmigration.PreferencesMigration(preferencesMigrator))
	r.Register(querycachingmigration.QueryCacheConfigMigration(queryCacheConfigMigrator))
	return r
}
