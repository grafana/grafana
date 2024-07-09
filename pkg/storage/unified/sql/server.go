package sql

import (
	"context"
	"os"
	"path/filepath"
	"time"

	"gocloud.dev/blob/fileblob"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/sql/db/dbimpl"
)

// Creates a ResourceServer
func ProvideResourceServer(db db.DB, cfg *setting.Cfg, features featuremgmt.FeatureToggles, tracer tracing.Tracer) (resource.ResourceServer, error) {
	opts := resource.ResourceServerOptions{
		Tracer: tracer,
	}

	supportBlobs := true

	// Create a local blob filesystem blob store
	if supportBlobs {
		dir := filepath.Join(cfg.DataPath, "unistore", "blobs")
		if err := os.MkdirAll(dir, 0o750); err != nil {
			return nil, err
		}

		bucket, err := fileblob.OpenBucket(dir, &fileblob.Options{
			CreateDir: true,
			Metadata:  fileblob.MetadataDontWrite, // skip
		})
		if err != nil {
			return nil, err
		}
		opts.Blob, err = resource.NewCDKBlobStore(context.Background(), resource.CDKBlobStoreOptions{
			Tracer:        tracer,
			Bucket:        bucket,
			URLExpiration: time.Minute * 20,
		})
		if err != nil {
			return nil, err
		}
	}

	eDB, err := dbimpl.ProvideResourceDB(db, cfg, features, tracer)
	if err != nil {
		return nil, err
	}
	store, err := NewBackendStore(backendOptions{DB: eDB, Tracer: tracer})
	if err != nil {
		return nil, err
	}
	opts.Backend = store
	opts.Diagnostics = store
	opts.Lifecycle = store

	return resource.NewResourceServer(opts)
}
