package secret

import (
	"context"
	"fmt"

	claims "github.com/grafana/authlib/types"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/apimachinery/pkg/watch"
	"k8s.io/apiserver/pkg/admission"
	"k8s.io/client-go/dynamic"

	secretv1beta1 "github.com/grafana/grafana/apps/secret/pkg/apis/secret/v1beta1"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/registry/apis/secret/xkube"
)

// SecureValueClient is a CRUD client for the secure value API.
type SecureValueClient = contracts.SecureValueClient

type secureValueClient struct {
	namespace string
	service   contracts.SecureValueService
	validator contracts.SecureValueValidator
}

var _ SecureValueClient = &secureValueClient{}

func ProvideSecureValueClient(service contracts.SecureValueService, validator contracts.SecureValueValidator) SecureValueClient {
	return &secureValueClient{
		service:   service,
		validator: validator,
	}
}

// Client returns a resource interface that is scoped to a specific namespace.
func (c *secureValueClient) Client(ctx context.Context, namespace string) (dynamic.ResourceInterface, error) {
	return c.Namespace(namespace), nil
}

// Namespace returns a resource interface that is scoped to a specific namespace.
func (c *secureValueClient) Namespace(ns string) dynamic.ResourceInterface {
	info, err := claims.ParseNamespace(ns)
	if err != nil {
		panic(err)
	}
	if len(info.Value) == 0 {
		panic("namespace is required")
	}

	ret := *c
	ret.namespace = ns
	return &ret
}

// Create a new secure value. Options and subresources are not supported and ignored.
func (c *secureValueClient) Create(ctx context.Context, obj *unstructured.Unstructured, _ metav1.CreateOptions, _ ...string) (*unstructured.Unstructured, error) {
	if len(c.namespace) == 0 {
		return nil, fmt.Errorf("namespace is required")
	}

	sv, err := fromUnstructured(obj)
	if err != nil {
		return nil, err
	}

	if sv.Namespace != c.namespace {
		return nil, fmt.Errorf("namespace mismatch")
	}
	if errs := c.validator.Validate(sv, nil, admission.Create); len(errs) > 0 {
		return nil, fmt.Errorf("invalid secure value: %w", errs.ToAggregate())
	}

	user, ok := claims.AuthInfoFrom(ctx)
	if !ok {
		return nil, fmt.Errorf("missing auth info in context")
	}

	createdSv, err := c.service.Create(ctx, sv, user.GetUID())
	if err != nil {
		return nil, err
	}

	return toUnstructured(createdSv)
}

// Get a secure value by name. Options and subresources are not supported and ignored.
func (c *secureValueClient) Get(ctx context.Context, name string, _ metav1.GetOptions, _ ...string) (*unstructured.Unstructured, error) {
	if len(c.namespace) == 0 {
		return nil, fmt.Errorf("namespace is required")
	}
	if len(name) == 0 {
		return nil, fmt.Errorf("name is required")
	}

	sv, err := c.service.Read(ctx, xkube.Namespace(c.namespace), name)
	if err != nil {
		return nil, err
	}

	return toUnstructured(sv)
}

// Update a secure value. Options and subresources are not supported and ignored.
func (c *secureValueClient) Update(ctx context.Context, obj *unstructured.Unstructured, _ metav1.UpdateOptions, _ ...string) (*unstructured.Unstructured, error) {
	if len(c.namespace) == 0 {
		return nil, fmt.Errorf("namespace is required")
	}

	oldUnstructured, err := c.Get(ctx, obj.GetName(), metav1.GetOptions{})
	if err != nil {
		return nil, err
	}

	oldSv, err := fromUnstructured(oldUnstructured)
	if err != nil {
		return nil, err
	}

	sv, err := fromUnstructured(obj)
	if err != nil {
		return nil, err
	}

	if sv.Namespace != c.namespace {
		return nil, fmt.Errorf("namespace mismatch")
	}
	if errs := c.validator.Validate(sv, oldSv, admission.Update); len(errs) > 0 {
		return nil, fmt.Errorf("invalid secure value: %w", errs.ToAggregate())
	}

	user, ok := claims.AuthInfoFrom(ctx)
	if !ok {
		return nil, fmt.Errorf("missing auth info in context")
	}

	updatedSv, _, err := c.service.Update(ctx, sv, user.GetUID())
	if err != nil {
		return nil, err
	}

	return toUnstructured(updatedSv)
}

