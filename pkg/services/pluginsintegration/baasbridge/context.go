package baasbridge

import "context"

type declaredAccessKey struct{}

// WithDeclaredAccessChecked records on a route request's ctx that a declared
// access check authorized it. Without one the operator authorizes the route
// itself, and only then is it sent the caller's access token.
//
// Deprecated: see the package documentation.
func WithDeclaredAccessChecked(ctx context.Context) context.Context {
	return context.WithValue(ctx, declaredAccessKey{}, true)
}

// DeclaredAccessChecked reports whether a declared access check authorized the
// route request in ctx.
//
// Deprecated: see the package documentation.
func DeclaredAccessChecked(ctx context.Context) bool {
	checked, _ := ctx.Value(declaredAccessKey{}).(bool)
	return checked
}
