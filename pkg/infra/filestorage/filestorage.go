package filestorage

import (
	"context"

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

func ProvideService(cfg *setting.Cfg, sqlStore *sqlstore.SQLStore, mode string) (FileStorage, error) {
	var wrappedFileStorage FileStorage
	if mode == "db" {
		wrappedFileStorage = &dbFileStorage{
			db:  sqlStore,
			log: log.New("dbFileStorage"),
		}
	} else if mode == "mem" {
		bucket, err := blob.OpenBucket(context.Background(), "mem://")
		if err != nil {
			return nil, err
		}

		wrappedFileStorage = &cdkBlobStorage{
			log:        log.New("cdkBlobStorage"),
			bucket:     bucket,
			rootFolder: Delimiter,
		}
	} else if mode == "localfs" {
		bucket, err := blob.OpenBucket(context.Background(), "file://./test_fs")
		if err != nil {
			return nil, err
		}

		wrappedFileStorage = &cdkBlobStorage{
			log:        log.New("cdkBlobStorage"),
			bucket:     bucket,
			rootFolder: "",
		}
	}

	return &baseFilestorageService{
		wrapped: wrappedFileStorage,
		log:     log.New("baseFileStorage"),
	}, nil
}
