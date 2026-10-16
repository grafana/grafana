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

type ListAlertRuleSearchRulesV0alpha1Request struct {
	Body    ListAlertRuleSearchRulesV0alpha1RequestBody
	Headers http.Header
}

func (c *CustomRouteClient) ListAlertRuleSearchRulesV0alpha1(ctx context.Context, namespace string, request ListAlertRuleSearchRulesV0alpha1Request) (*ListAlertRuleSearchRulesV0alpha1Response, error) {
	body, err := json.Marshal(request.Body)
	if err != nil {
		return nil, fmt.Errorf("unable to marshal body to JSON: %w", err)
	}
	resp, err := c.NamespacedRequest(ctx, namespace, resource.CustomRouteRequestOptions{
		Path:    "/alertrules/searchRules",
		Verb:    "POST",
		Body:    io.NopCloser(bytes.NewReader(body)),
		Headers: request.Headers,
	})
	if err != nil {
		return nil, err
	}
	cast := ListAlertRuleSearchRulesV0alpha1Response{}
	err = json.Unmarshal(resp, &cast)
	if err != nil {
		return nil, fmt.Errorf("unable to unmarshal response bytes into ListAlertRuleSearchRulesV0alpha1Response: %w", err)
	}
	return &cast, nil
}

type ListRecordingRuleSearchRulesV0alpha1Request struct {
	Body    ListRecordingRuleSearchRulesV0alpha1RequestBody
	Headers http.Header
}

func (c *CustomRouteClient) ListRecordingRuleSearchRulesV0alpha1(ctx context.Context, namespace string, request ListRecordingRuleSearchRulesV0alpha1Request) (*ListRecordingRuleSearchRulesV0alpha1Response, error) {
	body, err := json.Marshal(request.Body)
	if err != nil {
		return nil, fmt.Errorf("unable to marshal body to JSON: %w", err)
	}
	resp, err := c.NamespacedRequest(ctx, namespace, resource.CustomRouteRequestOptions{
		Path:    "/recordingrules/searchRules",
		Verb:    "POST",
		Body:    io.NopCloser(bytes.NewReader(body)),
		Headers: request.Headers,
	})
	if err != nil {
		return nil, err
	}
	cast := ListRecordingRuleSearchRulesV0alpha1Response{}
	err = json.Unmarshal(resp, &cast)
	if err != nil {
		return nil, fmt.Errorf("unable to unmarshal response bytes into ListRecordingRuleSearchRulesV0alpha1Response: %w", err)
	}
	return &cast, nil
}
