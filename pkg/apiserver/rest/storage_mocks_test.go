package rest

import (
	"context"
	"errors"

	"github.com/stretchr/testify/mock"
	"k8s.io/apimachinery/pkg/api/meta"
	metainternalversion "k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"
)

type legacyStoreMock struct {
	*mock.Mock
	LegacyStorage
}

type storageMock struct {
	*mock.Mock
	Storage
}

func (m legacyStoreMock) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	select {
	case <-ctx.Done():
		return nil, errors.New("context canceled")
	default:
	}

	args := m.Called(ctx, name, options)
	if name == "object-fail" {
		return nil, args.Error(1)
	}
	return args.Get(0).(runtime.Object), args.Error(1)
}

func (m legacyStoreMock) Create(ctx context.Context, obj runtime.Object, createValidation rest.ValidateObjectFunc, options *metav1.CreateOptions) (runtime.Object, error) {
	select {
	case <-ctx.Done():
		return nil, errors.New("context canceled")
	default:
	}

	args := m.Called(ctx, obj, createValidation, options)
	acc, err := meta.Accessor(obj)
	if err != nil {
		return nil, args.Error(1)
	}
	name := acc.GetName()
	if name == "object-fail" {
		return nil, args.Error(1)
	}
	return args.Get(0).(runtime.Object), args.Error(1)
}

func (m legacyStoreMock) List(ctx context.Context, options *metainternalversion.ListOptions) (runtime.Object, error) {
	select {
	case <-ctx.Done():
		return nil, errors.New("context canceled")
	default:
	}

	args := m.Called(ctx, options)
	if options.Kind == "fail" {
		return nil, args.Error(1)
	}
	return args.Get(0).(runtime.Object), args.Error(1)
}

func (m legacyStoreMock) NewList() runtime.Object {
	return nil
}

func (m legacyStoreMock) Update(ctx context.Context, name string, objInfo rest.UpdatedObjectInfo, createValidation rest.ValidateObjectFunc, updateValidation rest.ValidateObjectUpdateFunc, forceAllowCreate bool, options *metav1.UpdateOptions) (runtime.Object, bool, error) {
	select {
	case <-ctx.Done():
		return nil, false, errors.New("context canceled")
	default:
	}
	args := m.Called(ctx, name, objInfo, createValidation, updateValidation, forceAllowCreate, options)
	if name == "object-fail" {
		return nil, false, args.Error(2)
	}
	return args.Get(0).(runtime.Object), args.Bool(1), args.Error(2)
}

func (m legacyStoreMock) Delete(ctx context.Context, name string, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions) (runtime.Object, bool, error) {
	select {
	case <-ctx.Done():
		return nil, false, errors.New("context canceled")
	default:
	}

	args := m.Called(ctx, name, deleteValidation, options)
	if name == "object-fail" {
		return nil, false, args.Error(2)
	}
	if name == "not-found-legacy" {
		return nil, false, args.Error(2)
	}
	return args.Get(0).(runtime.Object), args.Bool(1), args.Error(2)
}

func (m legacyStoreMock) DeleteCollection(ctx context.Context, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions, listOptions *metainternalversion.ListOptions) (runtime.Object, error) {
	select {
	case <-ctx.Done():
		return nil, errors.New("context canceled")
	default:
	}
	args := m.Called(ctx, deleteValidation, options, listOptions)
	if options.Kind == "fail" {
		return nil, args.Error(1)
	}
	return args.Get(0).(runtime.Object), args.Error(1)
}

// Unified Store
func (m storageMock) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	select {
	case <-ctx.Done():
		return nil, errors.New("context canceled")
	default:
	}

	args := m.Called(ctx, name, options)
	if name == "object-fail" {
		return nil, args.Error(1)
	}
	if name == "not-found" {
		return nil, args.Error(1)
	}
	return args.Get(0).(runtime.Object), args.Error(1)
}

func (m storageMock) Create(ctx context.Context, obj runtime.Object, createValidation rest.ValidateObjectFunc, options *metav1.CreateOptions) (runtime.Object, error) {
	select {
	case <-ctx.Done():
		return nil, errors.New("context canceled")
	default:
	}

	args := m.Called(ctx, obj, createValidation, options)
	acc, err := meta.Accessor(obj)
	if err != nil {
		return nil, args.Error(1)
	}
	name := acc.GetName()
	if name == "object-fail" {
		return nil, args.Error(1)
	}
	return args.Get(0).(runtime.Object), args.Error(1)
}

func (m storageMock) List(ctx context.Context, options *metainternalversion.ListOptions) (runtime.Object, error) {
	select {
	case <-ctx.Done():
		return nil, errors.New("context canceled")
	default:
	}

	args := m.Called(ctx, options)
	if options.Kind == "fail" {
		return nil, args.Error(1)
	}
	return args.Get(0).(runtime.Object), args.Error(1)
}

func (m storageMock) NewList() runtime.Object {
	return nil
}

func (m storageMock) Update(ctx context.Context, name string, objInfo rest.UpdatedObjectInfo, createValidation rest.ValidateObjectFunc, updateValidation rest.ValidateObjectUpdateFunc, forceAllowCreate bool, options *metav1.UpdateOptions) (runtime.Object, bool, error) {
	select {
	case <-ctx.Done():
		return nil, false, errors.New("context canceled")
	default:
	}

	args := m.Called(ctx, name, objInfo, createValidation, updateValidation, forceAllowCreate, options)
	if name == "object-fail" {
		return nil, false, args.Error(2)
	}
	return args.Get(0).(runtime.Object), args.Bool(1), args.Error(2)
}

func (m storageMock) Delete(ctx context.Context, name string, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions) (runtime.Object, bool, error) {
	select {
	case <-ctx.Done():
		return nil, false, errors.New("context canceled")
	default:
	}

	args := m.Called(ctx, name, deleteValidation, options)
	if name == "object-fail" {
		return nil, false, args.Error(2)
	}
	return args.Get(0).(runtime.Object), args.Bool(1), args.Error(2)
}

func (m storageMock) DeleteCollection(ctx context.Context, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions, listOptions *metainternalversion.ListOptions) (runtime.Object, error) {
	select {
	case <-ctx.Done():
		return nil, errors.New("context canceled")
	default:
	}

	args := m.Called(ctx, deleteValidation, options, listOptions)
	if options.Kind == "fail" {
		return nil, args.Error(1)
	}
	return args.Get(0).(runtime.Object), args.Error(1)
}

type updatedObjInfoObj struct{}

func (u updatedObjInfoObj) UpdatedObject(ctx context.Context, oldObj runtime.Object) (newObj runtime.Object, err error) { // nolint:staticcheck
	// nolint:staticcheck
	oldObj = exampleObj
	return oldObj, nil
}
func (u updatedObjInfoObj) Preconditions() *metav1.Preconditions { return &metav1.Preconditions{} }
