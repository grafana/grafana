package rest

import (
	"context"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	registryrest "k8s.io/apiserver/pkg/registry/rest"
)

// PrepareCreateFunc transforms a private copy before it is created in storage.
// The caller's object is never passed to the hook.
type PrepareCreateFunc func(context.Context, runtime.Object, *metav1.CreateOptions) error

type prepareCreateStorage struct {
	Storage
	prepare PrepareCreateFunc
}

// WithPrepareCreate applies a resource-specific transformation to a copy of
// each object passed to Create. Other storage operations are unchanged.
func WithPrepareCreate(storage Storage, prepare PrepareCreateFunc) Storage {
	return &prepareCreateStorage{Storage: storage, prepare: prepare}
}

func (s *prepareCreateStorage) Create(ctx context.Context, obj runtime.Object, validate registryrest.ValidateObjectFunc, options *metav1.CreateOptions) (runtime.Object, error) {
	copy := obj.DeepCopyObject()
	if err := s.prepare(ctx, copy, options); err != nil {
		return nil, err
	}
	return s.Storage.Create(ctx, copy, validate, options)
}
