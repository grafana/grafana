package v3

import (
	"context"

	pluginv3 "github.com/grafana/grafana-app-sdk/plugin/genproto/grafana/plugin/v3"
	appgrpcplugin "github.com/grafana/grafana-app-sdk/plugin/grpcplugin"
)

// ClientV3 implements all required functions in the V3 interface.
// This is currently a stub, and will evolve as the V3 interface get exercised with real usage
//
// V2 and V3 both share the same distribution+packaging methods, however in V3, we:
// 1. All implementations are required to be multi-tenant safe
// 2. No requests contain pluginContext (the root plugin configuration)
// 3. The v3 client does not include the expansive middleware that exists for v2
type ClientV3 interface {
	pluginv3.AdmissionServiceClient
	pluginv3.ConversionServiceClient
	pluginv3.RouteServiceClient
}

type sdkClient struct {
	*appgrpcplugin.ClientV3
}

// NewClientFromSDK adapts the app SDK's negotiated clients to Grafana's V3 client interface.
func NewClientFromSDK(client *appgrpcplugin.ClientV3) ClientV3 {
	return &sdkClient{ClientV3: client}
}

func (*sdkClient) IsHealthy(context.Context) error {
	return nil
}

// ClientV3Loader looks up the ClientV3 for a plugin by ID, waiting for the plugin
// registry to finish loading if necessary.
type ClientV3Loader interface {
	ClientV3(ctx context.Context, pluginID string) (ClientV3, bool)
}
