package sandbox

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/assert"
)

func TestService_Plugins(t *testing.T) {
	cfg := &setting.Cfg{
		EnableFrontendSandboxForPlugins: []string{"plugin1", "plugin2"},
	}
	service := ProvideService(setting.ProvideService(cfg))

	plugins, err := service.Plugins(context.Background())
	assert.NoError(t, err)
	assert.Equal(t, []string{"plugin1", "plugin2"}, plugins)
}
