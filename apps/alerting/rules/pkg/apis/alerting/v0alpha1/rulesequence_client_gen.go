package v0alpha1

import (
	"context"

	"github.com/grafana/grafana-app-sdk/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

type RuleSequenceClient struct {
	client *resource.TypedClient[*RuleSequence, *RuleSequenceList]
}

func NewRuleSequenceClient(client resource.Client) *RuleSequenceClient {
	return &RuleSequenceClient{
		client: resource.NewTypedClient[*RuleSequence, *RuleSequenceList](client, RuleSequenceKind()),
	}
}

func NewRuleSequenceClientFromGenerator(generator resource.ClientGenerator) (*RuleSequenceClient, error) {
	c, err := generator.ClientFor(RuleSequenceKind())
	if err != nil {
		return nil, err
	}
	return NewRuleSequenceClient(c), nil
}

func (c *RuleSequenceClient) Get(ctx context.Context, identifier resource.Identifier) (*RuleSequence, error) {
	return c.client.Get(ctx, identifier)
}

func (c *RuleSequenceClient) List(ctx context.Context, namespace string, opts resource.ListOptions) (*RuleSequenceList, error) {
	return c.client.List(ctx, namespace, opts)
}

func (c *RuleSequenceClient) ListAll(ctx context.Context, namespace string, opts resource.ListOptions) (*RuleSequenceList, error) {
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

func (c *RuleSequenceClient) Create(ctx context.Context, obj *RuleSequence, opts resource.CreateOptions) (*RuleSequence, error) {
	// Make sure apiVersion and kind are set
	obj.APIVersion = GroupVersion.Identifier()
	obj.Kind = RuleSequenceKind().Kind()
	return c.client.Create(ctx, obj, opts)
}

func (c *RuleSequenceClient) Update(ctx context.Context, obj *RuleSequence, opts resource.UpdateOptions) (*RuleSequence, error) {
	return c.client.Update(ctx, obj, opts)
}

func (c *RuleSequenceClient) Patch(ctx context.Context, identifier resource.Identifier, req resource.PatchRequest, opts resource.PatchOptions) (*RuleSequence, error) {
	return c.client.Patch(ctx, identifier, req, opts)
}

func (c *RuleSequenceClient) UpdateStatus(ctx context.Context, identifier resource.Identifier, newStatus RuleSequenceStatus, opts resource.UpdateOptions) (*RuleSequence, error) {
	return c.client.Update(ctx, &RuleSequence{
		TypeMeta: metav1.TypeMeta{
			Kind:       RuleSequenceKind().Kind(),
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

func (c *RuleSequenceClient) Delete(ctx context.Context, identifier resource.Identifier, opts resource.DeleteOptions) error {
	return c.client.Delete(ctx, identifier, opts)
}
