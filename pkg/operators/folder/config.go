package folder

import (
	"fmt"

	"github.com/grafana/authlib/authn"
	"github.com/prometheus/client_golang/prometheus"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/util/flowcontrol"

	dashv1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1"
	"github.com/grafana/grafana/pkg/clientauth"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// buildDynamicClient builds a dynamic client for the folder apiserver from
// [operator] and [grpc_client_authentication] settings:
//
// [operator]
// folders_server_url =
// tls_insecure =
// [grpc_client_authentication]
// token =
// token_exchange_url =
func buildDynamicClient(cfg *setting.Cfg) (dynamic.Interface, error) {
	operatorSec := cfg.SectionWithEnvOverrides("operator")

	serverURL := operatorSec.Key("folders_server_url").String()
	if serverURL == "" {
		return nil, fmt.Errorf("folders_server_url is required in [operator] section")
	}

	tlsConfig := rest.TLSClientConfig{
		Insecure: operatorSec.Key("tls_insecure").MustBool(false),
	}

	tokenExchangeClient, err := buildTokenExchangeClient(cfg)
	if err != nil {
		return nil, fmt.Errorf("failed to create token exchange client: %w", err)
	}

	restConfig := &rest.Config{
		APIPath: "/apis",
		Host:    serverURL,
		WrapTransport: clientauth.NewStaticTokenExchangeTransportWrapper(
			tokenExchangeClient,
			folderGVR.Group,
			clientauth.WildcardNamespace,
		),
		TLSClientConfig: tlsConfig,
		RateLimiter:     flowcontrol.NewFakeAlwaysRateLimiter(),
	}

	dynClient, err := dynamic.NewForConfig(restConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to create dynamic client: %w", err)
	}

	return dynClient, nil
}

// buildDashboardDynamicClient builds a dynamic client for the dashboard apiserver, used by the
// cascade delete controller to remove a folder's direct dashboard children:
//
// [operator]
// dashboards_server_url =
//
// PoC shortcut: unlike pkg/operators/provisioning's equivalent (which requires
// dashboards_server_url), this returns a nil client -- rather than an error -- when unset, so the
// folder operator can still run with cascade delete limited to subfolders. This mirrors
// cascadeDeleteStorage's and CascadeDeleteController's existing tolerance of a nil dashboard client.
func buildDashboardDynamicClient(cfg *setting.Cfg) (dynamic.Interface, error) {
	operatorSec := cfg.SectionWithEnvOverrides("operator")

	serverURL := operatorSec.Key("dashboards_server_url").String()
	if serverURL == "" {
		return nil, nil
	}

	tlsConfig := rest.TLSClientConfig{
		Insecure: operatorSec.Key("tls_insecure").MustBool(false),
	}

	tokenExchangeClient, err := buildTokenExchangeClient(cfg)
	if err != nil {
		return nil, fmt.Errorf("failed to create token exchange client: %w", err)
	}

	restConfig := &rest.Config{
		APIPath: "/apis",
		Host:    serverURL,
		WrapTransport: clientauth.NewStaticTokenExchangeTransportWrapper(
			tokenExchangeClient,
			dashv1.DashboardResourceInfo.GroupVersionResource().Group,
			clientauth.WildcardNamespace,
		),
		TLSClientConfig: tlsConfig,
		RateLimiter:     flowcontrol.NewFakeAlwaysRateLimiter(),
	}

	dynClient, err := dynamic.NewForConfig(restConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to create dashboard dynamic client: %w", err)
	}

	return dynClient, nil
}

// buildResourceIndexClient connects to unified storage's search/index gRPC service, used by the
// cascade delete controller to enumerate a folder's direct children (subfolders and dashboards) --
// the same role resourcepb.ResourceIndexClient plays for FolderAPIBuilder inside the apiserver
// (pkg/registry/apis/folders/register.go). Trimmed down from
// pkg/operators/provisioning's setupUnifiedStorageClient to just what the controller needs.
//
// [unified_storage]
// grpc_address =
// grpc_index_address =
// allow_insecure =
// audiences =
// [grpc_client_authentication]
// token =
// token_exchange_url =
// token_namespace =
//
// PoC shortcut: uses a no-op tracer rather than wiring the full [tracing] config that
// pkg/operators/provisioning.ControllerConfig.Tracer() does, so search calls issued by the
// controller are untraced.
func buildResourceIndexClient(cfg *setting.Cfg) (resourcepb.ResourceIndexClient, error) {
	unifiedStorageSec := cfg.SectionWithEnvOverrides("unified_storage")
	address := unifiedStorageSec.Key("grpc_address").String()
	if address == "" {
		return nil, fmt.Errorf("grpc_address is required in [unified_storage] section")
	}

	registry := prometheus.NewPedanticRegistry()
	conn, err := unified.GrpcConn(address, registry)
	if err != nil {
		return nil, fmt.Errorf("create unified storage gRPC connection: %w", err)
	}

	indexConn := conn
	if indexAddress := unifiedStorageSec.Key("grpc_index_address").String(); indexAddress != "" {
		indexRegistry := prometheus.NewPedanticRegistry()
		indexConn, err = unified.GrpcConn(indexAddress, indexRegistry)
		if err != nil {
			return nil, fmt.Errorf("create unified storage index gRPC connection: %w", err)
		}
	}

	gRPCAuth := cfg.SectionWithEnvOverrides("grpc_client_authentication")
	resourceClientCfg := resource.RemoteResourceClientConfig{
		Token:            gRPCAuth.Key("token").String(),
		TokenExchangeURL: gRPCAuth.Key("token_exchange_url").String(),
		Namespace:        gRPCAuth.Key("token_namespace").String(),
		AllowInsecure:    unifiedStorageSec.Key("allow_insecure").MustBool(false),
		Audiences:        unifiedStorageSec.Key("audiences").Strings("|"),
	}

	client, err := resource.NewRemoteResourceClient(tracing.NewNoopTracerService(), conn, indexConn, resourceClientCfg)
	if err != nil {
		return nil, fmt.Errorf("create unified storage client: %w", err)
	}
	return client, nil
}

func buildTokenExchangeClient(cfg *setting.Cfg) (*authn.TokenExchangeClient, error) {
	gRPCAuth := cfg.SectionWithEnvOverrides("grpc_client_authentication")

	token := gRPCAuth.Key("token").String()
	if token == "" {
		return nil, fmt.Errorf("token is required in [grpc_client_authentication] section")
	}
	tokenExchangeURL := gRPCAuth.Key("token_exchange_url").String()
	if tokenExchangeURL == "" {
		return nil, fmt.Errorf("token_exchange_url is required in [grpc_client_authentication] section")
	}

	return authn.NewTokenExchangeClient(authn.TokenExchangeConfig{
		TokenExchangeURL: tokenExchangeURL,
		Token:            token,
	})
}
