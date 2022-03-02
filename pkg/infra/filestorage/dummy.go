package filestorage

import (
	"context"

	_ "gocloud.dev/blob/fileblob"
	_ "gocloud.dev/blob/memblob"
)

var (
	_ FileStorage = (*dummyFileStorage)(nil) // dummyFileStorage implements FileStorage
)

type dummyFileStorage struct {
}

func (d dummyFileStorage) Get(ctx context.Context, path string) (*File, error) {
	return nil, nil
}

func (d dummyFileStorage) Delete(ctx context.Context, path string) error {
	return nil
}

func (d dummyFileStorage) Upsert(ctx context.Context, file *UpsertFileCommand) error {
	return nil
}

func (d dummyFileStorage) ListFiles(ctx context.Context, path string, cursor *Paging, options *ListOptions) (*ListFilesResponse, error) {
	return nil, nil
}

func (d dummyFileStorage) ListFolders(ctx context.Context, path string, options *ListOptions) ([]FileMetadata, error) {
	return nil, nil
}

func (d dummyFileStorage) CreateFolder(ctx context.Context, path string) error {
	return nil
}

func (d dummyFileStorage) DeleteFolder(ctx context.Context, path string) error {
	return nil
}

func (d dummyFileStorage) IsFolderEmpty(ctx context.Context, path string) (bool, error) {
	return true, nil
}

func (d dummyFileStorage) close() error {
	return nil
}
