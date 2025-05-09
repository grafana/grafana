package resource

import (
	"context"

	"github.com/grafana/authlib/types"
	"github.com/stretchr/testify/mock"
)

var _ ResourceIndex = &MockResourceIndex{}

// Mock implementations
type MockResourceIndex struct {
	mock.Mock
}

func (m *MockResourceIndex) BulkIndex(req *BulkIndexRequest) error {
	args := m.Called(req)
	return args.Error(0)
}

func (m *MockResourceIndex) Search(ctx context.Context, access types.AccessClient, req *ResourceSearchRequest, federate []ResourceIndex) (*ResourceSearchResponse, error) {
	args := m.Called(ctx, access, req, federate)
	return args.Get(0).(*ResourceSearchResponse), args.Error(1)
}

func (m *MockResourceIndex) CountManagedObjects(ctx context.Context) ([]*CountManagedObjectsResponse_ResourceCount, error) {
	args := m.Called(ctx)
	return args.Get(0).([]*CountManagedObjectsResponse_ResourceCount), args.Error(1)
}

func (m *MockResourceIndex) DocCount(ctx context.Context, folder string) (int64, error) {
	args := m.Called(ctx, folder)
	return args.Get(0).(int64), args.Error(1)
}

func (m *MockResourceIndex) ListManagedObjects(ctx context.Context, req *ListManagedObjectsRequest) (*ListManagedObjectsResponse, error) {
	args := m.Called(ctx, req)
	return args.Get(0).(*ListManagedObjectsResponse), args.Error(1)
}

var _ DocumentBuilder = &MockDocumentBuilder{}

type MockDocumentBuilder struct {
	mock.Mock
}

func (m *MockDocumentBuilder) BuildDocument(ctx context.Context, key *ResourceKey, resourceVersion int64, value []byte) (*IndexableDocument, error) {
	args := m.Called(ctx, key, resourceVersion, value)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*IndexableDocument), nil
}
