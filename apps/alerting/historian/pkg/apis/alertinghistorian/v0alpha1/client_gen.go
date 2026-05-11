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

type GetAlertstatehistoryRequest struct {
	Headers http.Header
}

func (c *CustomRouteClient) GetAlertstatehistory(ctx context.Context, namespace string, request GetAlertstatehistoryRequest) (*GetAlertstatehistoryResponse, error) {
	resp, err := c.NamespacedRequest(ctx, namespace, resource.CustomRouteRequestOptions{
		Path:    "/alertstate/history",
		Verb:    "GET",
		Headers: request.Headers,
	})
	if err != nil {
		return nil, err
	}
	cast := GetAlertstatehistoryResponse{}
	err = json.Unmarshal(resp, &cast)
	if err != nil {
		return nil, fmt.Errorf("unable to unmarshal response bytes into GetAlertstatehistoryResponse: %w", err)
	}
	return &cast, nil
}

type CreateNotificationqueryRequest struct {
	Body    CreateNotificationqueryRequestBody
	Headers http.Header
}

func (c *CustomRouteClient) CreateNotificationquery(ctx context.Context, namespace string, request CreateNotificationqueryRequest) (*CreateNotificationqueryResponse, error) {
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
	cast := CreateNotificationqueryResponse{}
	err = json.Unmarshal(resp, &cast)
	if err != nil {
		return nil, fmt.Errorf("unable to unmarshal response bytes into CreateNotificationqueryResponse: %w", err)
	}
	return &cast, nil
}

type CreateNotificationsqueryalertsRequest struct {
	Body    CreateNotificationsqueryalertsRequestBody
	Headers http.Header
}

func (c *CustomRouteClient) CreateNotificationsqueryalerts(ctx context.Context, namespace string, request CreateNotificationsqueryalertsRequest) (*CreateNotificationsqueryalertsResponse, error) {
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
	cast := CreateNotificationsqueryalertsResponse{}
	err = json.Unmarshal(resp, &cast)
	if err != nil {
		return nil, fmt.Errorf("unable to unmarshal response bytes into CreateNotificationsqueryalertsResponse: %w", err)
	}
	return &cast, nil
}
