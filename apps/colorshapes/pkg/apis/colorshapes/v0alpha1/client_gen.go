package v0alpha1

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
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
		Group:   "colorshapes.grafana.app",
		Version: "v0alpha1",
	}, defaultNamespace)
	if err != nil {
		return nil, err
	}
	return NewCustomRouteClient(client), nil
}

type ListHitsRequest struct {
	Params  ListHitsRequestParams
	Headers http.Header
}

func (c *CustomRouteClient) ListHits(ctx context.Context, namespace string, request ListHitsRequest) (*ListHitsResponse, error) {
	params := url.Values{}
	resp, err := c.NamespacedRequest(ctx, namespace, resource.CustomRouteRequestOptions{
		Path:    "/hits",
		Verb:    "GET",
		Query:   params,
		Headers: request.Headers,
	})
	if err != nil {
		return nil, err
	}
	cast := ListHitsResponse{}
	err = json.Unmarshal(resp, &cast)
	if err != nil {
		return nil, fmt.Errorf("unable to unmarshal response bytes into ListHitsResponse: %w", err)
	}
	return &cast, nil
}

type CreateHitRequest struct {
	Body    CreateHitRequestBody
	Headers http.Header
}

func (c *CustomRouteClient) CreateHit(ctx context.Context, namespace string, request CreateHitRequest) (*CreateHitResponse, error) {
	body, err := json.Marshal(request.Body)
	if err != nil {
		return nil, fmt.Errorf("unable to marshal body to JSON: %w", err)
	}
	resp, err := c.NamespacedRequest(ctx, namespace, resource.CustomRouteRequestOptions{
		Path:    "/hits",
		Verb:    "POST",
		Body:    io.NopCloser(bytes.NewReader(body)),
		Headers: request.Headers,
	})
	if err != nil {
		return nil, err
	}
	cast := CreateHitResponse{}
	err = json.Unmarshal(resp, &cast)
	if err != nil {
		return nil, fmt.Errorf("unable to unmarshal response bytes into CreateHitResponse: %w", err)
	}
	return &cast, nil
}
