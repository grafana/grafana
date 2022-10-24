package manager

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/services/serviceaccounts"
	"github.com/grafana/grafana/pkg/services/serviceaccounts/tests"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func Test_UsageStats(t *testing.T) {
	storeMock := &tests.ServiceAccountsStoreMock{Calls: tests.Calls{}, Stats: &serviceaccounts.Stats{
		ServiceAccounts: 1,
		Tokens:          1,
	}}
	svc := ServiceAccountsService{store: storeMock}
	err := svc.DeleteServiceAccount(context.Background(), 1, 1)
	require.NoError(t, err)
	assert.Len(t, storeMock.Calls.DeleteServiceAccount, 1)

	stats, err := svc.getUsageMetrics(context.Background())
	require.NoError(t, err)

	assert.Equal(t, int64(1), stats["stats.serviceaccounts.count"].(int64))
	assert.Equal(t, int64(1), stats["stats.serviceaccounts.tokens.count"].(int64))
}
