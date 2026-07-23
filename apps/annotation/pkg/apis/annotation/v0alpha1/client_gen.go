package v0alpha1

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
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
		Group:   "annotation.grafana.app",
		Version: "v0alpha1",
	}, defaultNamespace)
	if err != nil {
		return nil, err
	}
	return NewCustomRouteClient(client), nil
}

type CreateGraphiteRequest struct {
	Body    CreateGraphiteRequestBody
	Headers http.Header
}

func (c *CustomRouteClient) CreateGraphite(ctx context.Context, namespace string, request CreateGraphiteRequest) (*CreateGraphiteResponse, error) {
	body, err := json.Marshal(request.Body)
	if err != nil {
		return nil, fmt.Errorf("unable to marshal body to JSON: %w", err)
	}
	resp, err := c.NamespacedRequest(ctx, namespace, resource.CustomRouteRequestOptions{
		Path:    "/graphite",
		Verb:    "POST",
		Body:    io.NopCloser(bytes.NewReader(body)),
		Headers: request.Headers,
	})
	if err != nil {
		return nil, err
	}
	cast := CreateGraphiteResponse{}
	err = json.Unmarshal(resp, &cast)
	if err != nil {
		return nil, fmt.Errorf("unable to unmarshal response bytes into CreateGraphiteResponse: %w", err)
	}
	return &cast, nil
}

type GetSearchRequest struct {
	Headers http.Header
}

func (c *CustomRouteClient) GetSearch(ctx context.Context, namespace string, request GetSearchRequest) (*GetSearchResponse, error) {
	resp, err := c.NamespacedRequest(ctx, namespace, resource.CustomRouteRequestOptions{
		Path:    "/search",
		Verb:    "GET",
		Headers: request.Headers,
	})
	if err != nil {
		return nil, err
	}
	cast := GetSearchResponse{}
	err = json.Unmarshal(resp, &cast)
	if err != nil {
		return nil, fmt.Errorf("unable to unmarshal response bytes into GetSearchResponse: %w", err)
	}
	return &cast, nil
}

type GetTagsRequest struct {
	Headers http.Header
}

func (c *CustomRouteClient) GetTags(ctx context.Context, namespace string, request GetTagsRequest) (*GetTagsResponse, error) {
	resp, err := c.NamespacedRequest(ctx, namespace, resource.CustomRouteRequestOptions{
		Path:    "/tags",
		Verb:    "GET",
		Headers: request.Headers,
	})
	if err != nil {
		return nil, err
	}
	cast := GetTagsResponse{}
	err = json.Unmarshal(resp, &cast)
	if err != nil {
		return nil, fmt.Errorf("unable to unmarshal response bytes into GetTagsResponse: %w", err)
	}
	return &cast, nil
}
