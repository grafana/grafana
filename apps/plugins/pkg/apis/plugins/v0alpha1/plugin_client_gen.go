package v0alpha1

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/grafana/grafana-app-sdk/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

type PluginClient struct {
	client *resource.TypedClient[*Plugin, *PluginList]
}

func NewPluginClient(client resource.Client) *PluginClient {
	return &PluginClient{
		client: resource.NewTypedClient[*Plugin, *PluginList](client, PluginKind()),
	}
}

func NewPluginClientFromGenerator(generator resource.ClientGenerator) (*PluginClient, error) {
	c, err := generator.ClientFor(PluginKind())
	if err != nil {
		return nil, err
	}
	return NewPluginClient(c), nil
}

func (c *PluginClient) Get(ctx context.Context, identifier resource.Identifier) (*Plugin, error) {
	return c.client.Get(ctx, identifier)
}

func (c *PluginClient) List(ctx context.Context, namespace string, opts resource.ListOptions) (*PluginList, error) {
	return c.client.List(ctx, namespace, opts)
}

func (c *PluginClient) ListAll(ctx context.Context, namespace string, opts resource.ListOptions) (*PluginList, error) {
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

func (c *PluginClient) Create(ctx context.Context, obj *Plugin, opts resource.CreateOptions) (*Plugin, error) {
	// Make sure apiVersion and kind are set
	obj.APIVersion = GroupVersion.Identifier()
	obj.Kind = PluginKind().Kind()
	return c.client.Create(ctx, obj, opts)
}

func (c *PluginClient) Update(ctx context.Context, obj *Plugin, opts resource.UpdateOptions) (*Plugin, error) {
	return c.client.Update(ctx, obj, opts)
}

func (c *PluginClient) Patch(ctx context.Context, identifier resource.Identifier, req resource.PatchRequest, opts resource.PatchOptions) (*Plugin, error) {
	return c.client.Patch(ctx, identifier, req, opts)
}

func (c *PluginClient) UpdateStatus(ctx context.Context, identifier resource.Identifier, newStatus PluginStatus, opts resource.UpdateOptions) (*Plugin, error) {
	return c.client.Update(ctx, &Plugin{
		TypeMeta: metav1.TypeMeta{
			Kind:       PluginKind().Kind(),
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

func (c *PluginClient) Delete(ctx context.Context, identifier resource.Identifier, opts resource.DeleteOptions) error {
	return c.client.Delete(ctx, identifier, opts)
}

type GetMetaRequest struct {
	Headers http.Header
}

func (c *PluginClient) GetMeta(ctx context.Context, identifier resource.Identifier, request GetMetaRequest) (*GetMeta, error) {
	resp, err := c.client.SubresourceRequest(ctx, identifier, resource.CustomRouteRequestOptions{
		Path:    "/meta",
		Verb:    "GET",
		Headers: request.Headers,
	})
	if err != nil {
		return nil, err
	}
	cast := GetMeta{}
	err = json.Unmarshal(resp, &cast)
	if err != nil {
		return nil, fmt.Errorf("unable to unmarshal response bytes into GetMeta: %w", err)
	}
	return &cast, nil
}
