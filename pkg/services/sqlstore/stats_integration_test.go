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
	InitTestDB(t)

	query := models.GetAdminStatsQuery{}
	err := GetAdminStats(context.Background(), &query)
	require.NoError(t, err)
}
