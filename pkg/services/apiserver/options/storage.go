package options

import (
	"context"
	"fmt"
	"net"

	"github.com/grafana/grafana/pkg/services/authz/zanzana"
	"github.com/spf13/pflag"
	"go.opentelemetry.io/contrib/instrumentation/google.golang.org/grpc/otelgrpc"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	genericapiserver "k8s.io/apiserver/pkg/server"
	"k8s.io/apiserver/pkg/server/options"
	"k8s.io/client-go/rest"

	"github.com/grafana/grafana/pkg/infra/tracing"
	secret "github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	inlinesecurevalue "github.com/grafana/grafana/pkg/registry/apis/secret/inline"
	"github.com/grafana/grafana/pkg/services/authn/grpcutils"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/apistore"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

type StorageType string

const (
	StorageTypeFile          StorageType = "file"
	StorageTypeEtcd          StorageType = "etcd"
	StorageTypeUnified       StorageType = "unified"
	StorageTypeUnifiedGrpc   StorageType = "unified-grpc"
	StorageTypeUnifiedKVGrpc StorageType = "unified-kv-grpc"

	// Deprecated: legacy is a shim that is no longer necessary
	StorageTypeLegacy StorageType = "legacy"

	BlobThresholdDefault int = 0
)

type RestConfigProvider interface {
	GetRestConfig(context.Context) (*rest.Config, error)
}

type StorageOptions struct {
	// The desired storage type
	StorageType StorageType

	// For unified-grpc
	Address                                  string
	SearchServerAddress                      string
	GrpcClientAuthenticationToken            string
	GrpcClientAuthenticationTokenExchangeURL string
	GrpcClientAuthenticationTokenNamespace   string
	GrpcClientAuthenticationAllowInsecure    bool

	// Secrets Manager Configuration for InlineSecureValueSupport
	SecretsManagerGrpcClientEnable        bool
	SecretsManagerGrpcServerAddress       string
	SecretsManagerGrpcServerUseTLS        bool
	SecretsManagerGrpcServerTLSSkipVerify bool
	SecretsManagerGrpcServerTLSServerName string
	SecretsManagerGrpcServerTLSCAFile     string

	// For file storage, this is the requested path
	DataPath string

	// Optional blob storage connection string
	// file:///path/to/dir
	// gs://my-bucket (using default credentials)
	// s3://my-bucket?region=us-west-1 (using default credentials)
	// azblob://my-container
	BlobStoreURL string
	// Optional blob storage field. When an object's size in bytes exceeds the threshold
	// value, it is considered large and gets partially stored in blob storage.
	BlobThresholdBytes int

	// Support writing secrets inline
	InlineSecrets secret.InlineSecureValueSupport

	// {resource}.{group} = 1|2|3|4
	UnifiedStorageConfig map[string]setting.UnifiedStorageConfig

	// Access to the other clients
	ConfigProvider RestConfigProvider
	zanzanaClient  zanzana.Client
}

func NewStorageOptions(zanzanaClient zanzana.Client) *StorageOptions {
	return &StorageOptions{
		StorageType:                            StorageTypeUnified,
		Address:                                "localhost:10000",
		GrpcClientAuthenticationTokenNamespace: "*",
		GrpcClientAuthenticationAllowInsecure:  false,
		BlobThresholdBytes:                     BlobThresholdDefault,
		zanzanaClient:                          zanzanaClient,
	}
}

func (o *StorageOptions) AddFlags(fs *pflag.FlagSet) {
	fs.StringVar((*string)(&o.StorageType), "grafana-apiserver-storage-type", string(o.StorageType), "Storage type")
	fs.StringVar(&o.DataPath, "grafana-apiserver-storage-path", o.DataPath, "Storage path for file storage")
	fs.StringVar(&o.Address, "grafana-apiserver-storage-address", o.Address, "Remote grpc address endpoint")
	fs.StringVar(&o.GrpcClientAuthenticationToken, "grpc-client-authentication-token", o.GrpcClientAuthenticationToken, "Token for grpc client authentication")
	fs.StringVar(&o.GrpcClientAuthenticationTokenExchangeURL, "grpc-client-authentication-token-exchange-url", o.GrpcClientAuthenticationTokenExchangeURL, "Token exchange url for grpc client authentication")
	fs.StringVar(&o.GrpcClientAuthenticationTokenNamespace, "grpc-client-authentication-token-namespace", o.GrpcClientAuthenticationTokenNamespace, "Token namespace for grpc client authentication")
	fs.BoolVar(&o.GrpcClientAuthenticationAllowInsecure, "grpc-client-authentication-allow-insecure", o.GrpcClientAuthenticationAllowInsecure, "Allow insecure grpc client authentication")

	// Secrets Manager Configuration flags
	fs.BoolVar(&o.SecretsManagerGrpcClientEnable, "grafana.secrets-manager.grpc-client-enable", false, "Enable gRPC client for secrets manager")
	fs.StringVar(&o.SecretsManagerGrpcServerAddress, "grafana.secrets-manager.grpc-server-address", "", "gRPC server address for secrets manager")
	fs.BoolVar(&o.SecretsManagerGrpcServerUseTLS, "grafana.secrets-manager.grpc-server-use-tls", false, "Use TLS for gRPC server communication")
	fs.BoolVar(&o.SecretsManagerGrpcServerTLSSkipVerify, "grafana.secrets-manager.grpc-server-tls-skip-verify", false, "Skip TLS verification for gRPC server")
	fs.StringVar(&o.SecretsManagerGrpcServerTLSServerName, "grafana.secrets-manager.grpc-server-tls-server-name", "", "Server name for TLS verification")
	fs.StringVar(&o.SecretsManagerGrpcServerTLSCAFile, "grafana.secrets-manager.grpc-server-tls-ca-file", "", "CA file for TLS verification")
}

func (o *StorageOptions) Validate() []error {
	errs := []error{}
	switch o.StorageType {
	// nolint:staticcheck
	case StorageTypeLegacy:
		// no-op
	case StorageTypeUnifiedKVGrpc:
		// no-op (enterprise only)
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

	// Validate grpc client with auth
	if o.StorageType == StorageTypeUnifiedGrpc && o.GrpcClientAuthenticationToken != "" {
		if o.GrpcClientAuthenticationToken == "" {
			errs = append(errs, fmt.Errorf("grpc client auth token is required for unified-grpc storage"))
		}
		if o.GrpcClientAuthenticationTokenExchangeURL == "" {
			errs = append(errs, fmt.Errorf("grpc client auth token exchange url is required for unified-grpc storage"))
		}
		if o.GrpcClientAuthenticationTokenNamespace == "" {
			errs = append(errs, fmt.Errorf("grpc client auth namespace is required for unified-grpc storage"))
		}
	}

	if o.SecretsManagerGrpcClientEnable {
		if o.SecretsManagerGrpcServerAddress == "" {
			errs = append(errs, fmt.Errorf("secrets manager grpc server address is required for secrets manager grpc client"))
		}
		if o.SecretsManagerGrpcServerUseTLS && !o.SecretsManagerGrpcServerTLSSkipVerify && o.SecretsManagerGrpcServerTLSCAFile == "" {
			errs = append(errs, fmt.Errorf("secrets manager grpc server ca file is required for secrets manager grpc client"))
		}
	}
	return errs
}

func (o *StorageOptions) ApplyTo(serverConfig *genericapiserver.RecommendedConfig, etcdOptions *options.EtcdOptions, tracer tracing.Tracer, secureServing *options.SecureServingOptions) error {
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
	var indexConn *grpc.ClientConn
	if o.SearchServerAddress != "" {
		indexConn, err = grpc.NewClient(o.SearchServerAddress,
			grpc.WithStatsHandler(otelgrpc.NewClientHandler()),
			grpc.WithTransportCredentials(insecure.NewCredentials()),
		)
		if err != nil {
			return err
		}
	} else {
		indexConn = conn
	}

	const resourceStoreAudience = "resourceStore"

	unified, err := resource.NewRemoteResourceClient(tracer, conn, indexConn, resource.RemoteResourceClientConfig{
		Token:            o.GrpcClientAuthenticationToken,
		TokenExchangeURL: o.GrpcClientAuthenticationTokenExchangeURL,
		Namespace:        o.GrpcClientAuthenticationTokenNamespace,
		Audiences:        []string{resourceStoreAudience},
	})
	if err != nil {
		return err
	}

	// setup inline secrets if configured
	if o.InlineSecrets == nil && o.SecretsManagerGrpcClientEnable {
		tlsCfg := inlinesecurevalue.TLSConfig{
			UseTLS:             o.SecretsManagerGrpcServerUseTLS,
			CAFile:             o.SecretsManagerGrpcServerTLSCAFile,
			ServerName:         o.SecretsManagerGrpcServerTLSServerName,
			InsecureSkipVerify: o.SecretsManagerGrpcServerTLSSkipVerify,
		}
		inlineSecureValueService, err := inlinesecurevalue.NewGRPCSecureValueService(
			&grpcutils.GrpcClientConfig{
				Token:            o.GrpcClientAuthenticationToken,
				TokenExchangeURL: o.GrpcClientAuthenticationTokenExchangeURL,
				TokenNamespace:   o.GrpcClientAuthenticationTokenNamespace,
			},
			o.SecretsManagerGrpcServerAddress,
			tlsCfg,
			tracer,
		)
		if err != nil {
			return fmt.Errorf("failed to create inline secure value service: %w", err)
		}
		o.InlineSecrets = inlineSecureValueService
	}

	getter := apistore.NewRESTOptionsGetterForClient(unified, o.InlineSecrets, etcdOptions.StorageConfig, o.ConfigProvider, o.zanzanaClient)
	serverConfig.RESTOptionsGetter = getter
	return nil
}
