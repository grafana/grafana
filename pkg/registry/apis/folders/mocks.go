package folders

import (
	"context"

	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"

	"github.com/stretchr/testify/mock"
	"google.golang.org/grpc"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"
)

type storageMock struct {
	*mock.Mock
	rest.Storage
}

type searcherMock struct {
	*mock.Mock
	resourcepb.ResourceIndexClient
}

func (m storageMock) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	args := m.Called(ctx, name, options)
	return args.Get(0).(runtime.Object), args.Error(1)
}

func (m storageMock) ConvertToTable(ctx context.Context, obj runtime.Object, tableOptions runtime.Object) (*metav1.Table, error) {
	args := m.Called(ctx, obj, tableOptions)
	return args.Get(0).(*metav1.Table), args.Error(1)
}

func (m storageMock) Create(ctx context.Context, obj runtime.Object, createValidation rest.ValidateObjectFunc, options *metav1.CreateOptions) (runtime.Object, error) {
	args := m.Called(ctx, obj, createValidation, options)
	return args.Get(0).(runtime.Object), args.Error(1)
}

func (m storageMock) Delete(ctx context.Context, name string, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions) (runtime.Object, bool, error) {
	args := m.Called(ctx, name, deleteValidation, options)
	return args.Get(0).(runtime.Object), args.Bool(1), args.Error(2)
}

func (m storageMock) DeleteCollection(ctx context.Context, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions, listOptions *internalversion.ListOptions) (runtime.Object, error) {
	args := m.Called(ctx, deleteValidation, options, listOptions)
	return args.Get(0).(runtime.Object), args.Error(1)
}

func (m storageMock) GetSingularName() string {
	args := m.Called()
	return args.String(0)
}

func (m storageMock) List(ctx context.Context, options *internalversion.ListOptions) (runtime.Object, error) {
	args := m.Called(ctx, options)
	return args.Get(0).(runtime.Object), args.Error(1)
}

func (m storageMock) NamespaceScoped() bool {
	args := m.Called()
	return args.Bool(0)
}

func (m storageMock) NewList() runtime.Object {
	args := m.Called()
	return args.Get(0).(runtime.Object)
}

func (m storageMock) Update(ctx context.Context, name string, objInfo rest.UpdatedObjectInfo, createValidation rest.ValidateObjectFunc, updateValidation rest.ValidateObjectUpdateFunc, forceAllowCreate bool, options *metav1.UpdateOptions) (runtime.Object, bool, error) {
	args := m.Called(ctx, name, objInfo, createValidation, updateValidation, forceAllowCreate, options)
	if name == "object-fail" {
		return nil, false, args.Error(2)
	}
	return args.Get(0).(runtime.Object), args.Bool(1), args.Error(2)
}

func (s searcherMock) GetStats(ctx context.Context, req *resourcepb.ResourceStatsRequest, _ ...grpc.CallOption) (*resourcepb.ResourceStatsResponse, error) {
	args := s.Called(ctx, req)
	return args.Get(0).(*resourcepb.ResourceStatsResponse), args.Error(1)
}
