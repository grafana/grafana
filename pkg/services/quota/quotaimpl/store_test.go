package quotaimpl

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/quota"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestIntegrationQuotaDataAccess(t *testing.T) {
	t.Parallel()
	testutil.SkipIntegrationTestInShortMode(t)

	ss := sqlstore.NewTestStore(t)
	quotaStore := sqlStore{
		db: ss,
	}

	t.Run("quota deleted", func(t *testing.T) {
		ctx := quota.FromContext(context.Background(), &quota.TargetToSrv{})
		err := quotaStore.DeleteByUser(ctx, 1)
		require.NoError(t, err)
	})
}
