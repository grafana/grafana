package provisioning

import (
	"context"
	"crypto/x509"
	"fmt"
	"net/http"
	"os"
	"time"

	"github.com/grafana/authlib/authn"
	"github.com/prometheus/client_golang/prometheus"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/transport"

	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/apiserver"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified"
	"github.com/grafana/grafana/pkg/storage/unified/resource"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	authrt "github.com/grafana/grafana/apps/provisioning/pkg/auth"
	client "github.com/grafana/grafana/apps/provisioning/pkg/generated/clientset/versioned"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository/github"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository/local"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	secretdecrypt "github.com/grafana/grafana/pkg/registry/apis/secret/decrypt"
)

// provisioningControllerConfig contains the configuration that overlaps for the jobs and repo controllers
type provisioningControllerConfig struct {
	provisioningClient *client.Clientset
	resyncInterval     time.Duration
	repoFactory        repository.Factory
	unified            resources.ResourceStore
	clients            resources.ClientFactory
}

// expects:
// [grpc_client_authentication]
// token =
// token_exchange_url =
// [secrets_manager]
// grpc_server_address =
// grpc_server_tls_server_name =
// grpc_server_use_tls =
// grpc_server_tls_ca_file =
// grpc_server_tls_skip_verify =
// [unified_storage]
// grpc_address =
// grpc_index_address =
// allow_insecure =
// audiences =
// [operator]
// provisioning_server_url =
// dashboards_server_url =
// folders_server_url =
// tls_insecure =
// tls_cert_file =
// tls_key_file =
// tls_ca_file =
// resync_interval =
// repository_types =
// home_path =
// local_permitted_prefixes =
func setupFromConfig(cfg *setting.Cfg) (controllerCfg *provisioningControllerConfig, err error) {
	if cfg == nil {
		return nil, fmt.Errorf("no configuration available")
	}
	// TODO: we should setup tracing properly
	// https://github.com/grafana/git-ui-sync-project/issues/507
	tracer := tracing.NewNoopTracerService()

	gRPCAuth := cfg.SectionWithEnvOverrides("grpc_client_authentication")
	token := gRPCAuth.Key("token").String()
	if token == "" {
		return nil, fmt.Errorf("token is required in [grpc_client_authentication] section")
	}
	tokenExchangeURL := gRPCAuth.Key("token_exchange_url").String()
	if tokenExchangeURL == "" {
		return nil, fmt.Errorf("token_exchange_url is required in [grpc_client_authentication] section")
	}

	operatorSec := cfg.SectionWithEnvOverrides("operator")
	provisioningServerURL := operatorSec.Key("provisioning_server_url").String()
	if provisioningServerURL == "" {
		return nil, fmt.Errorf("provisioning_server_url is required in [operator] section")
	}

	tlsInsecure := operatorSec.Key("tls_insecure").MustBool(false)
	tlsCertFile := operatorSec.Key("tls_cert_file").String()
	tlsKeyFile := operatorSec.Key("tls_key_file").String()
	tlsCAFile := operatorSec.Key("tls_ca_file").String()

	tokenExchangeClient, err := authn.NewTokenExchangeClient(authn.TokenExchangeConfig{
		TokenExchangeURL: tokenExchangeURL,
		Token:            token,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create token exchange client: %w", err)
	}

	tlsConfig, err := buildTLSConfig(tlsInsecure, tlsCertFile, tlsKeyFile, tlsCAFile)
	if err != nil {
		return nil, fmt.Errorf("failed to build TLS configuration: %w", err)
	}

	config := &rest.Config{
		APIPath: "/apis",
		Host:    provisioningServerURL,
		WrapTransport: transport.WrapperFunc(func(rt http.RoundTripper) http.RoundTripper {
			return authrt.NewRoundTripper(tokenExchangeClient, rt, provisioning.GROUP)
		}),
		TLSClientConfig: tlsConfig,
	}

	provisioningClient, err := client.NewForConfig(config)
	if err != nil {
		return nil, fmt.Errorf("failed to create provisioning client: %w", err)
	}

	decrypter, err := setupDecrypter(cfg, tracer, tokenExchangeClient)
	if err != nil {
		return nil, fmt.Errorf("failed to setup decrypter: %w", err)
	}

	repoFactory, err := setupRepoFactory(cfg, decrypter, provisioningClient)
	if err != nil {
		return nil, fmt.Errorf("failed to setup repository getter: %w", err)
	}

	// HACK: This logic directly connects to unified storage. We are doing this for now as there is no global
	// search endpoint. But controllers, in general, should not connect directly to unified storage and instead
	// go through the api server. Once there is a global search endpoint, we will switch to that here as well.
	resourceClientCfg := resource.RemoteResourceClientConfig{
		Token:            token,
		TokenExchangeURL: tokenExchangeURL,
		Namespace:        gRPCAuth.Key("token_namespace").String(),
	}
	unified, err := setupUnifiedStorageClient(cfg, tracer, resourceClientCfg)
	if err != nil {
		return nil, fmt.Errorf("failed to setup unified storage: %w", err)
	}

	dashboardsServerURL := operatorSec.Key("dashboards_server_url").String()
	if dashboardsServerURL == "" {
		return nil, fmt.Errorf("dashboards_server_url is required in [operator] section")
	}
	foldersServerURL := operatorSec.Key("folders_server_url").String()
	if foldersServerURL == "" {
		return nil, fmt.Errorf("folders_server_url is required in [operator] section")
	}

	apiServerURLs := map[string]string{
		resources.DashboardResource.Group: dashboardsServerURL,
		resources.FolderResource.Group:    foldersServerURL,
		provisioning.GROUP:                provisioningServerURL,
	}
	configProviders := make(map[string]apiserver.RestConfigProvider)

	for group, url := range apiServerURLs {
		config := &rest.Config{
			APIPath: "/apis",
			Host:    url,
			WrapTransport: transport.WrapperFunc(func(rt http.RoundTripper) http.RoundTripper {
				return authrt.NewRoundTripper(tokenExchangeClient, rt, group)
			}),
			TLSClientConfig: tlsConfig,
		}
		configProviders[group] = NewDirectConfigProvider(config)
	}

	clients := resources.NewClientFactoryForMultipleAPIServers(configProviders)

	return &provisioningControllerConfig{
		provisioningClient: provisioningClient,
		repoFactory:        repoFactory,
		unified:            unified,
		clients:            clients,
		resyncInterval:     operatorSec.Key("resync_interval").MustDuration(60 * time.Second),
	}, nil
}

func buildTLSConfig(insecure bool, certFile, keyFile, caFile string) (rest.TLSClientConfig, error) {
	tlsConfig := rest.TLSClientConfig{
		Insecure: insecure,
	}

	if certFile != "" && keyFile != "" {
		tlsConfig.CertFile = certFile
		tlsConfig.KeyFile = keyFile
	}

	if caFile != "" {
		// caFile is set in operator.ini file
		// nolint:gosec
		caCert, err := os.ReadFile(caFile)
		if err != nil {
			return tlsConfig, fmt.Errorf("failed to read CA certificate file: %w", err)
		}

		caCertPool := x509.NewCertPool()
		if !caCertPool.AppendCertsFromPEM(caCert) {
			return tlsConfig, fmt.Errorf("failed to parse CA certificate")
		}

		tlsConfig.CAData = caCert
	}

	return tlsConfig, nil
}

func setupRepoFactory(
	cfg *setting.Cfg,
	decrypter repository.Decrypter,
	provisioningClient *client.Clientset,
) (repository.Factory, error) {
	operatorSec := cfg.SectionWithEnvOverrides("operator")
	repoTypes := operatorSec.Key("repository_types").Strings("|")

	// TODO: This depends on the different flavor of Grafana
	// https://github.com/grafana/git-ui-sync-project/issues/495
	extras := make([]repository.Extra, 0)
	alreadyRegistered := make(map[provisioning.RepositoryType]struct{})

	for _, t := range repoTypes {
		if _, ok := alreadyRegistered[provisioning.RepositoryType(t)]; ok {
			continue
		}
		alreadyRegistered[provisioning.RepositoryType(t)] = struct{}{}

		switch provisioning.RepositoryType(t) {
		case provisioning.GitHubRepositoryType:
			extras = append(extras, github.Extra(
				decrypter,
				github.ProvideFactory(),
				// TODO: we need to plug the webhook builder here for webhooks to be created in repository controller
				// https://github.com/grafana/git-ui-sync-project/issues/455
				nil,
			),
			)
		case provisioning.LocalRepositoryType:
			homePath := operatorSec.Key("home_path").String()
			if homePath == "" {
				return nil, fmt.Errorf("home_path is required in [operator] section for local repository type")
			}

			permittedPrefixes := operatorSec.Key("local_permitted_prefixes").Strings("|")
			if len(permittedPrefixes) == 0 {
				return nil, fmt.Errorf("local_permitted_prefixes is required in [operator] section for local repository type")
			}

			extras = append(extras, local.Extra(
				homePath,
				permittedPrefixes,
			))
		default:
			return nil, fmt.Errorf("unsupported repository type: %s", t)
		}
	}

	repoFactory, err := repository.ProvideFactory(extras)
	if err != nil {
		return nil, fmt.Errorf("create repository factory: %w", err)
	}

	return repoFactory, nil
}

func setupDecrypter(cfg *setting.Cfg, tracer tracing.Tracer, tokenExchangeClient *authn.TokenExchangeClient) (decrypter repository.Decrypter, err error) {
	secretsSec := cfg.SectionWithEnvOverrides("secrets_manager")
	if secretsSec == nil {
		return nil, fmt.Errorf("no [secrets_manager] section found in config")
	}

	address := secretsSec.Key("grpc_server_address").String()
	if address == "" {
		return nil, fmt.Errorf("grpc_server_address is required in [secrets_manager] section")
	}

	secretsTls := secretdecrypt.TLSConfig{
		UseTLS:             secretsSec.Key("grpc_server_use_tls").MustBool(true),
		CAFile:             secretsSec.Key("grpc_server_tls_ca_file").String(),
		ServerName:         secretsSec.Key("grpc_server_tls_server_name").String(),
		InsecureSkipVerify: secretsSec.Key("grpc_server_tls_skip_verify").MustBool(false),
	}

	decryptSvc, err := secretdecrypt.NewGRPCDecryptClientWithTLS(
		tokenExchangeClient,
		tracer,
		address,
		secretsTls,
	)
	if err != nil {
		return nil, fmt.Errorf("create decrypt service: %w", err)
	}

	return repository.ProvideDecrypter(decryptSvc), nil
}

// HACK: This logic directly connects to unified storage. We are doing this for now as there is no global
// search endpoint. But controllers, in general, should not connect directly to unified storage and instead
// go through the api server. Once there is a global search endpoint, we will switch to that here as well.
func setupUnifiedStorageClient(cfg *setting.Cfg, tracer tracing.Tracer, resourceClientCfg resource.RemoteResourceClientConfig) (resources.ResourceStore, error) {
	unifiedStorageSec := cfg.SectionWithEnvOverrides("unified_storage")
	// Connect to Server
	address := unifiedStorageSec.Key("grpc_address").String()
	if address == "" {
		return nil, fmt.Errorf("grpc_address is required in [unified_storage] section")
	}
	// FIXME: These metrics are not going to show up in /metrics
	registry := prometheus.NewPedanticRegistry()
	conn, err := unified.GrpcConn(address, registry)
	if err != nil {
		return nil, fmt.Errorf("create unified storage gRPC connection: %w", err)
	}

	// Connect to Index
	indexConn := conn
	indexAddress := unifiedStorageSec.Key("grpc_index_address").String()
	if indexAddress != "" {
		// FIXME: These metrics are not going to show up in /metrics. We will also need to wrap these metrics
		// to start with something else so it doesn't collide with the storage api metrics.
		registry2 := prometheus.NewPedanticRegistry()
		indexConn, err = unified.GrpcConn(indexAddress, registry2)
		if err != nil {
			return nil, fmt.Errorf("create unified storage index gRPC connection: %w", err)
		}
	}

	// Create client
	resourceClientCfg.AllowInsecure = unifiedStorageSec.Key("allow_insecure").MustBool(false)
	resourceClientCfg.Audiences = unifiedStorageSec.Key("audiences").Strings("|")

	client, err := resource.NewRemoteResourceClient(tracer, conn, indexConn, resourceClientCfg)
	if err != nil {
		return nil, fmt.Errorf("create unified storage client: %w", err)
	}

	return client, nil
}

// directConfigProvider is a simple RestConfigProvider that always returns the same rest.Config
// it implements apiserver.RestConfigProvider
type directConfigProvider struct {
	cfg *rest.Config
}

func NewDirectConfigProvider(cfg *rest.Config) apiserver.RestConfigProvider {
	return &directConfigProvider{cfg: cfg}
}

func (r *directConfigProvider) GetRestConfig(ctx context.Context) (*rest.Config, error) {
	return r.cfg, nil
}
