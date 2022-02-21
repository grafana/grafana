package filestorage

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
	"gocloud.dev/blob"

	_ "gocloud.dev/blob/fileblob"
	_ "gocloud.dev/blob/memblob"
)

const (
	ServiceName = "FileStorage"
)

func ProvideService(cfg *setting.Cfg, sqlStore *sqlstore.SQLStore) (FileStorage, error) {
	bucket, err := blob.OpenBucket(context.Background(), fmt.Sprintf("file://%s", cfg.StaticRootPath))
	if err != nil {
		return nil, err
	}

	grafanaDsStorageLogger := log.New("grafanaDsStorage")
	prefixes := []string{
		"testdata",
		"img/icons",
		"img/bg",
		"gazetteer",
		"maps",
		"upload",
	}
	return &service{
		grafanaDsStorage: &wrapper{
			log: grafanaDsStorageLogger,
			wrapped: cdkBlobStorage{
				log:        grafanaDsStorageLogger,
				bucket:     bucket,
				rootFolder: "",
			},
			pathFilters: &PathFilters{allowedPrefixes: prefixes},
		},
		log: log.New("fileStorageService"),
	}, nil
}

type service struct {
	log              log.Logger
	grafanaDsStorage FileStorage
}

func (b service) Get(ctx context.Context, path string) (*File, error) {
	var filestorage FileStorage
	if belongsToStorage(path, StorageNameGrafanaDS) {
		filestorage = b.grafanaDsStorage
		path = removeStoragePrefix(path)
	}

	if err := validatePath(path); err != nil {
		return nil, err
	}

	return filestorage.Get(ctx, path)
}

func removeStoragePrefix(path string) string {
	if path == Delimiter || path == "" {
		return Delimiter
	}

	if !strings.Contains(path, Delimiter) {
		return Delimiter
	}

	split := strings.Split(path, Delimiter)

	// root of storage
	if len(split) == 2 && split[1] == "" {
		return Delimiter
	}

	// replace storage
	split[0] = ""
	return strings.Join(split, Delimiter)
}

func (b service) Delete(ctx context.Context, path string) error {
	return errors.New("not available")
}

func (b service) Upsert(ctx context.Context, file *UpsertFileCommand) error {
	return errors.New("not available")
}

func (b service) ListFiles(ctx context.Context, path string, cursor *Paging, options *ListOptions) (*ListFilesResponse, error) {
	var filestorage FileStorage
	if belongsToStorage(path, StorageNameGrafanaDS) {
		filestorage = b.grafanaDsStorage
		path = removeStoragePrefix(path)
	} else {
		return nil, errors.New("not available")
	}

	if err := validatePath(path); err != nil {
		return nil, err
	}

	return filestorage.ListFiles(ctx, path, cursor, options)
}

func (b service) ListFolders(ctx context.Context, path string, options *ListOptions) ([]FileMetadata, error) {
	var filestorage FileStorage
	if belongsToStorage(path, StorageNameGrafanaDS) {
		filestorage = b.grafanaDsStorage
		path = removeStoragePrefix(path)
	} else {
		return nil, errors.New("not available")
	}

	if err := validatePath(path); err != nil {
		return nil, err
	}

	return filestorage.ListFolders(ctx, path, options)
}

func (b service) CreateFolder(ctx context.Context, path string, folderName string) error {
	return errors.New("not available")
}

func (b service) DeleteFolder(ctx context.Context, path string) error {
	return errors.New("not available")
}
