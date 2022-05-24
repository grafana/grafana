//go:build integration
// +build integration

package sqlstore

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/models"
	"github.com/stretchr/testify/require"
)

func TestIntegrationGetDBHealthQuery(t *testing.T) {
	store := InitTestDB(t)

	query := models.GetDBHealthQuery{}
	err := store.GetDBHealthQuery(context.Background(), &query)
	require.NoError(t, err)
}
