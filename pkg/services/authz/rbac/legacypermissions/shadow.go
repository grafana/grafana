package legacypermissions

import "context"

type permissionShadowKey struct{}

// WithPermissionShadow prevents embedded comparison calls from writing to the shared permission cache.
func WithPermissionShadow(ctx context.Context) context.Context {
	return context.WithValue(ctx, permissionShadowKey{}, true)
}

func isPermissionShadow(ctx context.Context) bool {
	shadow, _ := ctx.Value(permissionShadowKey{}).(bool)
	return shadow
}
