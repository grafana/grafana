package v0alpha1

import (
	"context"

	"github.com/grafana/grafana-app-sdk/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// +k8s:openapi-gen=false
type JobClient struct {
	client *resource.TypedClient[*Job, *JobList]
}

func NewJobClient(client resource.Client) *JobClient {
	return &JobClient{
		client: resource.NewTypedClient[*Job, *JobList](client, JobKind()),
	}
}

func NewJobClientFromGenerator(generator resource.ClientGenerator) (*JobClient, error) {
	c, err := generator.ClientFor(JobKind())
	if err != nil {
		return nil, err
	}
	return NewJobClient(c), nil
}

func (c *JobClient) Get(ctx context.Context, identifier resource.Identifier) (*Job, error) {
	return c.client.Get(ctx, identifier)
}

func (c *JobClient) List(ctx context.Context, namespace string, opts resource.ListOptions) (*JobList, error) {
	return c.client.List(ctx, namespace, opts)
}

func (c *JobClient) ListAll(ctx context.Context, namespace string, opts resource.ListOptions) (*JobList, error) {
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

func (c *JobClient) Create(ctx context.Context, obj *Job, opts resource.CreateOptions) (*Job, error) {
	// Make sure apiVersion and kind are set
	obj.APIVersion = GroupVersion.Identifier()
	obj.Kind = JobKind().Kind()
	return c.client.Create(ctx, obj, opts)
}

func (c *JobClient) Update(ctx context.Context, obj *Job, opts resource.UpdateOptions) (*Job, error) {
	return c.client.Update(ctx, obj, opts)
}

func (c *JobClient) Patch(ctx context.Context, identifier resource.Identifier, req resource.PatchRequest, opts resource.PatchOptions) (*Job, error) {
	return c.client.Patch(ctx, identifier, req, opts)
}

func (c *JobClient) UpdateStatus(ctx context.Context, identifier resource.Identifier, newStatus JobStatus, opts resource.UpdateOptions) (*Job, error) {
	return c.client.Update(ctx, &Job{
		TypeMeta: metav1.TypeMeta{
			Kind:       JobKind().Kind(),
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

func (c *JobClient) Delete(ctx context.Context, identifier resource.Identifier, opts resource.DeleteOptions) error {
	return c.client.Delete(ctx, identifier, opts)
}
