package pluginchecker

import (
	"testing"

	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/assert"
)

func TestIsPreinstalled(t *testing.T) {
	cfg := &setting.Cfg{
		PreinstallPluginsAsync: []setting.InstallPlugin{
			{ID: "plugin1"},
			{ID: "plugin2"},
		},
	}
	preinstall := ProvidePreinstall(cfg)

	assert.True(t, preinstall.IsPreinstalled("plugin1"))
	assert.True(t, preinstall.IsPreinstalled("plugin2"))
	assert.False(t, preinstall.IsPreinstalled("plugin3"))
}

func TestIsPinned(t *testing.T) {
	cfg := &setting.Cfg{
		PreinstallPluginsAsync: []setting.InstallPlugin{
			{ID: "plugin1", Version: "1.0.0"},
			{ID: "plugin2"},
		},
	}
	preinstall := ProvidePreinstall(cfg)

	assert.True(t, preinstall.IsPinned("plugin1"))
	assert.False(t, preinstall.IsPinned("plugin2"))
	assert.False(t, preinstall.IsPinned("plugin3"))
}
