package server

import (
	"testing"

	"github.com/stretchr/testify/require"

	legacystars "github.com/grafana/grafana/pkg/registry/apis/collections/legacy"
	dashboardmigrator "github.com/grafana/grafana/pkg/registry/apis/dashboard/migrator"
	snapshotmigrator "github.com/grafana/grafana/pkg/registry/apis/dashboard/snapshot/migrator"
	dsmigrator "github.com/grafana/grafana/pkg/registry/apis/datasource/migrator"
	legacypreferences "github.com/grafana/grafana/pkg/registry/apis/preferences/legacy"
	playlistmigrator "github.com/grafana/grafana/pkg/registry/apps/playlist/migrator"
	querycachingmigrator "github.com/grafana/grafana/pkg/registry/apps/querycaching/migrator"
	shorturlmigrator "github.com/grafana/grafana/pkg/registry/apps/shorturl/migrator"
	"github.com/grafana/grafana/pkg/storage/unified/federated"
)

// stubMigrator satisfies every migrator interface the registry needs. Registering a
// migration only reads the definitions, so the embedded interfaces stay nil.
type stubMigrator struct {
	dashboardmigrator.FoldersDashboardsMigrator
	playlistmigrator.PlaylistMigrator
	shorturlmigrator.ShortURLMigrator
	snapshotmigrator.SnapshotMigrator
	dsmigrator.DataSourceMigrator
	legacystars.StarsMigrator
	legacypreferences.PreferencesMigrator
	querycachingmigrator.QueryCacheConfigMigrator
}

// Folder counts fall back to the legacy SQL tables for a few resources, and
// federated.legacyTableIsStale decides from config alone whether those tables are still
// written. That shortcut only holds while the resource has no migration registered,
// because the migration log, not config, is what marks a resource as migrated.
func TestLegacyCountedResourcesHaveNoMigration(t *testing.T) {
	s := stubMigrator{}
	registry := ProvideMigrationRegistry(s, s, s, s, s, s, s, s)

	migrated := map[string]bool{}
	for _, def := range registry.All() {
		for _, res := range def.Resources {
			migrated[res.String()] = true
		}
	}

	for _, resource := range federated.LegacyCountedResources {
		require.False(t, migrated[resource],
			"%s now has a migration registered, so federated.legacyTableIsStale must read the migration status instead of the configured mode",
			resource)
	}
}
