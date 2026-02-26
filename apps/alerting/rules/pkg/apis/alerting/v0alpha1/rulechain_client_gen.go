package v0alpha1

import (
	"context"

	"github.com/grafana/grafana-app-sdk/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

type RuleChainClient struct {
	client *resource.TypedClient[*RuleChain, *RuleChainList]
}

func NewRuleChainClient(client resource.Client) *RuleChainClient {
	return &RuleChainClient{
		client: resource.NewTypedClient[*RuleChain, *RuleChainList](client, RuleChainKind()),
	}
}

func NewRuleChainClientFromGenerator(generator resource.ClientGenerator) (*RuleChainClient, error) {
	c, err := generator.ClientFor(RuleChainKind())
	if err != nil {
		return nil, err
	}
	return NewRuleChainClient(c), nil
}

func (c *RuleChainClient) Get(ctx context.Context, identifier resource.Identifier) (*RuleChain, error) {
	return c.client.Get(ctx, identifier)
}

func (c *RuleChainClient) List(ctx context.Context, namespace string, opts resource.ListOptions) (*RuleChainList, error) {
	return c.client.List(ctx, namespace, opts)
}

func (c *RuleChainClient) ListAll(ctx context.Context, namespace string, opts resource.ListOptions) (*RuleChainList, error) {
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

func (c *RuleChainClient) Create(ctx context.Context, obj *RuleChain, opts resource.CreateOptions) (*RuleChain, error) {
	// Make sure apiVersion and kind are set
	obj.APIVersion = GroupVersion.Identifier()
	obj.Kind = RuleChainKind().Kind()
	return c.client.Create(ctx, obj, opts)
}

func (c *RuleChainClient) Update(ctx context.Context, obj *RuleChain, opts resource.UpdateOptions) (*RuleChain, error) {
	return c.client.Update(ctx, obj, opts)
}

func (c *RuleChainClient) Patch(ctx context.Context, identifier resource.Identifier, req resource.PatchRequest, opts resource.PatchOptions) (*RuleChain, error) {
	return c.client.Patch(ctx, identifier, req, opts)
}

func (c *RuleChainClient) UpdateStatus(ctx context.Context, identifier resource.Identifier, newStatus RuleChainStatus, opts resource.UpdateOptions) (*RuleChain, error) {
	return c.client.Update(ctx, &RuleChain{
		TypeMeta: metav1.TypeMeta{
			Kind:       RuleChainKind().Kind(),
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

func (c *RuleChainClient) Delete(ctx context.Context, identifier resource.Identifier, opts resource.DeleteOptions) error {
	return c.client.Delete(ctx, identifier, opts)
}
