package v0alpha1

import (
	"context"

	"github.com/grafana/grafana-app-sdk/resource"
)

type ScopeNodeClient struct {
	client *resource.TypedClient[*ScopeNode, *ScopeNodeList]
}

func NewScopeNodeClient(client resource.Client) *ScopeNodeClient {
	return &ScopeNodeClient{
		client: resource.NewTypedClient[*ScopeNode, *ScopeNodeList](client, ScopeNodeKind()),
	}
}

func NewScopeNodeClientFromGenerator(generator resource.ClientGenerator) (*ScopeNodeClient, error) {
	c, err := generator.ClientFor(ScopeNodeKind())
	if err != nil {
		return nil, err
	}
	return NewScopeNodeClient(c), nil
}

func (c *ScopeNodeClient) Get(ctx context.Context, identifier resource.Identifier) (*ScopeNode, error) {
	return c.client.Get(ctx, identifier)
}

func (c *ScopeNodeClient) List(ctx context.Context, namespace string, opts resource.ListOptions) (*ScopeNodeList, error) {
	return c.client.List(ctx, namespace, opts)
}

func (c *ScopeNodeClient) ListAll(ctx context.Context, namespace string, opts resource.ListOptions) (*ScopeNodeList, error) {
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

func (c *ScopeNodeClient) Create(ctx context.Context, obj *ScopeNode, opts resource.CreateOptions) (*ScopeNode, error) {
	// Make sure apiVersion and kind are set
	obj.APIVersion = GroupVersion.Identifier()
	obj.Kind = ScopeNodeKind().Kind()
	return c.client.Create(ctx, obj, opts)
}

func (c *ScopeNodeClient) Update(ctx context.Context, obj *ScopeNode, opts resource.UpdateOptions) (*ScopeNode, error) {
	return c.client.Update(ctx, obj, opts)
}

func (c *ScopeNodeClient) Patch(ctx context.Context, identifier resource.Identifier, req resource.PatchRequest, opts resource.PatchOptions) (*ScopeNode, error) {
	return c.client.Patch(ctx, identifier, req, opts)
}

func (c *ScopeNodeClient) Delete(ctx context.Context, identifier resource.Identifier, opts resource.DeleteOptions) error {
	return c.client.Delete(ctx, identifier, opts)
}
