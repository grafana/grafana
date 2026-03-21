package v0alpha1

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/grafana/grafana-app-sdk/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

type QueryHistoryClient struct {
	client *resource.TypedClient[*QueryHistory, *QueryHistoryList]
}

func NewQueryHistoryClient(client resource.Client) *QueryHistoryClient {
	return &QueryHistoryClient{
		client: resource.NewTypedClient[*QueryHistory, *QueryHistoryList](client, QueryHistoryKind()),
	}
}

func NewQueryHistoryClientFromGenerator(generator resource.ClientGenerator) (*QueryHistoryClient, error) {
	c, err := generator.ClientFor(QueryHistoryKind())
	if err != nil {
		return nil, err
	}
	return NewQueryHistoryClient(c), nil
}

func (c *QueryHistoryClient) Get(ctx context.Context, identifier resource.Identifier) (*QueryHistory, error) {
	return c.client.Get(ctx, identifier)
}

func (c *QueryHistoryClient) List(ctx context.Context, namespace string, opts resource.ListOptions) (*QueryHistoryList, error) {
	return c.client.List(ctx, namespace, opts)
}

func (c *QueryHistoryClient) ListAll(ctx context.Context, namespace string, opts resource.ListOptions) (*QueryHistoryList, error) {
	resp, err := c.client.List(ctx, namespace, resource.ListOptions{
		ResourceVersion: opts.ResourceVersion,
		Limit:           opts.Limit,
		LabelFilters:    opts.LabelFilters,
		FieldSelectors:  opts.FieldSelectors,
	})
	if err != nil {
		return nil, err
	}
	for resp.GetContinue() != "" {
		page, err := c.client.List(ctx, namespace, resource.ListOptions{
			Continue:        resp.GetContinue(),
			ResourceVersion: opts.ResourceVersion,
			Limit:           opts.Limit,
			LabelFilters:    opts.LabelFilters,
			FieldSelectors:  opts.FieldSelectors,
		})
		if err != nil {
			return nil, err
		}
		resp.SetContinue(page.GetContinue())
		resp.SetResourceVersion(page.GetResourceVersion())
		resp.SetItems(append(resp.GetItems(), page.GetItems()...))
	}
	return resp, nil
}

func (c *QueryHistoryClient) Create(ctx context.Context, obj *QueryHistory, opts resource.CreateOptions) (*QueryHistory, error) {
	// Make sure apiVersion and kind are set
	obj.APIVersion = GroupVersion.Identifier()
	obj.Kind = QueryHistoryKind().Kind()
	return c.client.Create(ctx, obj, opts)
}

func (c *QueryHistoryClient) Update(ctx context.Context, obj *QueryHistory, opts resource.UpdateOptions) (*QueryHistory, error) {
	return c.client.Update(ctx, obj, opts)
}

func (c *QueryHistoryClient) Patch(ctx context.Context, identifier resource.Identifier, req resource.PatchRequest, opts resource.PatchOptions) (*QueryHistory, error) {
	return c.client.Patch(ctx, identifier, req, opts)
}

func (c *QueryHistoryClient) UpdateStatus(ctx context.Context, identifier resource.Identifier, newStatus QueryHistoryStatus, opts resource.UpdateOptions) (*QueryHistory, error) {
	return c.client.Update(ctx, &QueryHistory{
		TypeMeta: metav1.TypeMeta{
			Kind:       QueryHistoryKind().Kind(),
			APIVersion: GroupVersion.Identifier(),
		},
		ObjectMeta: metav1.ObjectMeta{
			ResourceVersion: opts.ResourceVersion,
			Namespace:       identifier.Namespace,
			Name:            identifier.Name,
		},
		Status: newStatus,
	}, resource.UpdateOptions{
		Subresource:     "status",
		ResourceVersion: opts.ResourceVersion,
	})
}

func (c *QueryHistoryClient) Delete(ctx context.Context, identifier resource.Identifier, opts resource.DeleteOptions) error {
	return c.client.Delete(ctx, identifier, opts)
}

type GetSearchRequest struct {
	Headers http.Header
}

func (c *QueryHistoryClient) GetSearch(ctx context.Context, identifier resource.Identifier, request GetSearchRequest) (*GetSearchResponse, error) {
	resp, err := c.client.SubresourceRequest(ctx, identifier, resource.CustomRouteRequestOptions{
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
