package setting

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gopkg.in/ini.v1"
)

func TestLoadAnnotationAppPlatformSettings(t *testing.T) {
	t.Run("defaults", func(t *testing.T) {
		f := ini.Empty()
		settings := loadAnnotationAppPlatformSettings(f)

		assert.Equal(t, false, settings.Enabled)
		assert.Equal(t, "legacy-sql", settings.StoreBackend)
		assert.Equal(t, "off", settings.APIMigrationPhase)
		assert.Equal(t, "", settings.AppPlatformURL)
		assert.Equal(t, false, settings.EnableLegacyID)
	})

	t.Run("custom values", func(t *testing.T) {
		f := ini.Empty()
		sec, err := f.NewSection("annotations.app_platform")
		require.NoError(t, err)

		_, _ = sec.NewKey("enabled", "true")
		_, _ = sec.NewKey("store_backend", "postgres")
		_, _ = sec.NewKey("api_migration_phase", "proxy-writes")
		_, _ = sec.NewKey("app_platform_url", "http://annotations-app:8080")
		_, _ = sec.NewKey("enable_legacy_id", "true")

		settings := loadAnnotationAppPlatformSettings(f)

		assert.Equal(t, true, settings.Enabled)
		assert.Equal(t, "postgres", settings.StoreBackend)
		assert.Equal(t, "proxy-writes", settings.APIMigrationPhase)
		assert.Equal(t, "http://annotations-app:8080", settings.AppPlatformURL)
		assert.Equal(t, true, settings.EnableLegacyID)
	})

	t.Run("proxy-all phase", func(t *testing.T) {
		f := ini.Empty()
		sec, err := f.NewSection("annotations.app_platform")
		require.NoError(t, err)

		_, _ = sec.NewKey("api_migration_phase", "proxy-all")
		_, _ = sec.NewKey("app_platform_url", "http://localhost:9090")

		settings := loadAnnotationAppPlatformSettings(f)

		assert.Equal(t, "proxy-all", settings.APIMigrationPhase)
		assert.Equal(t, "http://localhost:9090", settings.AppPlatformURL)
	})
}
