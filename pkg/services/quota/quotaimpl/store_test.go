package quotaimpl

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
)

func TestIntegrationQuotaDataAccess(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	ss := db.InitTestDB(t)
	quotaStore := sqlStore{
		db: ss,
	}

	t.Run("quota deleted", func(t *testing.T) {
		err := quotaStore.DeleteByUser(context.Background(), 1)
		require.NoError(t, err)
	})
}
