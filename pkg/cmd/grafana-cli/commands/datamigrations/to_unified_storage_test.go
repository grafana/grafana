package datamigrations

import (
	"context"
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestIntegrationUnifiedStorageCommand(t *testing.T) {
	testutil.
		// setup datasources with password, basic_auth and none
		SkipIntegrationTestInShortMode(t)

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
		fmt.Printf("TODO... add folders and check that they migrate\n")
	})
}
