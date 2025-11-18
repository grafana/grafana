package setting

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gopkg.in/ini.v1"
)

func TestReadQuotaSettings(t *testing.T) {
	t.Run("should use custom values when section has overrides", func(t *testing.T) {
		iniFile := `
[quota]
enabled = true

# Org quotas
org_user = 20
org_data_source = 30
org_dashboard = 40
org_api_key = 50
org_alert_rule = 200

# User quotas
user_org = 5

# Global quotas
global_user = 1000
global_org = 500
global_data_source = 2000
global_dashboard = 3000
global_api_key = 100
global_session = 10000
global_file = 500
global_alert_rule = 5000
global_correlations = 250
`
		f, err := ini.Load([]byte(iniFile))
		require.NoError(t, err)

		quota := ReadQuotaSettings(f)

		// Enabled should be true
		assert.True(t, quota.Enabled)

		// Org quotas should have custom values
		assert.Equal(t, int64(20), quota.Org.User)
		assert.Equal(t, int64(30), quota.Org.DataSource)
		assert.Equal(t, int64(40), quota.Org.Dashboard)
		assert.Equal(t, int64(50), quota.Org.ApiKey)
		assert.Equal(t, int64(200), quota.Org.AlertRule)

		// User quotas should have custom values
		assert.Equal(t, int64(5), quota.User.Org)

		// Global quotas should have custom values
		assert.Equal(t, int64(1000), quota.Global.User)
		assert.Equal(t, int64(500), quota.Global.Org)
		assert.Equal(t, int64(2000), quota.Global.DataSource)
		assert.Equal(t, int64(3000), quota.Global.Dashboard)
		assert.Equal(t, int64(100), quota.Global.ApiKey)
		assert.Equal(t, int64(10000), quota.Global.Session)
		assert.Equal(t, int64(500), quota.Global.File)
		assert.Equal(t, int64(5000), quota.Global.AlertRule)
		assert.Equal(t, int64(250), quota.Global.Correlations)
	})

	t.Run("should use default values when ini is empty", func(t *testing.T) {
		f := ini.Empty()
		quota := ReadQuotaSettings(f)

		assertDefaults(t, quota)
	})

	t.Run("should use default values when section exists with no values", func(t *testing.T) {
		f := ini.Empty()
		_, err := f.NewSection("quota")
		require.NoError(t, err)

		quota := ReadQuotaSettings(f)

		assertDefaults(t, quota)
	})
}

func assertDefaults(t *testing.T, quota QuotaSettings) {
	t.Helper()

	// Enabled should be false by default
	assert.False(t, quota.Enabled)

	// Org quotas should have default values
	assert.Equal(t, int64(10), quota.Org.User)
	assert.Equal(t, int64(10), quota.Org.DataSource)
	assert.Equal(t, int64(10), quota.Org.Dashboard)
	assert.Equal(t, int64(10), quota.Org.ApiKey)
	assert.Equal(t, int64(100), quota.Org.AlertRule)

	// User quotas should have default values
	assert.Equal(t, int64(10), quota.User.Org)

	// Global quotas should have default values (-1 means unlimited)
	assert.Equal(t, int64(-1), quota.Global.User)
	assert.Equal(t, int64(-1), quota.Global.Org)
	assert.Equal(t, int64(-1), quota.Global.DataSource)
	assert.Equal(t, int64(-1), quota.Global.Dashboard)
	assert.Equal(t, int64(-1), quota.Global.ApiKey)
	assert.Equal(t, int64(-1), quota.Global.Session)
	assert.Equal(t, int64(-1), quota.Global.File)
	assert.Equal(t, int64(-1), quota.Global.AlertRule)
	assert.Equal(t, int64(-1), quota.Global.Correlations)
}
