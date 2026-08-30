package commands

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestIntegrationLogLastMigration(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	store := sqlstore.NewTestStore(t)

	last, err := lastMigration(store)
	require.NoError(t, err)
	require.NotNil(t, last, "NewTestStore runs OSS migrations; the last row must be present")
	require.NotEmpty(t, last.MigrationID)
	require.False(t, last.Timestamp.IsZero())

	require.NoError(t, logLastMigration(nil, nil, store))
}

// A store with no migration_log table must surface an error so the CLI
// doesn't silently report nothing as if the migration succeeded.
func TestIntegrationLogLastMigration_MissingTable(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	store := sqlstore.NewTestStore(t, sqlstore.WithoutMigrator())

	_, err := lastMigration(store)
	require.Error(t, err)

	require.Error(t, logLastMigration(nil, nil, store))
}