// Delete a secure value by name. Options and subresources are not supported and ignored.
func (c *secureValueClient) Delete(ctx context.Context, name string, _ metav1.DeleteOptions, _ ...string) error {
	if len(c.namespace) == 0 {
		return fmt.Errorf("namespace is required")
	}
	if len(name) == 0 {
		return fmt.Errorf("name is required")
	}

	_, err := c.service.Delete(ctx, xkube.Namespace(c.namespace), name)
	return err
}

// List all secure values in the namespace. Options and subresources are not supported and ignored.
func (c *secureValueClient) List(ctx context.Context, _ metav1.ListOptions) (*unstructured.UnstructuredList, error) {
	if len(c.namespace) == 0 {
		return nil, fmt.Errorf("namespace is required")
	}

	list, err := c.service.List(ctx, xkube.Namespace(c.namespace))
	if err != nil {
		return nil, err
	}

	items := make([]unstructured.Unstructured, 0, len(list.Items))
	for _, sv := range list.Items {
		u, err := toUnstructured(&sv)
		if err != nil {
			return nil, err
		}

		items = append(items, *u)
	}

	return &unstructured.UnstructuredList{
		Items: items,
	}, nil
}

// DeleteCollection is not supported and returns an error.
func (c *secureValueClient) DeleteCollection(_ context.Context, _ metav1.DeleteOptions, _ metav1.ListOptions) error {
	return fmt.Errorf("deleteCollection is not supported")
}

// Watch is not supported and returns an error.
func (c *secureValueClient) Watch(_ context.Context, _ metav1.ListOptions) (watch.Interface, error) {
	return nil, fmt.Errorf("watch is not supported")
}

// Patch is not supported and returns an error.
func (c *secureValueClient) Patch(_ context.Context, _ string, _ types.PatchType, _ []byte, _ metav1.PatchOptions, _ ...string) (*unstructured.Unstructured, error) {
	return nil, fmt.Errorf("patch is not supported")
}

// Apply is not supported and returns an error.
func (c *secureValueClient) Apply(_ context.Context, _ string, _ *unstructured.Unstructured, _ metav1.ApplyOptions, _ ...string) (*unstructured.Unstructured, error) {
	return nil, fmt.Errorf("apply is not supported")
}

// UpdateStatus is not supported and returns an error.
func (c *secureValueClient) UpdateStatus(_ context.Context, _ *unstructured.Unstructured, _ metav1.UpdateOptions) (*unstructured.Unstructured, error) {
	return nil, fmt.Errorf("updateStatus is not supported")
}

// ApplyStatus is not supported and returns an error.
func (c *secureValueClient) ApplyStatus(_ context.Context, _ string, _ *unstructured.Unstructured, _ metav1.ApplyOptions) (*unstructured.Unstructured, error) {
	return nil, fmt.Errorf("applyStatus is not supported")
}

func toUnstructured(sv *secretv1beta1.SecureValue) (*unstructured.Unstructured, error) {
	unstructuredObj, err := runtime.DefaultUnstructuredConverter.ToUnstructured(sv)
	if err != nil {
		return nil, err
	}
	return &unstructured.Unstructured{Object: unstructuredObj}, nil
}

func fromUnstructured(u *unstructured.Unstructured) (*secretv1beta1.SecureValue, error) {
	sv := new(secretv1beta1.SecureValue)
	if err := runtime.DefaultUnstructuredConverter.FromUnstructured(u.Object, sv); err != nil {
		return nil, err
	}
	return sv, nil
}
