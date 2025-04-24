package client

import (
	"context"

	"github.com/stretchr/testify/mock"

	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/client-go/rest"
)

var _ K8sHandler = (*MockK8sHandler)(nil)

type MockK8sHandler struct {
	mock.Mock
}

func (m *MockK8sHandler) GetNamespace(orgID int64) string {
	args := m.Called(orgID)
	return args.String(0)
}

func (m *MockK8sHandler) Get(ctx context.Context, name string, orgID int64, options v1.GetOptions, subresource ...string) (*unstructured.Unstructured, error) {
	args := m.Called(ctx, name, orgID, options, subresource)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}

	return args.Get(0).(*unstructured.Unstructured), args.Error(1)
}

func (m *MockK8sHandler) Create(ctx context.Context, obj *unstructured.Unstructured, orgID int64, opts v1.CreateOptions) (*unstructured.Unstructured, error) {
	args := m.Called(ctx, obj, orgID, opts)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*unstructured.Unstructured), args.Error(1)
}

func (m *MockK8sHandler) Update(ctx context.Context, obj *unstructured.Unstructured, orgID int64, opts v1.UpdateOptions) (*unstructured.Unstructured, error) {
	args := m.Called(ctx, obj, orgID, opts)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*unstructured.Unstructured), args.Error(1)
}

func (m *MockK8sHandler) Delete(ctx context.Context, name string, orgID int64, options v1.DeleteOptions) error {
	args := m.Called(ctx, name, orgID, options)
	return args.Error(0)
}

func (m *MockK8sHandler) DeleteCollection(ctx context.Context, orgID int64) error {
	args := m.Called(ctx, orgID)
	return args.Error(0)
}

func (m *MockK8sHandler) List(ctx context.Context, orgID int64, options v1.ListOptions) (*unstructured.UnstructuredList, error) {
	args := m.Called(ctx, orgID, options)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*unstructured.UnstructuredList), args.Error(1)
}

func (m *MockK8sHandler) Search(ctx context.Context, orgID int64, in *resource.ResourceSearchRequest) (*resource.ResourceSearchResponse, error) {
	args := m.Called(ctx, orgID, in)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*resource.ResourceSearchResponse), args.Error(1)
}

func (m *MockK8sHandler) GetStats(ctx context.Context, orgID int64) (*resource.ResourceStatsResponse, error) {
	args := m.Called(ctx, orgID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*resource.ResourceStatsResponse), args.Error(1)
}

func (m *MockK8sHandler) GetUsersFromMeta(ctx context.Context, usersMeta []string) (map[string]*user.User, error) {
	args := m.Called(ctx, usersMeta)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(map[string]*user.User), args.Error(1)
}

type MockTestRestConfig struct {
	cfg *rest.Config
}

func (r MockTestRestConfig) GetRestConfig(ctx context.Context) (*rest.Config, error) {
	return r.cfg, nil
}
