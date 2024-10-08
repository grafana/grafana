package unified

import (
	"context"
	"fmt"
	"path/filepath"

	infraDB "github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/apiserver/options"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/sql"
	"go.opentelemetry.io/contrib/instrumentation/google.golang.org/grpc/otelgrpc"
	"gocloud.dev/blob/fileblob"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
)

// This adds a UnifiedStorage client into the wire dependency tree
func ProvideUnifiedStorageClient(
	cfg *setting.Cfg,
	features featuremgmt.FeatureToggles,
	db infraDB.DB,
	tracer tracing.Tracer,
) (resource.ResourceClient, error) {
	// See: apiserver.ApplyGrafanaConfig(cfg, features, o)
	apiserverCfg := cfg.SectionWithEnvOverrides("grafana-apiserver")
	opts := options.StorageOptions{
		StorageType: options.StorageType(apiserverCfg.Key("storage_type").MustString(string(options.StorageTypeLegacy))),
		DataPath:    apiserverCfg.Key("storage_path").MustString(filepath.Join(cfg.DataPath, "grafana-apiserver")),
		Address:     apiserverCfg.Key("address").MustString(""),
	}
	ctx := context.Background()

	switch opts.StorageType {
	case options.StorageTypeFile:
		if opts.DataPath == "" {
			opts.DataPath = filepath.Join(cfg.DataPath, "grafana-apiserver")
		}
		bucket, err := fileblob.OpenBucket(filepath.Join(opts.DataPath, "resource"), &fileblob.Options{
			CreateDir: true,
			Metadata:  fileblob.MetadataDontWrite, // skip
		})
		if err != nil {
			return nil, err
		}
		backend, err := resource.NewCDKBackend(ctx, resource.CDKBackendOptions{
			Bucket: bucket,
		})
		if err != nil {
			return nil, err
		}
		server, err := resource.NewResourceServer(resource.ResourceServerOptions{
			Backend: backend,
		})
		if err != nil {
			return nil, err
		}
		return resource.NewLocalResourceClient(server), nil

	case options.StorageTypeUnifiedGrpc:
		if opts.Address == "" {
			return nil, fmt.Errorf("expecting address for storage_type: %s", opts.StorageType)
		}

		// Create a connection to the gRPC server
		conn, err := grpc.NewClient(opts.Address,
			grpc.WithStatsHandler(otelgrpc.NewClientHandler()),
			grpc.WithTransportCredentials(insecure.NewCredentials()),
		)
		if err != nil {
			return nil, err
		}
		return resource.NewResourceClient(conn), nil

	// Use the local SQL
	default:
		server, err := sql.NewResourceServer(ctx, db, cfg, features, tracer)
		if err != nil {
			return nil, err
		}
		return resource.NewLocalResourceClient(server), nil
	}
}
