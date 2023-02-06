package login

import (
	"testing"

	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/assert"
)

func TestIsExternallySynced(t *testing.T) {
	t.Run("Google", func(t *testing.T) {
		cfg := setting.NewCfg()
		cfg.GoogleSkipOrgRoleSync = true
		assert.False(t, IsExternallySynced(cfg, "Google"))
	})
	t.Run("Okta", func(t *testing.T) {
		cfg := setting.NewCfg()
		cfg.OktaSkipOrgRoleSync = true
		assert.False(t, IsExternallySynced(cfg, "Okta"))
	})
	t.Run("Other", func(t *testing.T) {
		cfg := setting.NewCfg()
		assert.True(t, IsExternallySynced(cfg, "Other"))
	})
}
