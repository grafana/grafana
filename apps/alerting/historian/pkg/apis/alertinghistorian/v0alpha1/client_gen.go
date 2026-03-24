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
		Group:   "historian.alerting.grafana.app",
		Version: "v0alpha1",
	}, defaultNamespace)
	if err != nil {
		return nil, err
	}
	return NewCustomRouteClient(client), nil
}

type GetAlertStateHistoryRequest struct {
	Headers http.Header
}

func (c *CustomRouteClient) GetAlertStateHistory(ctx context.Context, namespace string, request GetAlertStateHistoryRequest) (*GetAlertStateHistoryResponse, error) {
	resp, err := c.NamespacedRequest(ctx, namespace, resource.CustomRouteRequestOptions{
		Path:    "/alertstate/history",
		Verb:    "GET",
		Headers: request.Headers,
	})
	if err != nil {
		return nil, err
	}
	cast := GetAlertStateHistoryResponse{}
	err = json.Unmarshal(resp, &cast)
	if err != nil {
		return nil, fmt.Errorf("unable to unmarshal response bytes into GetAlertStateHistoryResponse: %w", err)
	}
	return &cast, nil
}

type CreateNotificationQueryRequest struct {
	Body    CreateNotificationQueryRequestBody
	Headers http.Header
}

func (c *CustomRouteClient) CreateNotificationQuery(ctx context.Context, namespace string, request CreateNotificationQueryRequest) (*CreateNotificationQueryResponse, error) {
	body, err := json.Marshal(request.Body)
	if err != nil {
		return nil, fmt.Errorf("unable to marshal body to JSON: %w", err)
	}
	resp, err := c.NamespacedRequest(ctx, namespace, resource.CustomRouteRequestOptions{
		Path:    "/notification/query",
		Verb:    "POST",
		Body:    io.NopCloser(bytes.NewReader(body)),
		Headers: request.Headers,
	})
	if err != nil {
		return nil, err
	}
	cast := CreateNotificationQueryResponse{}
	err = json.Unmarshal(resp, &cast)
	if err != nil {
		return nil, fmt.Errorf("unable to unmarshal response bytes into CreateNotificationQueryResponse: %w", err)
	}
	return &cast, nil
}

type CreateNotificationAlertQueryRequest struct {
	Body    CreateNotificationAlertQueryRequestBody
	Headers http.Header
}

func (c *CustomRouteClient) CreateNotificationAlertQuery(ctx context.Context, namespace string, request CreateNotificationAlertQueryRequest) (*CreateNotificationAlertQueryResponse, error) {
	body, err := json.Marshal(request.Body)
	if err != nil {
		return nil, fmt.Errorf("unable to marshal body to JSON: %w", err)
	}
	resp, err := c.NamespacedRequest(ctx, namespace, resource.CustomRouteRequestOptions{
		Path:    "/notifications/queryalerts",
		Verb:    "POST",
		Body:    io.NopCloser(bytes.NewReader(body)),
		Headers: request.Headers,
	})
	if err != nil {
		return nil, err
	}
	cast := CreateNotificationAlertQueryResponse{}
	err = json.Unmarshal(resp, &cast)
	if err != nil {
		return nil, fmt.Errorf("unable to unmarshal response bytes into CreateNotificationAlertQueryResponse: %w", err)
	}
	return &cast, nil
}
