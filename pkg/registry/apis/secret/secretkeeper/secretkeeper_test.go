package secretkeeper

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/registry/apis/secret/secretkeeper/sqlkeeper"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tests/testsuite"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func Test_OSSKeeperService_GetKeepers(t *testing.T) {
	cfg := setting.NewCfg()
	keeperService, err := setupTestService(t, cfg)
	require.NoError(t, err)

	t.Run("KeeperForConfig should return the system keeper", func(t *testing.T) {
		keeper, err := keeperService.KeeperForConfig(nil)
		require.NoError(t, err)

		assert.NotNil(t, keeper)
		assert.IsType(t, &sqlkeeper.SQLKeeper{}, keeper)
	})
}

func setupTestService(t *testing.T, cfg *setting.Cfg) (*OSSKeeperService, error) {
	// Initialize the keeper service
	keeperService, err := ProvideService(tracing.InitializeTracerForTest(), nil, nil)

	return keeperService, err
}
