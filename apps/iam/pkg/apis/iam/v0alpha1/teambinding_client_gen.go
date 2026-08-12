package v0alpha1

import (
	"context"

	"github.com/grafana/grafana-app-sdk/resource"
)

type TeamBindingClient struct {
	client *resource.TypedClient[*TeamBinding, *TeamBindingList]
}

func NewTeamBindingClient(client resource.Client) *TeamBindingClient {
	return &TeamBindingClient{
		client: resource.NewTypedClient[*TeamBinding, *TeamBindingList](client, TeamBindingKind()),
	}
}

func NewTeamBindingClientFromGenerator(generator resource.ClientGenerator) (*TeamBindingClient, error) {
	c, err := generator.ClientFor(TeamBindingKind())
	if err != nil {
		return nil, err
	}
	return NewTeamBindingClient(c), nil
}

func (c *TeamBindingClient) Get(ctx context.Context, identifier resource.Identifier) (*TeamBinding, error) {
	return c.client.Get(ctx, identifier)
}

func (c *TeamBindingClient) List(ctx context.Context, namespace string, opts resource.ListOptions) (*TeamBindingList, error) {
	return c.client.List(ctx, namespace, opts)
}

func (c *TeamBindingClient) ListAll(ctx context.Context, namespace string, opts resource.ListOptions) (*TeamBindingList, error) {
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

func (c *TeamBindingClient) Create(ctx context.Context, obj *TeamBinding, opts resource.CreateOptions) (*TeamBinding, error) {
	// Make sure apiVersion and kind are set
	obj.APIVersion = GroupVersion.Identifier()
	obj.Kind = TeamBindingKind().Kind()
	return c.client.Create(ctx, obj, opts)
}

func (c *TeamBindingClient) Update(ctx context.Context, obj *TeamBinding, opts resource.UpdateOptions) (*TeamBinding, error) {
	return c.client.Update(ctx, obj, opts)
}

func (c *TeamBindingClient) Patch(ctx context.Context, identifier resource.Identifier, req resource.PatchRequest, opts resource.PatchOptions) (*TeamBinding, error) {
	return c.client.Patch(ctx, identifier, req, opts)
}

func (c *TeamBindingClient) Delete(ctx context.Context, identifier resource.Identifier, opts resource.DeleteOptions) error {
	return c.client.Delete(ctx, identifier, opts)
}
