package v0alpha1

import (
	"context"

	"github.com/grafana/grafana-app-sdk/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

type RulePolicyClient struct {
	client *resource.TypedClient[*RulePolicy, *RulePolicyList]
}

func NewRulePolicyClient(client resource.Client) *RulePolicyClient {
	return &RulePolicyClient{
		client: resource.NewTypedClient[*RulePolicy, *RulePolicyList](client, RulePolicyKind()),
	}
}

func NewRulePolicyClientFromGenerator(generator resource.ClientGenerator) (*RulePolicyClient, error) {
	c, err := generator.ClientFor(RulePolicyKind())
	if err != nil {
		return nil, err
	}
	return NewRulePolicyClient(c), nil
}

func (c *RulePolicyClient) Get(ctx context.Context, identifier resource.Identifier) (*RulePolicy, error) {
	return c.client.Get(ctx, identifier)
}

func (c *RulePolicyClient) List(ctx context.Context, namespace string, opts resource.ListOptions) (*RulePolicyList, error) {
	return c.client.List(ctx, namespace, opts)
}

func (c *RulePolicyClient) ListAll(ctx context.Context, namespace string, opts resource.ListOptions) (*RulePolicyList, error) {
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

func (c *RulePolicyClient) Create(ctx context.Context, obj *RulePolicy, opts resource.CreateOptions) (*RulePolicy, error) {
	// Make sure apiVersion and kind are set
	obj.APIVersion = GroupVersion.Identifier()
	obj.Kind = RulePolicyKind().Kind()
	return c.client.Create(ctx, obj, opts)
}

func (c *RulePolicyClient) Update(ctx context.Context, obj *RulePolicy, opts resource.UpdateOptions) (*RulePolicy, error) {
	return c.client.Update(ctx, obj, opts)
}

func (c *RulePolicyClient) Patch(ctx context.Context, identifier resource.Identifier, req resource.PatchRequest, opts resource.PatchOptions) (*RulePolicy, error) {
	return c.client.Patch(ctx, identifier, req, opts)
}

func (c *RulePolicyClient) UpdateStatus(ctx context.Context, identifier resource.Identifier, newStatus RulePolicyStatus, opts resource.UpdateOptions) (*RulePolicy, error) {
	return c.client.Update(ctx, &RulePolicy{
		TypeMeta: metav1.TypeMeta{
			Kind:       RulePolicyKind().Kind(),
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

func (c *RulePolicyClient) Delete(ctx context.Context, identifier resource.Identifier, opts resource.DeleteOptions) error {
	return c.client.Delete(ctx, identifier, opts)
}
