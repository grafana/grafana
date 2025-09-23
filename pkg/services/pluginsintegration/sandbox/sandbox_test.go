package sandbox

import (
	"testing"

	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/assert"
)

func TestService_Plugins(t *testing.T) {
	cfg := &setting.Cfg{
		EnableFrontendSandboxForPlugins: []string{"plugin1", "plugin2"},
	}
	service := ProvideService(cfg)

	plugins, err := service.Plugins()
	assert.NoError(t, err)
	assert.Equal(t, []string{"plugin1", "plugin2"}, plugins)
}
