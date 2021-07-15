// Package backendplugin contains backend plugin related logic.
package backendplugin

import (
	"context"

	"github.com/grafana/grafana/pkg/infra/log"
)

// PluginFactoryFunc is a function type for creating a Plugin.
type PluginFactoryFunc func(pluginID string, logger log.Logger, env []string) (Plugin, error)

type contextKey struct{}

var providerIDContextKey = contextKey{}

func WithProviderID(ctx context.Context, providerID string) context.Context {
	return context.WithValue(ctx, providerIDContextKey, providerID)
}

func ProviderIDFromContext(ctx context.Context) (string, error) {
	val := ctx.Value(providerIDContextKey)
	if val != nil {
		return val.(string), nil
	}

	return "", nil
}
