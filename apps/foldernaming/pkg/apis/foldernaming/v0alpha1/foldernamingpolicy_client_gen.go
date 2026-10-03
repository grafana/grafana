package v0alpha1

import (
	"context"

	"github.com/grafana/grafana-app-sdk/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

type FolderNamingPolicyClient struct {
	client *resource.TypedClient[*FolderNamingPolicy, *FolderNamingPolicyList]
}

func NewFolderNamingPolicyClient(client resource.Client) *FolderNamingPolicyClient {
	return &FolderNamingPolicyClient{
		client: resource.NewTypedClient[*FolderNamingPolicy, *FolderNamingPolicyList](client, FolderNamingPolicyKind()),
	}
}

func NewFolderNamingPolicyClientFromGenerator(generator resource.ClientGenerator) (*FolderNamingPolicyClient, error) {
	c, err := generator.ClientFor(FolderNamingPolicyKind())
	if err != nil {
		return nil, err
	}
	return NewFolderNamingPolicyClient(c), nil
}

func (c *FolderNamingPolicyClient) Get(ctx context.Context, identifier resource.Identifier) (*FolderNamingPolicy, error) {
	return c.client.Get(ctx, identifier)
}

func (c *FolderNamingPolicyClient) List(ctx context.Context, namespace string, opts resource.ListOptions) (*FolderNamingPolicyList, error) {
	return c.client.List(ctx, namespace, opts)
}

func (c *FolderNamingPolicyClient) ListAll(ctx context.Context, namespace string, opts resource.ListOptions) (*FolderNamingPolicyList, error) {
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

func (c *FolderNamingPolicyClient) Create(ctx context.Context, obj *FolderNamingPolicy, opts resource.CreateOptions) (*FolderNamingPolicy, error) {
	// Make sure apiVersion and kind are set
	obj.APIVersion = GroupVersion.Identifier()
	obj.Kind = FolderNamingPolicyKind().Kind()
	return c.client.Create(ctx, obj, opts)
}

func (c *FolderNamingPolicyClient) Update(ctx context.Context, obj *FolderNamingPolicy, opts resource.UpdateOptions) (*FolderNamingPolicy, error) {
	return c.client.Update(ctx, obj, opts)
}

func (c *FolderNamingPolicyClient) Patch(ctx context.Context, identifier resource.Identifier, req resource.PatchRequest, opts resource.PatchOptions) (*FolderNamingPolicy, error) {
	return c.client.Patch(ctx, identifier, req, opts)
}

func (c *FolderNamingPolicyClient) UpdateStatus(ctx context.Context, identifier resource.Identifier, newStatus FolderNamingPolicyStatus, opts resource.UpdateOptions) (*FolderNamingPolicy, error) {
	return c.client.Update(ctx, &FolderNamingPolicy{
		TypeMeta: metav1.TypeMeta{
			Kind:       FolderNamingPolicyKind().Kind(),
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

func (c *FolderNamingPolicyClient) Delete(ctx context.Context, identifier resource.Identifier, opts resource.DeleteOptions) error {
	return c.client.Delete(ctx, identifier, opts)
}
