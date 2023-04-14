package database

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/components/satokengen"
	"github.com/grafana/grafana/pkg/services/serviceaccounts"
	"github.com/grafana/grafana/pkg/services/serviceaccounts/tests"
)

func TestIntegrationStore_UsageStats(t *testing.T) {
	saToCreate := tests.TestUser{Login: "servicetestwithTeam@admin", IsServiceAccount: true}
	db, store := setupTestDatabase(t)
	sa := tests.SetupUserServiceAccount(t, db, saToCreate)

	db.Cfg.SATokenExpirationDayLimit = 4

	keyName := t.Name()
	key, err := satokengen.New(keyName)
	require.NoError(t, err)

	cmd := serviceaccounts.AddServiceAccountTokenCommand{
		Name:          keyName,
		OrgId:         sa.OrgID,
		Key:           key.HashedKey,
		SecondsToLive: 0,
	}

	_, err = store.AddServiceAccountToken(context.Background(), sa.ID, &cmd)
	require.NoError(t, err)

	stats, err := store.GetUsageMetrics(context.Background())
	require.NoError(t, err)

	assert.Equal(t, int64(1), stats.ServiceAccounts)
	assert.Equal(t, int64(1), stats.Tokens)
	assert.Equal(t, true, stats.ForcedExpiryEnabled)
}
