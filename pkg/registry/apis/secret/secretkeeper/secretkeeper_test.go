package secretkeeper

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/registry/apis/secret/secretkeeper/sqlkeeper"
	"github.com/grafana/grafana/pkg/setting"
)

func Test_OSSKeeperService_GetKeepers(t *testing.T) {
	cfg := setting.NewCfg()
	keeperService, err := setupTestService(t, cfg)
	require.NoError(t, err)

	t.Run("GetKeepers should return a map with a sql keeper", func(t *testing.T) {
		keeperMap, err := keeperService.GetKeepers()
		require.NoError(t, err)

		assert.NotNil(t, keeperMap)
		assert.Equal(t, 1, len(keeperMap))
		assert.IsType(t, &sqlkeeper.SQLKeeper{}, keeperMap[contracts.SQLKeeperType])
	})
}

func setupTestService(t *testing.T, cfg *setting.Cfg) (OSSKeeperService, error) {
	// Initialize the keeper service
	keeperService, err := ProvideService(tracing.InitializeTracerForTest(), nil, nil)

	return keeperService, err
}
