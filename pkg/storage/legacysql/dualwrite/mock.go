package dualwrite

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/pkg/apiserver/rest"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

func ProvideTestService(status ...StorageStatus) Service {
	if len(status) < 1 {
		status = []StorageStatus{{
			WriteLegacy:  true,
			WriteUnified: false,
			Runtime:      false,
			ReadUnified:  false,
		}}
	}
	return &mockService{status: status[0]}
}

type mockService struct {
	status StorageStatus
}

// NewStorage implements Service.
func (m *mockService) NewStorage(gr schema.GroupResource, legacy rest.Storage, storage rest.Storage) (rest.Storage, error) {
	return nil, fmt.Errorf("not implemented")
}

// ReadFromUnified implements Service.
func (m *mockService) ReadFromUnified(ctx context.Context, gr schema.GroupResource) (bool, error) {
	return m.status.ReadUnified, nil
}

// Status implements Service.
func (m *mockService) Status(ctx context.Context, gr schema.GroupResource) (StorageStatus, error) {
	s := m.status
	s.Group = gr.Group
	s.Resource = gr.Resource
	return s, nil
}

// Update implements Service.
func (m *mockService) Update(ctx context.Context, status StorageStatus) (StorageStatus, error) {
	return m.status, fmt.Errorf("not implemented")
}
