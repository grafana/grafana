package v1alpha1

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"

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
		Group:   "demomanifestapp.ext.grafana.app",
		Version: "v1alpha1",
	}, defaultNamespace)
	if err != nil {
		return nil, err
	}
	return NewCustomRouteClient(client), nil
}

type ListManifestsRequest struct {
	Params  ListManifestsRequestParams
	Headers http.Header
}

func (c *CustomRouteClient) ListManifests(ctx context.Context, request ListManifestsRequest) (*ListManifestsResponse, error) {
	params := url.Values{}
	resp, err := c.ClusteredRequest(ctx, resource.CustomRouteRequestOptions{
		Path:    "/_manifests",
		Verb:    "GET",
		Query:   params,
		Headers: request.Headers,
	})
	if err != nil {
		return nil, err
	}
	cast := ListManifestsResponse{}
	err = json.Unmarshal(resp, &cast)
	if err != nil {
		return nil, fmt.Errorf("unable to unmarshal response bytes into ListManifestsResponse: %w", err)
	}
	return &cast, nil
}
