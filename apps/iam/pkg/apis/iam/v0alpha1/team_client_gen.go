package v0alpha1

import (
	"context"

	"github.com/grafana/grafana-app-sdk/resource"
)

type TeamClient struct {
	client *resource.TypedClient[*Team, *TeamList]
}

func NewTeamClient(client resource.Client) *TeamClient {
	return &TeamClient{
		client: resource.NewTypedClient[*Team, *TeamList](client, TeamKind()),
	}
}

func NewTeamClientFromGenerator(generator resource.ClientGenerator) (*TeamClient, error) {
	c, err := generator.ClientFor(TeamKind())
	if err != nil {
		return nil, err
	}
	return NewTeamClient(c), nil
}

func (c *TeamClient) Get(ctx context.Context, identifier resource.Identifier) (*Team, error) {
	return c.client.Get(ctx, identifier)
}

func (c *TeamClient) List(ctx context.Context, namespace string, opts resource.ListOptions) (*TeamList, error) {
	return c.client.List(ctx, namespace, opts)
}

func (c *TeamClient) ListAll(ctx context.Context, namespace string, opts resource.ListOptions) (*TeamList, error) {
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

func (c *TeamClient) Create(ctx context.Context, obj *Team, opts resource.CreateOptions) (*Team, error) {
	// Make sure apiVersion and kind are set
	obj.APIVersion = GroupVersion.Identifier()
	obj.Kind = TeamKind().Kind()
	return c.client.Create(ctx, obj, opts)
}

func (c *TeamClient) Update(ctx context.Context, obj *Team, opts resource.UpdateOptions) (*Team, error) {
	return c.client.Update(ctx, obj, opts)
}

func (c *TeamClient) Patch(ctx context.Context, identifier resource.Identifier, req resource.PatchRequest, opts resource.PatchOptions) (*Team, error) {
	return c.client.Patch(ctx, identifier, req, opts)
}

func (c *TeamClient) Delete(ctx context.Context, identifier resource.Identifier, opts resource.DeleteOptions) error {
	return c.client.Delete(ctx, identifier, opts)
}
