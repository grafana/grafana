package setting

import (
	"path/filepath"
	"testing"

	"github.com/grafana/grafana/pkg/infra/log/logtest"

	"github.com/stretchr/testify/require"
)

func TestSessionSettings(t *testing.T) {
	skipStaticRootValidation = true

	t.Run("Reading session should log error ", func(t *testing.T) {
		cfg := NewCfg()
		homePath := "../../"

		logger := &logtest.Fake{}
		cfg.Logger = logger

		err := cfg.Load(CommandLineArgs{
			HomePath: homePath,
			Config:   filepath.Join(homePath, "pkg/setting/testdata/session.ini"),
		})
		require.Nil(t, err)

		require.Equal(t, 1, logger.WarnLogs.Calls)
		require.Greater(t, len(logger.WarnLogs.Message), 0)
	})
}
