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
		Group:   "rules.alerting.grafana.app",
		Version: "v0alpha1",
	}, defaultNamespace)
	if err != nil {
		return nil, err
	}
	return NewCustomRouteClient(client), nil
}

type GetSearchAlertRulesRequest struct {
	Params  GetSearchAlertRulesRequestParams
	Headers http.Header
}

func (c *CustomRouteClient) GetSearchAlertRules(ctx context.Context, namespace string, request GetSearchAlertRulesRequest) (*GetSearchAlertRulesResponse, error) {
	params := url.Values{}
	resp, err := c.NamespacedRequest(ctx, namespace, resource.CustomRouteRequestOptions{
		Path:    "/search/alertrules",
		Verb:    "GET",
		Query:   params,
		Headers: request.Headers,
	})
	if err != nil {
		return nil, err
	}
	cast := GetSearchAlertRulesResponse{}
	err = json.Unmarshal(resp, &cast)
	if err != nil {
		return nil, fmt.Errorf("unable to unmarshal response bytes into GetSearchAlertRulesResponse: %w", err)
	}
	return &cast, nil
}

type GetSearchRecordingRulesRequest struct {
	Params  GetSearchRecordingRulesRequestParams
	Headers http.Header
}

func (c *CustomRouteClient) GetSearchRecordingRules(ctx context.Context, namespace string, request GetSearchRecordingRulesRequest) (*GetSearchRecordingRulesResponse, error) {
	params := url.Values{}
	resp, err := c.NamespacedRequest(ctx, namespace, resource.CustomRouteRequestOptions{
		Path:    "/search/recordingrules",
		Verb:    "GET",
		Query:   params,
		Headers: request.Headers,
	})
	if err != nil {
		return nil, err
	}
	cast := GetSearchRecordingRulesResponse{}
	err = json.Unmarshal(resp, &cast)
	if err != nil {
		return nil, fmt.Errorf("unable to unmarshal response bytes into GetSearchRecordingRulesResponse: %w", err)
	}
	return &cast, nil
}

type GetSearchRulesRequest struct {
	Params  GetSearchRulesRequestParams
	Headers http.Header
}

func (c *CustomRouteClient) GetSearchRules(ctx context.Context, namespace string, request GetSearchRulesRequest) (*GetSearchRulesResponse, error) {
	params := url.Values{}
	resp, err := c.NamespacedRequest(ctx, namespace, resource.CustomRouteRequestOptions{
		Path:    "/search",
		Verb:    "GET",
		Query:   params,
		Headers: request.Headers,
	})
	if err != nil {
		return nil, err
	}
	cast := GetSearchRulesResponse{}
	err = json.Unmarshal(resp, &cast)
	if err != nil {
		return nil, fmt.Errorf("unable to unmarshal response bytes into GetSearchRulesResponse: %w", err)
	}
	return &cast, nil
}
