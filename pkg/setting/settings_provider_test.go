package setting

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestSettingsProvider(t *testing.T) {
	cfg := NewCfg()
	settingsProvider := ProvideService(cfg)

	cfg.AWSAssumeRoleEnabled = true
	assert.True(t, settingsProvider.Get().AWSAssumeRoleEnabled)
}
