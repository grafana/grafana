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
	storeMock := &tests.ServiceAccountMock{Calls: tests.Calls{}, Stats: &serviceaccounts.Stats{
		ServiceAccounts: 1,
		Tokens:          1,
	}}
	/*
		how to create this test

		make a mock of the ServiceAccountService?
		make a real ServiceAccountService?
		We really only want to be able to see that the usageStats act as expected

		So maybe we should only mock the ServiceAccountService and add method getUsageMetrics (which should return a map[]string) to it?
	*/
	svc := ServiceAccountsService{secretScanEnabled: true}
	err := svc.DeleteServiceAccount(context.Background(), 1, 1)
	require.NoError(t, err)
	assert.Len(t, storeMock.Calls.DeleteServiceAccount, 1)

	stats, err := svc.getUsageMetrics(context.Background())
	require.NoError(t, err)

	assert.Equal(t, int64(1), stats["stats.serviceaccounts.count"].(int64))
	assert.Equal(t, int64(1), stats["stats.serviceaccounts.tokens.count"].(int64))
	assert.Equal(t, int64(1), stats["stats.serviceaccounts.secret_scan.enabled.count"].(int64))
}
