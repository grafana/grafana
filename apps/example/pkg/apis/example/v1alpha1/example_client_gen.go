package v1alpha1

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"

	"github.com/grafana/grafana-app-sdk/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

type ExampleClient struct {
	client *resource.TypedClient[*Example, *ExampleList]
}

func NewExampleClient(client resource.Client) *ExampleClient {
	return &ExampleClient{
		client: resource.NewTypedClient[*Example, *ExampleList](client, ExampleKind()),
	}
}

func NewExampleClientFromGenerator(generator resource.ClientGenerator) (*ExampleClient, error) {
	c, err := generator.ClientFor(ExampleKind())
	if err != nil {
		return nil, err
	}
	return NewExampleClient(c), nil
}

func (c *ExampleClient) Get(ctx context.Context, identifier resource.Identifier) (*Example, error) {
	return c.client.Get(ctx, identifier)
}

func (c *ExampleClient) List(ctx context.Context, namespace string, opts resource.ListOptions) (*ExampleList, error) {
	return c.client.List(ctx, namespace, opts)
}

func (c *ExampleClient) ListAll(ctx context.Context, namespace string, opts resource.ListOptions) (*ExampleList, error) {
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

func (c *ExampleClient) Create(ctx context.Context, obj *Example, opts resource.CreateOptions) (*Example, error) {
	// Make sure apiVersion and kind are set
	obj.APIVersion = GroupVersion.Identifier()
	obj.Kind = ExampleKind().Kind()
	return c.client.Create(ctx, obj, opts)
}

func (c *ExampleClient) Update(ctx context.Context, obj *Example, opts resource.UpdateOptions) (*Example, error) {
	return c.client.Update(ctx, obj, opts)
}

func (c *ExampleClient) Patch(ctx context.Context, identifier resource.Identifier, req resource.PatchRequest, opts resource.PatchOptions) (*Example, error) {
	return c.client.Patch(ctx, identifier, req, opts)
}

func (c *ExampleClient) UpdateCustom(ctx context.Context, identifier resource.Identifier, newCustom ExampleCustom, opts resource.UpdateOptions) (*Example, error) {
	return c.client.Update(ctx, &Example{
		TypeMeta: metav1.TypeMeta{
			Kind:       ExampleKind().Kind(),
			APIVersion: GroupVersion.Identifier(),
		},
		ObjectMeta: metav1.ObjectMeta{
			ResourceVersion: opts.ResourceVersion,
			Namespace:       identifier.Namespace,
			Name:            identifier.Name,
		},
		Custom: newCustom,
	}, resource.UpdateOptions{
		Subresource:     "custom",
		ResourceVersion: opts.ResourceVersion,
	})
}
func (c *ExampleClient) UpdateStatus(ctx context.Context, identifier resource.Identifier, newStatus ExampleStatus, opts resource.UpdateOptions) (*Example, error) {
	return c.client.Update(ctx, &Example{
		TypeMeta: metav1.TypeMeta{
			Kind:       ExampleKind().Kind(),
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

func (c *ExampleClient) Delete(ctx context.Context, identifier resource.Identifier, opts resource.DeleteOptions) error {
	return c.client.Delete(ctx, identifier, opts)
}

type GetFooRequest struct {
	Params  GetFooRequestParams
	Headers http.Header
}

func (c *ExampleClient) GetFoo(ctx context.Context, identifier resource.Identifier, request GetFooRequest) (*GetFoo, error) {
	params := url.Values{}
	resp, err := c.client.SubresourceRequest(ctx, identifier, resource.CustomRouteRequestOptions{
		Path:    "foo",
		Verb:    "GET",
		Query:   params,
		Headers: request.Headers,
	})
	if err != nil {
		return nil, err
	}
	cast := GetFoo{}
	err = json.Unmarshal(resp, &cast)
	if err != nil {
		return nil, fmt.Errorf("unable to unmarshal response bytes into GetFoo: %w", err)
	}
	return &cast, nil
}
