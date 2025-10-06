package v0alpha1

import (
	"context"

	"github.com/grafana/grafana-app-sdk/resource"
)

type ScopeClient struct {
	client *resource.TypedClient[*Scope, *ScopeList]
}

func NewScopeClient(client resource.Client) *ScopeClient {
	return &ScopeClient{
		client: resource.NewTypedClient[*Scope, *ScopeList](client, ScopeKind()),
	}
}

func NewScopeClientFromGenerator(generator resource.ClientGenerator) (*ScopeClient, error) {
	c, err := generator.ClientFor(ScopeKind())
	if err != nil {
		return nil, err
	}
	return NewScopeClient(c), nil
}

func (c *ScopeClient) Get(ctx context.Context, identifier resource.Identifier) (*Scope, error) {
	return c.client.Get(ctx, identifier)
}

func (c *ScopeClient) List(ctx context.Context, namespace string, opts resource.ListOptions) (*ScopeList, error) {
	return c.client.List(ctx, namespace, opts)
}

func (c *ScopeClient) ListAll(ctx context.Context, namespace string, opts resource.ListOptions) (*ScopeList, error) {
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

func (c *ScopeClient) Create(ctx context.Context, obj *Scope, opts resource.CreateOptions) (*Scope, error) {
	// Make sure apiVersion and kind are set
	obj.APIVersion = GroupVersion.Identifier()
	obj.Kind = ScopeKind().Kind()
	return c.client.Create(ctx, obj, opts)
}

func (c *ScopeClient) Update(ctx context.Context, obj *Scope, opts resource.UpdateOptions) (*Scope, error) {
	return c.client.Update(ctx, obj, opts)
}

func (c *ScopeClient) Patch(ctx context.Context, identifier resource.Identifier, req resource.PatchRequest, opts resource.PatchOptions) (*Scope, error) {
	return c.client.Patch(ctx, identifier, req, opts)
}

func (c *ScopeClient) Delete(ctx context.Context, identifier resource.Identifier, opts resource.DeleteOptions) error {
	return c.client.Delete(ctx, identifier, opts)
}
