package userauthimpl

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
)

func TestIntegrationUserAuthDataAccess(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	ss := db.InitTestDB(t)
	userAuthStore := sqlStore{
		db: ss,
	}

	t.Run("delete user auth", func(t *testing.T) {
		err := userAuthStore.Delete(context.Background(), 1)
		require.NoError(t, err)
	})

	t.Run("delete user auth token", func(t *testing.T) {
		err := userAuthStore.DeleteToken(context.Background(), 1)
		require.NoError(t, err)
	})
}
