package queryhistory

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/util/testutil"
)

// failingDetailsStore fails the second WithDbSession call, which in
// createQuery is the query_history_details write.
type failingDetailsStore struct {
	*sqlstore.SQLStore
	detailsCalls int
}

func (f *failingDetailsStore) WithDbSession(ctx context.Context, callback sqlstore.DBTransactionFunc) error {
	f.detailsCalls++
	if f.detailsCalls == 2 {
		return errors.New("simulated query_history_details write failure")
	}
	return f.SQLStore.WithDbSession(ctx, callback)
}

// TestIntegrationCreateQueryReturnsErrorWhenDetailsWriteFails ensures a failed
// query_history_details write surfaces as an error instead of being silently
// discarded while the API reports success. The failure is injected at the
// WithDbSession boundary; the insert loop inside propagates any error returned
// by its callback, so an insert-level failure reaches this same check.
func TestIntegrationCreateQueryReturnsErrorWhenDetailsWriteFails(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	sqlStore, cfg := db.InitTestDBWithCfg(t) //nolint:staticcheck // legacy shared-DB test setup; migrate to NewTestStore

	service := QueryHistoryService{
		Cfg:   cfg,
		store: &failingDetailsStore{SQLStore: sqlStore},
		now:   time.Now,
	}
	cfg.QueryHistoryEnabled = true

	cmd := CreateQueryInQueryHistoryCommand{
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

	_, err := service.CreateQueryInQueryHistory(context.Background(), &user.SignedInUser{
		UserID: 1,
		OrgID:  1,
	}, cmd)

	require.Error(t, err, "createQuery must report the failed details write instead of returning success")
	require.ErrorContains(t, err, "simulated query_history_details write failure")
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
