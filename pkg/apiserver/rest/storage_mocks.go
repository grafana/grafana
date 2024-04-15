package rest

import (
	"context"

	"github.com/stretchr/testify/mock"
	metainternalversion "k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"
)

type legacyStoreMock struct {
	*mock.Mock
	LegacyStorage
	// GetReturn (runtime.Object, error)
}

type unifiedStoreMock struct {
	*mock.Mock
	Storage
}

func (m legacyStoreMock) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	args := m.Called(ctx, name, options)
	return args.Get(0).(runtime.Object), args.Error(1)
}

func (m legacyStoreMock) Create(ctx context.Context, obj runtime.Object, createValidation rest.ValidateObjectFunc, options *metav1.CreateOptions) (runtime.Object, error) {
	args := m.Called(ctx, obj, createValidation, options)
	return args.Get(0).(runtime.Object), args.Error(1)
}

func (m legacyStoreMock) List(ctx context.Context, options *metainternalversion.ListOptions) (runtime.Object, error) {
	args := m.Called(ctx, options)
	return args.Get(0).(runtime.Object), args.Error(1)
}

func (m legacyStoreMock) Update(ctx context.Context, name string, objInfo rest.UpdatedObjectInfo, createValidation rest.ValidateObjectFunc, updateValidation rest.ValidateObjectUpdateFunc, forceAllowCreate bool, options *metav1.UpdateOptions) (runtime.Object, bool, error) {
	args := m.Called(ctx, name, objInfo, createValidation, updateValidation, forceAllowCreate, options)
	return args.Get(0).(runtime.Object), args.Bool(1), args.Error(2)
}

func (m legacyStoreMock) Delete(ctx context.Context, name string, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions) (runtime.Object, bool, error) {
	args := m.Called(ctx, name, deleteValidation, options)
	return args.Get(0).(runtime.Object), args.Bool(1), args.Error(2)
}

// Unified Store
func (m unifiedStoreMock) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	args := m.Called(ctx, name, options)
	return args.Get(0).(runtime.Object), args.Error(1)
}

func (m unifiedStoreMock) Create(ctx context.Context, obj runtime.Object, createValidation rest.ValidateObjectFunc, options *metav1.CreateOptions) (runtime.Object, error) {
	args := m.Called(ctx, obj, createValidation, options)
	return args.Get(0).(runtime.Object), args.Error(1)
}

func (m unifiedStoreMock) List(ctx context.Context, options *metainternalversion.ListOptions) (runtime.Object, error) {
	args := m.Called(ctx, options)
	return args.Get(0).(runtime.Object), args.Error(1)
}

func (m unifiedStoreMock) Update(ctx context.Context, name string, objInfo rest.UpdatedObjectInfo, createValidation rest.ValidateObjectFunc, updateValidation rest.ValidateObjectUpdateFunc, forceAllowCreate bool, options *metav1.UpdateOptions) (runtime.Object, bool, error) {
	args := m.Called(ctx, name, objInfo, createValidation, updateValidation, forceAllowCreate, options)
	return args.Get(0).(runtime.Object), args.Bool(1), args.Error(2)
}

func (m unifiedStoreMock) Delete(ctx context.Context, name string, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions) (runtime.Object, bool, error) {
	args := m.Called(ctx, name, deleteValidation, options)
	return args.Get(0).(runtime.Object), args.Bool(1), args.Error(2)
}
