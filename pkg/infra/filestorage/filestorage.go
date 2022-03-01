package filestorage

import (
	"context"
	"errors"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
	_ "gocloud.dev/blob/fileblob"
	_ "gocloud.dev/blob/memblob"
)

const (
	ServiceName = "FileStorage"
)

func ProvideService(cfg *setting.Cfg, sqlStore *sqlstore.SQLStore) (FileStorage, error) {
	return &service{
		grafanaDsStorage: nil,
		log:              log.New("fileStorageService"),
	}, nil
}

type service struct {
	log              log.Logger
	grafanaDsStorage FileStorage
}

func (b service) Get(ctx context.Context, path string) (*File, error) {
	return nil, errors.New("not implemented")
}

func (b service) Delete(ctx context.Context, path string) error {
	return errors.New("not implemented")
}

func (b service) Upsert(ctx context.Context, file *UpsertFileCommand) error {
	return errors.New("not implemented")
}

func (b service) ListFiles(ctx context.Context, path string, cursor *Paging, options *ListOptions) (*ListFilesResponse, error) {
	return nil, errors.New("not implemented")
}

func (b service) ListFolders(ctx context.Context, path string, options *ListOptions) ([]FileMetadata, error) {
	return nil, errors.New("not implemented")
}

func (b service) CreateFolder(ctx context.Context, path string) error {
	return errors.New("not implemented")
}

func (b service) DeleteFolder(ctx context.Context, path string) error {
	return errors.New("not available")
}

func (b service) IsFolderEmpty(ctx context.Context, path string) (bool, error) {
	return true, errors.New("not available")
}

func (c service) close() error {
	return errors.New("not implemented")
}
