package v1

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/grafana/grafana-app-sdk/resource"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

type CustomRouteClient struct {
	resource.CustomRouteClient
}

func NewCustomRouteClient(client resource.CustomRouteClient) *CustomRouteClient {
	return &CustomRouteClient{client}
}

func NewCustomRouteClientFromGenerator(generator resource.ClientGenerator, defaultNamespace string) (*CustomRouteClient, error) {
	client, err := generator.GetCustomRouteClient(schema.GroupVersion{
		Group:   "preferences.grafana.app",
		Version: "v1",
	}, defaultNamespace)
	if err != nil {
		return nil, err
	}
	return NewCustomRouteClient(client), nil
}

type MergedPreferencesRequest struct {
	Headers http.Header
}

func (c *CustomRouteClient) MergedPreferences(ctx context.Context, namespace string, request MergedPreferencesRequest) (*Preferences, error) {
	resp, err := c.NamespacedRequest(ctx, namespace, resource.CustomRouteRequestOptions{
		Path:    "/preferences/merged",
		Verb:    "GET",
		Headers: request.Headers,
	})
	if err != nil {
		return nil, err
	}
	cast := Preferences{}
	err = json.Unmarshal(resp, &cast)
	if err != nil {
		return nil, fmt.Errorf("unable to unmarshal response bytes into Preferences: %w", err)
	}
	return &cast, nil
}
