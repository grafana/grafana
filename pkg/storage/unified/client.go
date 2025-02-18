package unified

import (
	"context"
	"fmt"
	"path/filepath"

	"github.com/prometheus/client_golang/prometheus"
	"go.opentelemetry.io/contrib/instrumentation/google.golang.org/grpc/otelgrpc"
	"gocloud.dev/blob/fileblob"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"

	authnlib "github.com/grafana/authlib/authn"
	"github.com/grafana/authlib/types"

	infraDB "github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/apiserver/options"
	"github.com/grafana/grafana/pkg/services/authn/grpcutils"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/storage/unified/federated"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/search"
	"github.com/grafana/grafana/pkg/storage/unified/sql"
)

const resourceStoreAudience = "resourceStore"

type Options struct {
	Cfg      *setting.Cfg
	Features featuremgmt.FeatureToggles
	DB       infraDB.DB
	Tracer   tracing.Tracer
	Reg      prometheus.Registerer
	Authzc   types.AccessClient
	Docs     resource.DocumentBuilderSupplier
}

// This adds a UnifiedStorage client into the wire dependency tree
func ProvideUnifiedStorageClient(opts *Options) (resource.ResourceClient, error) {
	// See: apiserver.ApplyGrafanaConfig(cfg, features, o)
	apiserverCfg := opts.Cfg.SectionWithEnvOverrides("grafana-apiserver")
	client, err := newClient(options.StorageOptions{
		StorageType:  options.StorageType(apiserverCfg.Key("storage_type").MustString(string(options.StorageTypeUnified))),
		DataPath:     apiserverCfg.Key("storage_path").MustString(filepath.Join(opts.Cfg.DataPath, "grafana-apiserver")),
		Address:      apiserverCfg.Key("address").MustString(""), // client address
		BlobStoreURL: apiserverCfg.Key("blob_url").MustString(""),
	}, opts.Cfg, opts.Features, opts.DB, opts.Tracer, opts.Reg, opts.Authzc, opts.Docs)
	if err == nil {
		// Used to get the folder stats
		client = federated.NewFederatedClient(
			client, // The original
			legacysql.NewDatabaseProvider(opts.DB),
		)
	}

	return client, err
}

func newClient(opts options.StorageOptions,
	cfg *setting.Cfg,
	features featuremgmt.FeatureToggles,
	db infraDB.DB,
	tracer tracing.Tracer,
	reg prometheus.Registerer,
	authzc types.AccessClient,
	docs resource.DocumentBuilderSupplier,
) (resource.ResourceClient, error) {
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
			Blob: resource.BlobConfig{
				URL: opts.BlobStoreURL,
			},
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

		// Create a client instance
		client, err := newResourceClient(conn, cfg, features, tracer)
		if err != nil {
			return nil, err
		}
		return client, nil

	// Use the local SQL
	default:
		searchOptions, err := search.NewSearchOptions(features, cfg, tracer, docs, reg)
		if err != nil {
			return nil, err
		}
		server, err := sql.NewResourceServer(db, cfg, tracer, reg, authzc, searchOptions)
		if err != nil {
			return nil, err
		}
		return resource.NewLocalResourceClient(server), nil
	}
}

func clientCfgMapping(clientCfg *grpcutils.GrpcClientConfig) authnlib.GrpcClientConfig {
	return authnlib.GrpcClientConfig{
		TokenClientConfig: &authnlib.TokenExchangeConfig{
			Token:            clientCfg.Token,
			TokenExchangeURL: clientCfg.TokenExchangeURL,
		},
		TokenRequest: &authnlib.TokenExchangeRequest{
			Namespace: clientCfg.TokenNamespace,
			Audiences: []string{resourceStoreAudience},
		},
	}
}

func newResourceClient(conn *grpc.ClientConn, cfg *setting.Cfg, features featuremgmt.FeatureToggles, tracer tracing.Tracer) (resource.ResourceClient, error) {
	if !features.IsEnabledGlobally(featuremgmt.FlagAppPlatformGrpcClientAuth) {
		return resource.NewLegacyResourceClient(conn), nil
	}
	return resource.NewRemoteResourceClient(tracer, conn, clientCfgMapping(grpcutils.ReadGrpcClientConfig(cfg)), cfg.Env == setting.Dev)
}
