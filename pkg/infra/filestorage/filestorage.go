package filestorage

import (
	"context"
	"errors"
	"fmt"
	"os"
	"strings"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
	"gocloud.dev/blob"

	_ "gocloud.dev/blob/fileblob"
	_ "gocloud.dev/blob/memblob"
)

const (
	ServiceName = "FileStorage"
)

func ProvideService(features featuremgmt.FeatureToggles, cfg *setting.Cfg) (FileStorage, error) {
	grafanaDsStorageLogger := log.New("grafanaDsStorage")

	path := fmt.Sprintf("file://%s", cfg.StaticRootPath)
	grafanaDsStorageLogger.Info("Initializing grafana ds storage", "path", path)
	bucket, err := blob.OpenBucket(context.Background(), path)
	if err != nil {
		currentDir, _ := os.Getwd()
		grafanaDsStorageLogger.Error("Failed to initialize grafana ds storage", "path", path, "error", err, "cwd", currentDir)
		return nil, err
	}

	prefixes := []string{
		"testdata/",
		"img/icons/",
		"img/bg/",
		"gazetteer/",
		"maps/",
		"upload/",
	}

	var grafanaDsStorage FileStorage
	if features.IsEnabled(featuremgmt.FlagFileStoreApi) {
		grafanaDsStorage = &wrapper{
			log: grafanaDsStorageLogger,
			wrapped: cdkBlobStorage{
				log:        grafanaDsStorageLogger,
				bucket:     bucket,
				rootFolder: "",
			},
			pathFilters: &PathFilters{allowedPrefixes: prefixes},
		}
	} else {
		grafanaDsStorage = &dummyFileStorage{}
	}

	return &service{
		grafanaDsStorage: grafanaDsStorage,
		log:              log.New("fileStorageService"),
	}, nil
}

type service struct {
	log              log.Logger
	grafanaDsStorage FileStorage
}

func (b service) Get(ctx context.Context, path string) (*File, error) {
	var filestorage FileStorage
	if belongsToStorage(path, StorageNamePublic) {
		filestorage = b.grafanaDsStorage
		path = removeStoragePrefix(path)
	}

	if err := validatePath(path); err != nil {
		return nil, err
	}

	return filestorage.Get(ctx, path)
}

func removeStoragePrefix(path string) string {
	path = strings.TrimPrefix(path, Delimiter)
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
	return errors.New("not implemented")
}

func (b service) Upsert(ctx context.Context, file *UpsertFileCommand) error {
	return errors.New("not implemented")
}

func (b service) ListFiles(ctx context.Context, path string, cursor *Paging, options *ListOptions) (*ListFilesResponse, error) {
	var filestorage FileStorage
	if belongsToStorage(path, StorageNamePublic) {
		filestorage = b.grafanaDsStorage
		path = removeStoragePrefix(path)
	} else {
		return nil, errors.New("not implemented")
	}

	if err := validatePath(path); err != nil {
		return nil, err
	}

	return filestorage.ListFiles(ctx, path, cursor, options)
}

func (b service) ListFolders(ctx context.Context, path string, options *ListOptions) ([]FileMetadata, error) {
	var filestorage FileStorage
	if belongsToStorage(path, StorageNamePublic) {
		filestorage = b.grafanaDsStorage
		path = removeStoragePrefix(path)
	} else {
		return nil, errors.New("not implemented")
	}

	if err := validatePath(path); err != nil {
		return nil, err
	}

	return filestorage.ListFolders(ctx, path, options)
}

func (b service) CreateFolder(ctx context.Context, path string) error {
	return errors.New("not implemented")
}

func (b service) DeleteFolder(ctx context.Context, path string) error {
	return errors.New("not implemented")
}

func (b service) IsFolderEmpty(ctx context.Context, path string) (bool, error) {
	return true, errors.New("not implemented")
}

func (b service) close() error {
	return b.grafanaDsStorage.close()
}
