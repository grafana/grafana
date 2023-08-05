package cleanup

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/setting"
)

func TestCleanUpTmpFiles(t *testing.T) {
	cfg := setting.Cfg{}
	cfg.TempDataLifetime, _ = time.ParseDuration("24h")
	service := CleanUpService{
		Cfg: &cfg,
	}
	now := time.Now()
	secondAgo := now.Add(-time.Second)
	twoDaysAgo := now.Add(-time.Second * 3600 * 24 * 2)
	weekAgo := now.Add(-time.Second * 3600 * 24 * 7)
	t.Run("Should not cleanup recent files", func(t *testing.T) {
		require.False(t, service.shouldCleanupTempFile(secondAgo, now))
	})
	t.Run("Should cleanup older files", func(t *testing.T) {
		require.True(t, service.shouldCleanupTempFile(twoDaysAgo, now))
	})

	t.Run("After increasing temporary files lifetime, older files should be kept", func(t *testing.T) {
		cfg.TempDataLifetime, _ = time.ParseDuration("1000h")
		require.False(t, service.shouldCleanupTempFile(weekAgo, now))
	})

	t.Run("If lifetime is 0, files should never be cleaned up", func(t *testing.T) {
		cfg.TempDataLifetime = 0
		require.False(t, service.shouldCleanupTempFile(weekAgo, now))
	})
}
