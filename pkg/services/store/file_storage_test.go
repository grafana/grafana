package store

import (
	"context"

	"github.com/stretchr/testify/mock"

	"github.com/grafana/grafana/pkg/infra/filestorage"
)

type fileStorageMock struct {
	filestorage.FileStorage
	mock.Mock
}

func (m *fileStorageMock) Get(ctx context.Context, path string, options *filestorage.GetFileOptions) (*filestorage.File, bool, error) {
	args := m.Called(ctx, path, options)
	file, _ := args.Get(0).(*filestorage.File)
	return file, args.Bool(1), args.Error(2)
}

func (m *fileStorageMock) Upsert(ctx context.Context, command *filestorage.UpsertFileCommand) error {
	return m.Called(ctx, command).Error(0)
}

func (m *fileStorageMock) Delete(ctx context.Context, path string) error {
	return m.Called(ctx, path).Error(0)
}

func (m *fileStorageMock) List(ctx context.Context, path string, paging *filestorage.Paging, options *filestorage.ListOptions) (*filestorage.ListResponse, error) {
	args := m.Called(ctx, path, paging, options)
	response, _ := args.Get(0).(*filestorage.ListResponse)
	return response, args.Error(1)
}
