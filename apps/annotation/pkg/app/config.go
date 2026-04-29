package app

import (
	"context"

	"github.com/grafana/grafana-app-sdk/app"
)

// AnnotationConfig is the app-specific config for the annotation app. The
// registry can pass handler implementations here to wire custom resource
// routes into the app without importing registry types.
// Function signatures must match app.CustomRouteHandler from the app-sdk.
type AnnotationConfig struct {
	// TagHandler is the handler function for the GET /tags custom route.
	TagHandler func(ctx context.Context, writer app.CustomRouteResponseWriter, request *app.CustomRouteRequest) error
	// SearchHandler is the handler function for the GET /search custom route.
	SearchHandler func(ctx context.Context, writer app.CustomRouteResponseWriter, request *app.CustomRouteRequest) error
}
