package v3

import (
	"context"

	pluginv3 "github.com/grafana/grafana-app-sdk/plugin/genproto/grafana/plugin/v3"
)

// ClientV3 provides the services negotiated through plugin protocol v3.
// It will evolve as the v3 interface gets exercised with real usage.
//
// V2 and V3 share the same distribution+packaging methods, but in V3:
// 1. All implementations are required to be multi-tenant safe
// 2. No requests contain pluginContext (the root plugin configuration)
// 3. The v3 client does not include the expansive middleware that exists for v2
type ClientV3 interface {
	pluginv3.AdmissionServiceClient
	pluginv3.ConversionServiceClient
	pluginv3.RouteServiceClient
}

// ClientV3Loader returns a plugin's v3 client once the registry has loaded it.
type ClientV3Loader interface {
	ClientV3(ctx context.Context, pluginID string) (ClientV3, bool)
}
