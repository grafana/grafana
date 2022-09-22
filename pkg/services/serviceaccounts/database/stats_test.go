package database

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/components/apikeygen"
	"github.com/grafana/grafana/pkg/services/serviceaccounts"
	"github.com/grafana/grafana/pkg/services/serviceaccounts/tests"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestStore_UsageStats(t *testing.T) {
	saToCreate := tests.TestUser{Login: "servicetestwithTeam@admin", IsServiceAccount: true}
	db, store := setupTestDatabase(t)
	sa := tests.SetupUserServiceAccount(t, db, saToCreate)

	keyName := t.Name()
	key, err := apikeygen.New(sa.OrgID, keyName)
	require.NoError(t, err)

	cmd := serviceaccounts.AddServiceAccountTokenCommand{
		Name:          keyName,
		OrgId:         sa.OrgID,
		Key:           key.HashedKey,
		SecondsToLive: 0,
	}

	err = store.AddServiceAccountToken(context.Background(), sa.ID, &cmd)
	require.NoError(t, err)

	stats, err := store.GetUsageMetrics(context.Background())
	require.NoError(t, err)

	assert.Equal(t, int64(1), stats.ServiceAccounts)
	assert.Equal(t, int64(1), stats.Tokens)
}
