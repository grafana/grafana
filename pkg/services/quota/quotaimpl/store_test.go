package quotaimpl

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/stretchr/testify/require"
)

func TestIntegrationQuotaDataAccess(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	ss := sqlstore.InitTestDB(t)
	quotaStore := sqlStore{
		db: ss,
	}

	t.Run("quota deleted", func(t *testing.T) {
		err := quotaStore.DeleteByUser(context.Background(), 1)
		require.NoError(t, err)
	})
}
