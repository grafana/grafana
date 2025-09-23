package manager

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/services/accesscontrol/actest"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/serviceaccounts"
)

func Test_UsageStats(t *testing.T) {
	acSvc := actest.FakeService{}
	pSvc := actest.FakePermissionsService{}
	storeMock := newServiceAccountStoreFake()
	svc := ServiceAccountsService{
		acService:          acSvc,
		permissions:        &pSvc,
		store:              storeMock,
		log:                log.NewNopLogger(),
		secretScanService:  &SecretsCheckerFake{},
		secretScanEnabled:  true,
		secretScanInterval: 5,
	}
	err := svc.DeleteServiceAccount(context.Background(), 1, 1)
	require.NoError(t, err)

	storeMock.ExpectedStats = &serviceaccounts.Stats{
		ServiceAccounts:           1,
		ServiceAccountsWithNoRole: 1,
		Tokens:                    1,
		ForcedExpiryEnabled:       false,
	}
	stats, err := svc.getUsageMetrics(context.Background())
	require.NoError(t, err)

	assert.Len(t, stats, 5, stats)
	assert.Equal(t, int64(1), stats["stats.serviceaccounts.count"].(int64))
	assert.Equal(t, int64(1), stats["stats.serviceaccounts.role_none.count"].(int64))
	assert.Equal(t, int64(1), stats["stats.serviceaccounts.tokens.count"].(int64))
	assert.Equal(t, int64(1), stats["stats.serviceaccounts.secret_scan.enabled.count"].(int64))
	assert.Equal(t, int64(0), stats["stats.serviceaccounts.forced_expiry_enabled.count"].(int64))
}
