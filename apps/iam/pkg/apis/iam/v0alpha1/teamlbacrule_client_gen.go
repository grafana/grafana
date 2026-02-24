package v0alpha1

import (
	"context"

	"github.com/grafana/grafana-app-sdk/resource"
)

type TeamLBACRuleClient struct {
	client *resource.TypedClient[*TeamLBACRule, *TeamLBACRuleList]
}

func NewTeamLBACRuleClient(client resource.Client) *TeamLBACRuleClient {
	return &TeamLBACRuleClient{
		client: resource.NewTypedClient[*TeamLBACRule, *TeamLBACRuleList](client, TeamLBACRuleKind()),
	}
}

func NewTeamLBACRuleClientFromGenerator(generator resource.ClientGenerator) (*TeamLBACRuleClient, error) {
	c, err := generator.ClientFor(TeamLBACRuleKind())
	if err != nil {
		return nil, err
	}
	return NewTeamLBACRuleClient(c), nil
}

func (c *TeamLBACRuleClient) Get(ctx context.Context, identifier resource.Identifier) (*TeamLBACRule, error) {
	return c.client.Get(ctx, identifier)
}

func (c *TeamLBACRuleClient) List(ctx context.Context, namespace string, opts resource.ListOptions) (*TeamLBACRuleList, error) {
	return c.client.List(ctx, namespace, opts)
}

func (c *TeamLBACRuleClient) ListAll(ctx context.Context, namespace string, opts resource.ListOptions) (*TeamLBACRuleList, error) {
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

func (c *TeamLBACRuleClient) Create(ctx context.Context, obj *TeamLBACRule, opts resource.CreateOptions) (*TeamLBACRule, error) {
	// Make sure apiVersion and kind are set
	obj.APIVersion = GroupVersion.Identifier()
	obj.Kind = TeamLBACRuleKind().Kind()
	return c.client.Create(ctx, obj, opts)
}

func (c *TeamLBACRuleClient) Update(ctx context.Context, obj *TeamLBACRule, opts resource.UpdateOptions) (*TeamLBACRule, error) {
	return c.client.Update(ctx, obj, opts)
}

func (c *TeamLBACRuleClient) Patch(ctx context.Context, identifier resource.Identifier, req resource.PatchRequest, opts resource.PatchOptions) (*TeamLBACRule, error) {
	return c.client.Patch(ctx, identifier, req, opts)
}

func (c *TeamLBACRuleClient) Delete(ctx context.Context, identifier resource.Identifier, opts resource.DeleteOptions) error {
	return c.client.Delete(ctx, identifier, opts)
}
