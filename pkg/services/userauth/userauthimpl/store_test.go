package userauthimpl

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/stretchr/testify/require"
)

func TestIntegrationUserAuthDataAccess(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	ss := sqlstore.InitTestDB(t)
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
