package provisioning

import (
	"fmt"

	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/prometheus/client_golang/prometheus"
)

// HACK: This logic directly connects to unified storage. We are doing this for now as there is no global
// search endpoint. But controllers, in general, should not connect directly to unified storage and instead
// go through the api server. Once there is a global search endpoint, we will switch to that here as well.
// expects:
// [grpc_client_authentication]
// token =
// token_exchange_url =
// token_namespace =
// audiences =
// [unified_storage]
// grpc_address =
// grpc_index_address =
// allow_insecure =
func setupUnifiedStorageClient(cfg *setting.Cfg, tracer tracing.Tracer) (resources.ResourceStore, error) {
	unifiedStorageSec := cfg.SectionWithEnvOverrides("unified_storage")

	// Connect to Server
	address := unifiedStorageSec.Key("grpc_address").String()
	if address == "" {
		return nil, fmt.Errorf("grpc_address is required in [unified_storage] section")
	}
	registry := prometheus.NewPedanticRegistry()
	conn, err := unified.GrpcConn(address, registry)
	if err != nil {
		return nil, fmt.Errorf("create unified storage gRPC connection: %w", err)
	}

	// Connect to Index
	indexAddress := unifiedStorageSec.Key("grpc_index_address").String()
	if indexAddress == "" {
		indexAddress = address
	}
	indexConn, err := unified.GrpcConn(indexAddress, registry)
	if err != nil {
		return nil, fmt.Errorf("create unified storage index gRPC connection: %w", err)
	}

	// Create client
	gRPCAuth := cfg.SectionWithEnvOverrides("grpc_client_authentication")
	if gRPCAuth == nil {
		return nil, fmt.Errorf("missing [grpc_client_authentication] section in config")
	}
	token := gRPCAuth.Key("token").String()
	if token == "" {
		return nil, fmt.Errorf("token is required in [grpc_client_authentication] section")
	}

	tokenExchangeURL := gRPCAuth.Key("token_exchange_url").String()
	if tokenExchangeURL == "" {
		return nil, fmt.Errorf("token_exchange_url is required in [grpc_client_authentication] section")
	}

	tokenNamespace := gRPCAuth.Key("token_namespace").String()
	allowInsecure := gRPCAuth.Key("allow_insecure").MustBool(false)
	audiences := gRPCAuth.Key("audiences").Strings("|")
	unifiedCfg := resource.RemoteResourceClientConfig{
		Token:            token,
		TokenExchangeURL: tokenExchangeURL,
		Audiences:        audiences,
		Namespace:        tokenNamespace,
		AllowInsecure:    allowInsecure,
	}

	client, err := resource.NewRemoteResourceClient(tracer, conn, indexConn, unifiedCfg)
	if err != nil {
		return nil, fmt.Errorf("create unified storage client: %w", err)
	}

	return client, nil
}
