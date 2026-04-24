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
		Group:   "iam.grafana.app",
		Version: "v0alpha1",
	}, defaultNamespace)
	if err != nil {
		return nil, err
	}
	return NewCustomRouteClient(client), nil
}

type GetSearchTeamsRequest struct {
	Params  GetSearchTeamsRequestParams
	Headers http.Header
}

func (c *CustomRouteClient) GetSearchTeams(ctx context.Context, namespace string, request GetSearchTeamsRequest) (*GetSearchTeamsResponse, error) {
	params := url.Values{}
	resp, err := c.NamespacedRequest(ctx, namespace, resource.CustomRouteRequestOptions{
		Path:    "/searchTeams",
		Verb:    "GET",
		Query:   params,
		Headers: request.Headers,
	})
	if err != nil {
		return nil, err
	}
	cast := GetSearchTeamsResponse{}
	err = json.Unmarshal(resp, &cast)
	if err != nil {
		return nil, fmt.Errorf("unable to unmarshal response bytes into GetSearchTeamsResponse: %w", err)
	}
	return &cast, nil
}

type GetSearchUsersRequest struct {
	Params  GetSearchUsersRequestParams
	Headers http.Header
}

func (c *CustomRouteClient) GetSearchUsers(ctx context.Context, namespace string, request GetSearchUsersRequest) (*GetSearchUsersResponse, error) {
	params := url.Values{}
	resp, err := c.NamespacedRequest(ctx, namespace, resource.CustomRouteRequestOptions{
		Path:    "/searchUsers",
		Verb:    "GET",
		Query:   params,
		Headers: request.Headers,
	})
	if err != nil {
		return nil, err
	}
	cast := GetSearchUsersResponse{}
	err = json.Unmarshal(resp, &cast)
	if err != nil {
		return nil, fmt.Errorf("unable to unmarshal response bytes into GetSearchUsersResponse: %w", err)
	}
	return &cast, nil
}
