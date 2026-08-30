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
		Group:   "example.grafana.app",
		Version: "v1alpha1",
	}, defaultNamespace)
	if err != nil {
		return nil, err
	}
	return NewCustomRouteClient(client), nil
}

type GetSomethingRequest struct {
	Params  GetSomethingRequestParams
	Headers http.Header
}

func (c *CustomRouteClient) GetSomething(ctx context.Context, namespace string, request GetSomethingRequest) (*GetSomethingResponse, error) {
	params := url.Values{}
	resp, err := c.NamespacedRequest(ctx, namespace, resource.CustomRouteRequestOptions{
		Path:    "/something",
		Verb:    "GET",
		Query:   params,
		Headers: request.Headers,
	})
	if err != nil {
		return nil, err
	}
	cast := GetSomethingResponse{}
	err = json.Unmarshal(resp, &cast)
	if err != nil {
		return nil, fmt.Errorf("unable to unmarshal response bytes into GetSomethingResponse: %w", err)
	}
	return &cast, nil
}

type GetOtherRequest struct {
	Params  GetOtherRequestParams
	Headers http.Header
}

func (c *CustomRouteClient) GetOther(ctx context.Context, request GetOtherRequest) (*GetOtherResponse, error) {
	params := url.Values{}
	resp, err := c.ClusteredRequest(ctx, resource.CustomRouteRequestOptions{
		Path:    "/other",
		Verb:    "GET",
		Query:   params,
		Headers: request.Headers,
	})
	if err != nil {
		return nil, err
	}
	cast := GetOtherResponse{}
	err = json.Unmarshal(resp, &cast)
	if err != nil {
		return nil, fmt.Errorf("unable to unmarshal response bytes into GetOtherResponse: %w", err)
	}
	return &cast, nil
}
