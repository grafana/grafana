package access

import "context"

type runAsGrafanaCtxKey struct{}

// RunAsGrafana sets a flag in the context to indicate that the current operation is running as Grafana and not as a user.
// This allows unrestricted access to the database.
func RunAsGrafana(ctx context.Context) context.Context {
	return context.WithValue(ctx, runAsGrafanaCtxKey{}, true)
}

func IsRunningAsGrafana(ctx context.Context) bool {
	v, ok := ctx.Value(&runAsGrafanaCtxKey{}).(bool)
	return ok && v
}
