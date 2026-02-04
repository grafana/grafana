package app

import (
	"context"

	"github.com/grafana/grafana-app-sdk/app"
)

// AnnotationConfig is the app-specific config for the annotation app. The
// registry can pass a TagHandler implementation here to wire the /tags
// resource route into the app without importing registry types.
type AnnotationConfig struct {
	// TagHandler is the handler function for the GET /tags custom route.
	// The function signature matches app.CustomRouteHandler from the app-sdk.
	TagHandler func(ctx context.Context, writer app.CustomRouteResponseWriter, request *app.CustomRouteRequest) error
}
