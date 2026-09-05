package annotationsimpl

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/util/testutil"
)

// TestIntegrationAnnotationDashboardUIDIndexExists guards against issue
// #126504: annotation queries filter on dashboard_uid with an org_id /
// epoch_end / epoch time-range shape, which degrades to a full org scan when
// the dashboard_uid composite index is missing.
func TestIntegrationAnnotationDashboardUIDIndexExists(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	sqlStore := db.InitTestDB(t) //nolint:staticcheck // legacy shared-DB test setup; migrate to NewTestStore

	const indexName = "IDX_annotation_org_id_dashboard_uid_epoch_end_epoch"

	var count int
	switch {
	case db.IsTestDbSQLite():
		err := sqlStore.WithDbSession(context.Background(), func(sess *db.Session) error {
			has, err := sess.SQL(
				`SELECT COUNT(*) FROM sqlite_master WHERE type = 'index' AND name = ?`, indexName,
			).Get(&count)
			if err != nil {
				return err
			}
			if !has {
				count = 0
			}
			return nil
		})
		require.NoError(t, err)
	case db.IsTestDbMySQL():
		err := sqlStore.WithDbSession(context.Background(), func(sess *db.Session) error {
			has, err := sess.SQL(
				`SELECT COUNT(*) FROM information_schema.statistics WHERE table_name = 'annotation' AND index_name = ?`, indexName,
			).Get(&count)
			if err != nil {
				return err
			}
			if !has {
				count = 0
			}
			return nil
		})
		require.NoError(t, err)
	case db.IsTestDbPostgres():
		err := sqlStore.WithDbSession(context.Background(), func(sess *db.Session) error {
			has, err := sess.SQL(
				`SELECT COUNT(*) FROM pg_indexes WHERE indexname = $1`, indexName,
			).Get(&count)
			if err != nil {
				return err
			}
			if !has {
				count = 0
			}
			return nil
		})
		require.NoError(t, err)
	default:
		t.Skipf("unsupported test database")
	}

	require.NotZero(t, count, "index %s must exist so dashboard_uid time-range queries do not scan the whole org", indexName)
}
