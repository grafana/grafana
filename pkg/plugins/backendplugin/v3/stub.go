package v3

import "context"

// ClientV3 is currently a stub implementation used wire dependencies
// The interface will evolve
// V2 and V3 both share the same distribution+packaging methods, however in V3, we:
// 1. All implementations are required to be multi-tenant safe
// 2. No requests contain pluginContext (the root plugin configuration)
// 3. The v3 client does not include the expansive middleware that exists for v2
type ClientV3 interface {
	// Return an error when requests to this implementation will fail for setup reasons
	IsHealthy(ctx context.Context) error
}
