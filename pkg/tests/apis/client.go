package apis

import (
	"context"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/client-go/dynamic"
)

// TypedClient is the struct that implements a typed interface for resource operations
type TypedClient[T any, L any] struct {
	Client dynamic.ResourceInterface
}

func (c *TypedClient[T, L]) Create(ctx context.Context, resource *T, opts metav1.CreateOptions) (*T, error) {
	unstructuredObj, err := runtime.DefaultUnstructuredConverter.ToUnstructured(resource)
	if err != nil {
		return nil, err
	}
	u := &unstructured.Unstructured{Object: unstructuredObj}
	result, err := c.Client.Create(ctx, u, opts)
	if err != nil {
		return nil, err
	}
	createdObj := new(T)
	err = runtime.DefaultUnstructuredConverter.FromUnstructured(result.Object, createdObj)
	if err != nil {
		return nil, err
	}
	return createdObj, nil
}

func (c *TypedClient[T, L]) Update(ctx context.Context, resource *T, opts metav1.UpdateOptions) (*T, error) {
	unstructuredObj, err := runtime.DefaultUnstructuredConverter.ToUnstructured(resource)
	if err != nil {
		return nil, err
	}
	u := &unstructured.Unstructured{Object: unstructuredObj}
	result, err := c.Client.Update(ctx, u, opts)
	if err != nil {
		return nil, err
	}
	updatedObj := new(T)
	err = runtime.DefaultUnstructuredConverter.FromUnstructured(result.Object, updatedObj)
	if err != nil {
		return nil, err
	}
	return updatedObj, nil
}

func (c *TypedClient[T, L]) Delete(ctx context.Context, name string, opts metav1.DeleteOptions) error {
	return c.Client.Delete(ctx, name, opts)
}

func (c *TypedClient[T, L]) Get(ctx context.Context, name string, opts metav1.GetOptions) (*T, error) {
	result, err := c.Client.Get(ctx, name, opts)
	if err != nil {
		return nil, err
	}
	retrievedObj := new(T)
	err = runtime.DefaultUnstructuredConverter.FromUnstructured(result.Object, retrievedObj)
	if err != nil {
		return nil, err
	}
	return retrievedObj, nil
}

func (c *TypedClient[T, L]) List(ctx context.Context, opts metav1.ListOptions) (*L, error) {
	result, err := c.Client.List(ctx, opts)
	if err != nil {
		return nil, err
	}
	listObj := new(L)
	err = runtime.DefaultUnstructuredConverter.FromUnstructured(result.UnstructuredContent(), listObj)
	if err != nil {
		return nil, err
	}
	return listObj, nil
}

func (c *TypedClient[T, L]) Patch(ctx context.Context, name string, pt types.PatchType, data []byte, opts metav1.PatchOptions, subresources ...string) (*T, error) {
	result, err := c.Client.Patch(ctx, name, pt, data, opts, subresources...)
	if err != nil {
		return nil, err
	}
	patchedObj := new(T)
	err = runtime.DefaultUnstructuredConverter.FromUnstructured(result.Object, patchedObj)
	if err != nil {
		return nil, err
	}
	return patchedObj, nil
}
