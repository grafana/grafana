package app

import (
	"context"
	"encoding/json"
	"fmt"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana/apps/live/pkg/apis/live/v1alpha1"
)

// GetSomethingHandler handles requests for the GET /something resource route
func GetSomethingHandler(ctx context.Context, writer app.CustomRouteResponseWriter, request *app.CustomRouteRequest) error {
	message := "This is a namespaced route"
	if request.URL.Query().Has("message") {
		message = request.URL.Query().Get("message")
	}
	return json.NewEncoder(writer).Encode(v1alpha1.GetSomething{
		TypeMeta: metav1.TypeMeta{
			APIVersion: fmt.Sprintf("%s/%s", v1alpha1.APIGroup, v1alpha1.APIVersion),
		},
		GetSomethingBody: v1alpha1.GetSomethingBody{
			Namespace: request.ResourceIdentifier.Namespace,
			Message:   message,
		},
	})
}
