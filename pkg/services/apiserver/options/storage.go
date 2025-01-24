package options

import (
	"fmt"
	"net"

	"github.com/spf13/pflag"
	"go.opentelemetry.io/contrib/instrumentation/google.golang.org/grpc/otelgrpc"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	genericapiserver "k8s.io/apiserver/pkg/server"
	"k8s.io/apiserver/pkg/server/options"

	"github.com/grafana/authlib/authn"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/apistore"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

type StorageType string

const (
	StorageTypeFile        StorageType = "file"
	StorageTypeEtcd        StorageType = "etcd"
	StorageTypeUnified     StorageType = "unified"
	StorageTypeUnifiedGrpc StorageType = "unified-grpc"

	// Deprecated: legacy is a shim that is no longer necessary
	StorageTypeLegacy StorageType = "legacy"
)

type StorageOptions struct {
	// The desired storage type
	StorageType StorageType

	// For unified-grpc
	Address          string
	GrpcToken        string
	TokenExchangeURL string
	TokenNamespace   string
	AllowInsecure    bool

	// For file storage, this is the requested path
	DataPath string

	// Optional blob storage connection string
	// file:///path/to/dir
	// gs://my-bucket (using default credentials)
	// s3://my-bucket?region=us-west-1 (using default credentials)
	// azblob://my-container
	BlobStoreURL string

	// {resource}.{group} = 1|2|3|4
	UnifiedStorageConfig map[string]setting.UnifiedStorageConfig
}

func NewStorageOptions() *StorageOptions {
	return &StorageOptions{
		StorageType:    StorageTypeUnified,
		Address:        "localhost:10000",
		TokenNamespace: "*",
		AllowInsecure:  false,
	}
}

func (o *StorageOptions) AddFlags(fs *pflag.FlagSet) {
	fs.StringVar((*string)(&o.StorageType), "grafana-apiserver-storage-type", string(o.StorageType), "Storage type")
	fs.StringVar(&o.DataPath, "grafana-apiserver-storage-path", o.DataPath, "Storage path for file storage")
	fs.StringVar(&o.Address, "grafana-apiserver-storage-address", o.Address, "Remote grpc address endpoint")
	fs.StringVar(&o.GrpcToken, "grafana-apiserver-storage-token", o.GrpcToken, "Token for grpc client")
	fs.StringVar(&o.TokenExchangeURL, "grafana-apiserver-storage-token-exchange-url", o.TokenExchangeURL, "Token exchange url for grpc client")
	fs.StringVar(&o.TokenNamespace, "grafana-apiserver-storage-token-namespace", o.TokenNamespace, "Token namespace for grpc client")
	fs.BoolVar(&o.AllowInsecure, "grafana-apiserver-storage-allow-insecure", o.AllowInsecure, "Allow insecure grpc connections")
}

func (o *StorageOptions) Validate() []error {
	errs := []error{}
	switch o.StorageType {
	// nolint:staticcheck
	case StorageTypeLegacy:
		// no-op
	case StorageTypeFile, StorageTypeEtcd, StorageTypeUnified, StorageTypeUnifiedGrpc:
		// no-op
	default:
		// nolint:staticcheck
		errs = append(errs, fmt.Errorf("--grafana-apiserver-storage-type must be one of %s, %s, %s, %s, %s", StorageTypeFile, StorageTypeEtcd, StorageTypeLegacy, StorageTypeUnified, StorageTypeUnifiedGrpc))
	}

	if _, _, err := net.SplitHostPort(o.Address); err != nil {
		errs = append(errs, fmt.Errorf("--grafana-apiserver-storage-address must be a valid network address: %v", err))
	}

	// Only works for single tenant grafana right now
	if o.BlobStoreURL != "" && o.StorageType != StorageTypeUnified {
		errs = append(errs, fmt.Errorf("blob storage is only valid with unified storage"))
	}
	if o.StorageType == StorageTypeUnifiedGrpc {
		if o.GrpcToken == "" {
			errs = append(errs, fmt.Errorf("grpc token is required for unified-grpc storage"))
		}
		if o.TokenExchangeURL == "" {
			errs = append(errs, fmt.Errorf("grpc token exchange url is required for unified-grpc storage"))
		}
		if o.TokenNamespace == "" {
			errs = append(errs, fmt.Errorf("grpc token namespace is required for unified-grpc storage"))
		}
	}
	return errs
}

func (o *StorageOptions) ApplyTo(serverConfig *genericapiserver.RecommendedConfig, etcdOptions *options.EtcdOptions, tracer tracing.Tracer) error {
	if o.StorageType != StorageTypeUnifiedGrpc {
		return nil
	}
	conn, err := grpc.NewClient(o.Address,
		grpc.WithStatsHandler(otelgrpc.NewClientHandler()),
		grpc.WithTransportCredentials(insecure.NewCredentials()),
	)
	if err != nil {
		return err
	}
	authCfg := authn.GrpcClientConfig{
		TokenClientConfig: &authn.TokenExchangeConfig{
			Token:            o.GrpcToken,
			TokenExchangeURL: o.TokenExchangeURL,
		},
		TokenRequest: &authn.TokenExchangeRequest{
			Audiences: []string{"resourceStore"},
			Namespace: o.TokenNamespace,
		},
	}
	unified, err := resource.NewCloudResourceClient(tracer, conn, authCfg, o.AllowInsecure)
	if err != nil {
		return err
	}
	getter := apistore.NewRESTOptionsGetterForClient(unified, etcdOptions.StorageConfig)
	serverConfig.RESTOptionsGetter = getter
	return nil
}

// EnforceFeatureToggleAfterMode1 makes sure there is a feature toggle set for resources with DualWriterMode > 1.
// This is needed to ensure that we use the K8s client before enabling dual writing.
func (o *StorageOptions) EnforceFeatureToggleAfterMode1(features featuremgmt.FeatureToggles) error {
	// nolint:staticcheck
	if o.StorageType != StorageTypeLegacy {
		for rg, s := range o.UnifiedStorageConfig {
			if s.DualWriterMode > 1 {
				switch rg {
				case "playlists.playlist.grafana.app":
					if !features.IsEnabledGlobally(featuremgmt.FlagKubernetesPlaylists) {
						return fmt.Errorf("feature toggle FlagKubernetesPlaylists to be set")
					}
				}
			}
		}
	}
	return nil
}
