package v3

import "context"

// ClientV3 implements all required functions in the V3 interface.
// This is currently a stub, and will evolve as the V3 interface get exercised with real usage
//
// V2 and V3 both share the same distribution+packaging methods, however in V3, we:
// 1. All implementations are required to be multi-tenant safe
// 2. No requests contain pluginContext (the root plugin configuration)
// 3. The v3 client does not include the expansive middleware that exists for v2
type ClientV3 interface {
	// Return an error when requests to this implementation will fail for setup reasons
	IsHealthy(ctx context.Context) error
}

// ClientV3Loader looks up the ClientV3 for a plugin by ID, waiting for the plugin
// registry to finish loading if necessary.
type ClientV3Loader interface {
	ClientV3(ctx context.Context, pluginID string) (ClientV3, bool)
}
