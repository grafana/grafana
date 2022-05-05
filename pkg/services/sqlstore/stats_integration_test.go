//go:build integration
// +build integration

package sqlstore

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/models"
	"github.com/stretchr/testify/require"
)

func TestIntegration_GetAdminStats(t *testing.T) {
	sqlStore := InitTestDB(t)

	query := models.GetAdminStatsQuery{}
	err := sqlStore.GetAdminStats(context.Background(), &query)
	require.NoError(t, err)
}
