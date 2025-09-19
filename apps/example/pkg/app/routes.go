package app

import (
	"context"
	"encoding/json"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana/apps/example/pkg/apis/example/v1alpha1"
)

// ExampleGetFooHandler handles requests for the GET /foo subresource route
func ExampleGetFooHandler(ctx context.Context, writer app.CustomRouteResponseWriter, request *app.CustomRouteRequest) error {
	message := "Hello, world!"
	return json.NewEncoder(writer).Encode(v1alpha1.GetFoo{
		Message: message,
	})
}

// GetSomethingHandler handles requests for the GET /something resource route
func GetSomethingHandler(ctx context.Context, writer app.CustomRouteResponseWriter, request *app.CustomRouteRequest) error {
	message := "This is a namespaced route"
	if request.URL.Query().Has("message") {
		message = request.URL.Query().Get("message")
	}
	return json.NewEncoder(writer).Encode(v1alpha1.GetSomething{
		Namespace: request.ResourceIdentifier.Namespace,
		Message:   message,
	})
}

// GetOtherHandler handles requests for the GET /other cluster-scoped resource route
func GetOtherHandler(ctx context.Context, writer app.CustomRouteResponseWriter, request *app.CustomRouteRequest) error {
	message := "This is a namespaced route"
	if request.URL.Query().Has("message") {
		message = request.URL.Query().Get("message")
	}
	return json.NewEncoder(writer).Encode(v1alpha1.GetOther{
		Message: message,
	})
}
