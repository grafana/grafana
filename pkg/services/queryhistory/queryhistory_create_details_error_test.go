package queryhistory

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/util/testutil"
)

// cancelBeforeDetailsStore lets the first WithDbSession call (the
// query_history write) proceed normally and cancels the request context just
// before the second one, so the query_history_details inserts fail inside
// session.Insert on every supported database.
type cancelBeforeDetailsStore struct {
	*sqlstore.SQLStore
	sessions int
	cancel   context.CancelFunc
}

func (f *cancelBeforeDetailsStore) WithDbSession(ctx context.Context, callback sqlstore.DBTransactionFunc) error {
	f.sessions++
	if f.sessions == 2 {
		f.cancel()
	}
	return f.SQLStore.WithDbSession(ctx, callback)
}

func mixedDataSourceCreateCommand() CreateQueryInQueryHistoryCommand {
	return CreateQueryInQueryHistoryCommand{
		DatasourceUID: "ds-one",
		Queries: simplejson.NewFromAny([]any{
			map[string]any{
				"datasource": map[string]any{"uid": "ds-one"},
			},
			map[string]any{
				"datasource": map[string]any{"uid": "ds-two"},
			},
		}),
	}
}

func countRows(t *testing.T, sqlStore *sqlstore.SQLStore, table string) int64 {
	t.Helper()

	var count int64
	err := sqlStore.WithDbSession(context.Background(), func(dbSession *db.Session) error {
		var err error
		count, err = dbSession.Table(table).Count()
		return err
	})
	require.NoError(t, err)
	return count
}

func newFailingDetailsServiceTest(t *testing.T) (*sqlstore.SQLStore, QueryHistoryService, context.Context) {
	t.Helper()

	sqlStore, cfg := db.InitTestDBWithCfg(t) //nolint:staticcheck // legacy shared-DB test setup; migrate to NewTestStore
	cfg.QueryHistoryEnabled = true

	ctx, cancel := context.WithCancel(context.Background())
	t.Cleanup(cancel)

	service := QueryHistoryService{
		Cfg:   cfg,
		store: &cancelBeforeDetailsStore{SQLStore: sqlStore, cancel: cancel},
		now:   time.Now,
	}

	return sqlStore, service, ctx
}

// TestIntegrationCreateQueryReturnsErrorWhenDetailsInsertFails ensures a
// failed query_history_details insert surfaces as an error instead of being
// silently discarded while the API reports success.
func TestIntegrationCreateQueryReturnsErrorWhenDetailsInsertFails(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	_, service, ctx := newFailingDetailsServiceTest(t)

	_, err := service.CreateQueryInQueryHistory(ctx, &user.SignedInUser{
		UserID: 1,
		OrgID:  1,
	}, mixedDataSourceCreateCommand())

	require.Error(t, err, "createQuery must report the failed details write instead of returning success")
	require.ErrorContains(t, err, "context canceled")
}

// TestIntegrationCreateQueryRollsBackWhenDetailsInsertFails ensures a failed
// details write leaves no partially created history entry behind.
func TestIntegrationCreateQueryRollsBackWhenDetailsInsertFails(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	sqlStore, service, ctx := newFailingDetailsServiceTest(t)

	_, err := service.CreateQueryInQueryHistory(ctx, &user.SignedInUser{
		UserID: 1,
		OrgID:  1,
	}, mixedDataSourceCreateCommand())

	require.Error(t, err)
	require.Zero(t, countRows(t, sqlStore, "query_history"), "the history entry must be rolled back when its details cannot be written")
	require.Zero(t, countRows(t, sqlStore, "query_history_details"))
}

// TestIntegrationCreateQueryHappyPathStillWorks guards against the error
// propagation breaking the normal single-datasource flow.
func TestIntegrationCreateQueryHappyPathStillWorks(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	sqlStore, cfg := db.InitTestDBWithCfg(t) //nolint:staticcheck // legacy shared-DB test setup; migrate to NewTestStore

	service := QueryHistoryService{
		Cfg:   cfg,
		store: sqlStore,
		now:   time.Now,
	}
	cfg.QueryHistoryEnabled = true

	cmd := CreateQueryInQueryHistoryCommand{
		DatasourceUID: "ds-one",
		Queries: simplejson.NewFromAny([]any{
			map[string]any{
				"datasource": map[string]any{"uid": "ds-one"},
			},
		}),
	}

	dto, err := service.CreateQueryInQueryHistory(context.Background(), &user.SignedInUser{
		UserID: 1,
		OrgID:  1,
	}, cmd)

	require.NoError(t, err)
	require.Equal(t, "ds-one", dto.DatasourceUID)
	require.NotEmpty(t, dto.UID)
}
