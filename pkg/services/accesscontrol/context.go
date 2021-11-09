package accesscontrol

import (
	"context"
)

type contextKey struct{}

// ContextWithPermissions stores permissions in context
func ContextWithPermissions(ctx context.Context, permissions []*Permission) context.Context {
	return context.WithValue(ctx, contextKey{}, permissions)
}

// PermissionsFromContext extracts permissions
// TODO: Maybe error?
func PermissionsFromContext(ctx context.Context) ([]*Permission, bool) {
	permissions, ok := ctx.Value(contextKey{}).([]*Permission)
	return permissions, ok
}
