package sqlstore_test

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrations"
	"github.com/stretchr/testify/require"
)

// Ensure that we can get any connection at all.
// If this test fails, it may be sensible to ignore a lot of other test failures as they may be rooted in this.
func TestIntegrationTempDatabaseConnect(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	sqlStore := sqlstore.NewTestStore(t)
	err := sqlStore.WithDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		_, err := sess.Exec("SELECT 1")
		return err
	})
	require.NoError(t, err, "failed to execute a SELECT 1")
}

// Ensure that migrations work on the database.
// If this test fails, it may be sensible to ignore a lot of other test failures as they may be rooted in this.
// This only applies OSS migrations, with no feature flags.
func TestIntegrationTempDatabaseOSSMigrate(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	migrator := migrations.ProvideOSSMigrations(featuremgmt.WithFeatures())
	_ = sqlstore.NewTestStore(t, sqlstore.WithMigrator(migrator))
}
