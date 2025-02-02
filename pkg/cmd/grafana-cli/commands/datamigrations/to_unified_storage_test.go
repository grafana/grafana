package datamigrations

import (
	"context"
	"fmt"
	"os"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

func TestUnifiedStorageCommand(t *testing.T) {
	// setup datasources with password, basic_auth and none
	store := db.InitTestDB(t)
	err := store.WithDbSession(context.Background(), func(sess *db.Session) error {
		unistoreMigrationTest(t, sess, store)
		return nil
	})
	require.NoError(t, err)
}

func unistoreMigrationTest(t *testing.T, session *db.Session, sqlstore db.DB) {
	// empty stats

	t.Run("get stats", func(t *testing.T) {
		stats, err := getStats(1, session)
		require.NoError(t, err)

		fmt.Printf("TODO... add folders and check that they migrate\n%+v\n", stats)
	})

	t.Run("xxx", func(t *testing.T) {
		file, err := os.CreateTemp("", "grafana-batch-export-*.parquet")
		require.NoError(t, err)

		unified, err := newParquetBackend(file)
		require.NoError(t, err)

		_, err = unified.GetStats(context.Background(), &resource.ResourceStatsRequest{})
		require.Error(t, err)
	})

}
