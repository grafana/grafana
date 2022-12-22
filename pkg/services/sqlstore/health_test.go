package sqlstore

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/models"
)

func TestIntegrationGetDBHealthQuery(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	store := InitTestDB(t)

	query := models.GetDBHealthQuery{}
	err := store.GetDBHealthQuery(context.Background(), &query)
	require.NoError(t, err)
}
