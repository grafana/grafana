package quotaimpl

import (
	"context"
	"os"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/quota"
)

func TestMain(m *testing.M) {
	code := m.Run()
	db.CleanupTestDB()
	os.Exit(code)
}

func TestIntegrationQuotaDataAccess(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	ss := db.InitTestDB(t)
	quotaStore := sqlStore{
		db: ss,
	}

	t.Run("quota deleted", func(t *testing.T) {
		ctx := quota.FromContext(context.Background(), &quota.TargetToSrv{})
		err := quotaStore.DeleteByUser(ctx, 1)
		require.NoError(t, err)
	})
}
