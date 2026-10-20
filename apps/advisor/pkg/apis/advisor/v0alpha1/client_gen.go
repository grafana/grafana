package v0alpha1

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
		Group:   "advisor.grafana.app",
		Version: "v0alpha1",
	}, defaultNamespace)
	if err != nil {
		return nil, err
	}
	return NewCustomRouteClient(client), nil
}

type CreateRegisterRequest struct {
	Headers http.Header
}

func (c *CustomRouteClient) CreateRegister(ctx context.Context, namespace string, request CreateRegisterRequest) (*CreateRegisterResponse, error) {
	resp, err := c.NamespacedRequest(ctx, namespace, resource.CustomRouteRequestOptions{
		Path:    "/register",
		Verb:    "POST",
		Headers: request.Headers,
	})
	if err != nil {
		return nil, err
	}
	cast := CreateRegisterResponse{}
	err = json.Unmarshal(resp, &cast)
	if err != nil {
		return nil, fmt.Errorf("unable to unmarshal response bytes into CreateRegisterResponse: %w", err)
	}
	return &cast, nil
}

type GetTranslationsRequest struct {
	Params  GetTranslationsRequestParams
	Headers http.Header
}

func (c *CustomRouteClient) GetTranslations(ctx context.Context, namespace string, request GetTranslationsRequest) (*GetTranslationsResponse, error) {
	params := url.Values{}
	params.Set("lang", fmt.Sprintf("%v", request.Params.Lang))
	resp, err := c.NamespacedRequest(ctx, namespace, resource.CustomRouteRequestOptions{
		Path:    "/translations",
		Verb:    "GET",
		Query:   params,
		Headers: request.Headers,
	})
	if err != nil {
		return nil, err
	}
	cast := GetTranslationsResponse{}
	err = json.Unmarshal(resp, &cast)
	if err != nil {
		return nil, fmt.Errorf("unable to unmarshal response bytes into GetTranslationsResponse: %w", err)
	}
	return &cast, nil
}
