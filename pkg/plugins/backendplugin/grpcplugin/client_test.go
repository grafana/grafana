package grpcplugin

import (
	"testing"

	"github.com/stretchr/testify/require"

	pluginv2 "github.com/grafana/grafana-plugin-sdk-go/backend/grpcplugin"
)

func TestPluginSetIncludesV3Services(t *testing.T) {
	services := pluginSet[pluginv2.ProtocolVersion]

	for _, name := range []string{"v3-admit", "v3-convert", "v3-route"} {
		require.Contains(t, services, name)
	}
}
