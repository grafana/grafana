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
		Group:   "rules.alerting.grafana.app",
		Version: "v0alpha1",
	}, defaultNamespace)
	if err != nil {
		return nil, err
	}
	return NewCustomRouteClient(client), nil
}

type ListAlertRuleSearchV0alpha1Request struct {
	Body    ListAlertRuleSearchV0alpha1RequestBody
	Headers http.Header
}

func (c *CustomRouteClient) ListAlertRuleSearchV0alpha1(ctx context.Context, namespace string, request ListAlertRuleSearchV0alpha1Request) (*ListAlertRuleSearchV0alpha1Response, error) {
	body, err := json.Marshal(request.Body)
	if err != nil {
		return nil, fmt.Errorf("unable to marshal body to JSON: %w", err)
	}
	resp, err := c.NamespacedRequest(ctx, namespace, resource.CustomRouteRequestOptions{
		Path:    "/alertrules/search",
		Verb:    "POST",
		Body:    io.NopCloser(bytes.NewReader(body)),
		Headers: request.Headers,
	})
	if err != nil {
		return nil, err
	}
	cast := ListAlertRuleSearchV0alpha1Response{}
	err = json.Unmarshal(resp, &cast)
	if err != nil {
		return nil, fmt.Errorf("unable to unmarshal response bytes into ListAlertRuleSearchV0alpha1Response: %w", err)
	}
	return &cast, nil
}

type ListRecordingRuleSearchV0alpha1Request struct {
	Body    ListRecordingRuleSearchV0alpha1RequestBody
	Headers http.Header
}

func (c *CustomRouteClient) ListRecordingRuleSearchV0alpha1(ctx context.Context, namespace string, request ListRecordingRuleSearchV0alpha1Request) (*ListRecordingRuleSearchV0alpha1Response, error) {
	body, err := json.Marshal(request.Body)
	if err != nil {
		return nil, fmt.Errorf("unable to marshal body to JSON: %w", err)
	}
	resp, err := c.NamespacedRequest(ctx, namespace, resource.CustomRouteRequestOptions{
		Path:    "/recordingrules/search",
		Verb:    "POST",
		Body:    io.NopCloser(bytes.NewReader(body)),
		Headers: request.Headers,
	})
	if err != nil {
		return nil, err
	}
	cast := ListRecordingRuleSearchV0alpha1Response{}
	err = json.Unmarshal(resp, &cast)
	if err != nil {
		return nil, fmt.Errorf("unable to unmarshal response bytes into ListRecordingRuleSearchV0alpha1Response: %w", err)
	}
	return &cast, nil
}
