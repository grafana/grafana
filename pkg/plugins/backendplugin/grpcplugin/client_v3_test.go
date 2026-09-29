package grpcplugin

import (
	"errors"
	"testing"

	"github.com/stretchr/testify/require"

	pluginv3 "github.com/grafana/grafana-app-sdk/plugin/genproto/grafana/plugin/v3"
	pluginsdk "github.com/grafana/grafana-plugin-sdk-go/backend/grpcplugin"
)

func TestPluginSetIncludesV3Services(t *testing.T) {
	services := pluginSet[pluginsdk.ProtocolVersion]
	require.Contains(t, services, "v3-admit")
	require.Contains(t, services, "v3-convert")
	require.Contains(t, services, "v3-route")
}

func TestLoadClientV3(t *testing.T) {
	t.Run("loads the available services", func(t *testing.T) {
		protocol := &testClientProtocol{plugins: map[string]any{
			"v3-admit":   pluginv3.NewAdmissionServiceClient(nil),
			"v3-convert": pluginv3.NewConversionServiceClient(nil),
			"v3-route":   pluginv3.NewRouteServiceClient(nil),
		}}

		client := loadClientV3(protocol)

		require.NotNil(t, client)
		require.Implements(t, (*pluginv3.RouteServiceClient)(nil), client)
	})

	t.Run("keeps legacy plugins working", func(t *testing.T) {
		client := loadClientV3(&testClientProtocol{dispenseErr: errors.New("not available")})

		require.Nil(t, client)
	})
}

type testClientProtocol struct {
	plugins     map[string]any
	dispenseErr error
}

func (*testClientProtocol) Close() error { return nil }

func (c *testClientProtocol) Dispense(key string) (any, error) {
	if c.dispenseErr != nil {
		return nil, c.dispenseErr
	}
	return c.plugins[key], nil
}

func (*testClientProtocol) Ping() error { return nil }
