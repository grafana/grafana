package provisioning

import (
	"context"
	"crypto/x509"
	"fmt"
	"net/http"
	"os"
	"time"

	"github.com/grafana/authlib/authn"
	"github.com/grafana/grafana/apps/secret/pkg/decrypt"
	"github.com/prometheus/client_golang/prometheus"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/util/flowcontrol"

	"github.com/grafana/grafana/pkg/clientauth"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/apiserver"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified"
	"github.com/grafana/grafana/pkg/storage/unified/resource"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/connection"
	githubconnection "github.com/grafana/grafana/apps/provisioning/pkg/connection/github"
	client "github.com/grafana/grafana/apps/provisioning/pkg/generated/clientset/versioned"
	"github.com/grafana/grafana/apps/provisioning/pkg/quotas"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	gitrepo "github.com/grafana/grafana/apps/provisioning/pkg/repository/git"
	githubrepo "github.com/grafana/grafana/apps/provisioning/pkg/repository/github"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository/local"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/controller"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/webhooks"
	secretdecrypt "github.com/grafana/grafana/pkg/registry/apis/secret/decrypt"
)

var registeredConfigOptions = []ConfigOption{}

func RegisterConfigOptions(opts ...ConfigOption) {
	registeredConfigOptions = append(registeredConfigOptions, opts...)
}

type ConfigOption func(ctx context.Context, cfg *ControllerConfig) error

// ControllerConfig contains the configuration that overlaps for the jobs and repo controllers
type ControllerConfig struct {
	Settings              *setting.Cfg
	workerCount           int
	resyncInterval        time.Duration
	provisioningClient    *client.Clientset
	unified               resources.ResourceStore
	clients               resources.ClientFactory
	tokenExchangeClient   *authn.TokenExchangeClient
	tlsConfig             *rest.TLSClientConfig
	decryptService        decrypt.DecryptService
	registry              prometheus.Registerer
	repositoryFactory     repository.Factory
	RepositoryFactoryFunc func() (repository.Factory, error)
	connectionFactory     connection.Factory
	ConnectionFactoryFunc func() (connection.Factory, error)
	healthMetricsRecorder controller.HealthMetricsRecorder
	tracer                tracing.Tracer
	quotaGetter           quotas.QuotaLimitsProvider
	QuotaGetterFunc       func() (quotas.QuotaLimitsProvider, error)
	urlProvider           func(ctx context.Context, namespace string) string
	URLProviderFunc       func() (func(ctx context.Context, namespace string) string, error)
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
// provisioning_server_public_url =
// dashboards_server_url =
// folders_server_url =
// tls_insecure =
// tls_cert_file =
// tls_key_file =
// tls_ca_file =
// resync_interval =
// home_path =
// local_permitted_prefixes =
// [provisioning]
// repository_types =
func setupFromConfig(cfg *setting.Cfg, registry prometheus.Registerer) (*ControllerConfig, error) {
	if cfg == nil {
		return nil, fmt.Errorf("no configuration available")
	}

	operatorSec := cfg.SectionWithEnvOverrides("operator")
	controllerCfg := &ControllerConfig{
		registry:       registry,
		Settings:       cfg,
		resyncInterval: operatorSec.Key("resync_interval").MustDuration(60 * time.Second),
		workerCount:    operatorSec.Key("worker_count").MustInt(1),
	}

	for _, opt := range registeredConfigOptions {
		if err := opt(context.Background(), controllerCfg); err != nil {
			return nil, fmt.Errorf("failed to apply config option: %w", err)
		}
	}

	return controllerCfg, nil
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

// Unified Storage Client
// HACK: This logic directly connects to unified storage. We are doing this for now as there is no global
// search endpoint. But controllers, in general, should not connect directly to unified storage and instead
// go through the api server. Once there is a global search endpoint, we will switch to that here as well.
func (c *ControllerConfig) UnifiedStorageClient() (resources.ResourceStore, error) {
	if c.unified != nil {
		return c.unified, nil
	}

	tracer, err := c.Tracer()
	if err != nil {
		return nil, fmt.Errorf("failed to get tracer: %w", err)
	}

	gRPCAuth := c.Settings.SectionWithEnvOverrides("grpc_client_authentication")
	resourceClientCfg := resource.RemoteResourceClientConfig{
		Token:            gRPCAuth.Key("token").String(),
		TokenExchangeURL: gRPCAuth.Key("token_exchange_url").String(),
		Namespace:        gRPCAuth.Key("token_namespace").String(),
	}
	unified, err := setupUnifiedStorageClient(c.Settings, tracer, resourceClientCfg)
	if err != nil {
		return nil, fmt.Errorf("failed to setup unified storage: %w", err)
	}

	c.unified = unified
	return unified, nil
}

// Clients Clients are clients that are used to connect to the different API servers.
func (c *ControllerConfig) Clients() (resources.ClientFactory, error) {
	if c.clients != nil {
		return c.clients, nil
	}

	operatorSec := c.Settings.SectionWithEnvOverrides("operator")
	tlsConfig, err := c.TLSConfig()
	if err != nil {
		return nil, fmt.Errorf("failed to get TLS configuration: %w", err)
	}

	tokenExchangeClient, err := c.TokenExchangeClient()
	if err != nil {
		return nil, fmt.Errorf("failed to create token exchange client: %w", err)
	}

	dashboardsServerURL := operatorSec.Key("dashboards_server_url").String()
	if dashboardsServerURL == "" {
		return nil, fmt.Errorf("dashboards_server_url is required in [operator] section")
	}
	foldersServerURL := operatorSec.Key("folders_server_url").String()
	if foldersServerURL == "" {
		return nil, fmt.Errorf("folders_server_url is required in [operator] section")
	}
	provisioningServerURL := operatorSec.Key("provisioning_server_url").String()
	apiServerURLs := map[string]string{
		resources.DashboardResource.Group: dashboardsServerURL,
		resources.FolderResource.Group:    foldersServerURL,
		provisioning.GROUP:                provisioningServerURL,
	}
	configProviders := make(map[string]apiserver.RestConfigProvider)

	tlsConfigForTransport, err := rest.TLSConfigFor(&rest.Config{TLSClientConfig: tlsConfig})
	if err != nil {
		return nil, fmt.Errorf("failed to convert TLS config for transport: %w", err)
	}

	for group, url := range apiServerURLs {
		// Build audiences: always include the group, and add provisioning.GROUP only if different
		audiences := []string{group}
		if group != provisioning.GROUP {
			audiences = append(audiences, provisioning.GROUP)
		}

		config := &rest.Config{
			APIPath: "/apis",
			Host:    url,
			WrapTransport: clientauth.NewTokenExchangeTransportWrapper(
				tokenExchangeClient,
				clientauth.NewStaticAudienceProvider(audiences...),
				clientauth.NewStaticNamespaceProvider(clientauth.WildcardNamespace),
			),
			Transport: &http.Transport{
				MaxConnsPerHost:     100,
				MaxIdleConns:        100,
				MaxIdleConnsPerHost: 100,
				TLSClientConfig:     tlsConfigForTransport,
			},
			RateLimiter: flowcontrol.NewFakeAlwaysRateLimiter(),
		}
		configProviders[group] = NewDirectConfigProvider(config)
	}

	clients := resources.NewClientFactoryForMultipleAPIServers(configProviders)
	c.clients = clients
	return clients, nil
}

func (c *ControllerConfig) ProvisioningClient() (*client.Clientset, error) {
	if c.provisioningClient != nil {
		return c.provisioningClient, nil
	}

	tokenExchangeClient, err := c.TokenExchangeClient()
	if err != nil {
		return nil, fmt.Errorf("failed to create token exchange client: %w", err)
	}

	tlsConfig, err := c.TLSConfig()
	if err != nil {
		return nil, fmt.Errorf("failed to get TLS configuration: %w", err)
	}

	operatorSec := c.Settings.SectionWithEnvOverrides("operator")
	provisioningServerURL := operatorSec.Key("provisioning_server_url").String()
	if provisioningServerURL == "" {
		return nil, fmt.Errorf("provisioning_server_url is required in [operator] section")
	}
	config := &rest.Config{
		APIPath: "/apis",
		Host:    provisioningServerURL,
		WrapTransport: clientauth.NewStaticTokenExchangeTransportWrapper(
			tokenExchangeClient,
			provisioning.GROUP,
			clientauth.WildcardNamespace,
		),
		TLSClientConfig: tlsConfig,
		RateLimiter:     flowcontrol.NewFakeAlwaysRateLimiter(),
	}

	provisioningClient, err := client.NewForConfig(config)
	if err != nil {
		return nil, fmt.Errorf("failed to create provisioning client: %w", err)
	}

	c.provisioningClient = provisioningClient

	return provisioningClient, nil
}

func (c *ControllerConfig) ResyncInterval() time.Duration {
	return c.resyncInterval
}

func (c *ControllerConfig) NumberOfWorkers() int {
	return c.workerCount
}

func (c *ControllerConfig) DecryptService() (decrypt.DecryptService, error) {
	if c.decryptService != nil {
		return c.decryptService, nil
	}

	tokenExchangeClient, err := c.TokenExchangeClient()
	if err != nil {
		return nil, fmt.Errorf("failed to create token exchange client: %w", err)
	}

	decryptSvc, err := setupDecryptService(c.Settings, tracing.NewNoopTracerService(), tokenExchangeClient)
	if err != nil {
		return nil, fmt.Errorf("setup decrypt service: %w", err)
	}

	c.decryptService = decryptSvc

	return decryptSvc, nil
}

func (c *ControllerConfig) QuotaLimitsProvider() (quotas.QuotaLimitsProvider, error) {
	if c.quotaGetter != nil {
		return c.quotaGetter, nil
	}

	if c.QuotaGetterFunc != nil {
		quotaGetter, err := c.QuotaGetterFunc()
		if err != nil {
			return nil, fmt.Errorf("failed to get quota getter: %w", err)
		}
		c.quotaGetter = quotaGetter
		return quotaGetter, nil
	}

	quotaLimits := provisioning.QuotaStatus{
		MaxResourcesPerRepository: c.Settings.SectionWithEnvOverrides("provisioning").Key("max_resources_per_repository").MustInt64(0),
		MaxRepositories:           c.Settings.SectionWithEnvOverrides("provisioning").Key("max_repositories").MustInt64(10),
	}

	c.quotaGetter = quotas.NewFixedQuotaLimitsProvider(quotaLimits)

	return c.quotaGetter, nil
}

func (c *ControllerConfig) Registry() prometheus.Registerer {
	if c.registry != nil {
		return c.registry
	}

	c.registry = prometheus.NewPedanticRegistry()

	return c.registry
}

func (c *ControllerConfig) Tracer() (tracing.Tracer, error) {
	if c.tracer != nil {
		return c.tracer, nil
	}

	tracingConfig, err := tracing.ProvideTracingConfig(c.Settings)
	if err != nil {
		return nil, fmt.Errorf("failed to provide tracing config: %w", err)
	}

	tracer, err := tracing.ProvideService(tracingConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to provide tracing service: %w", err)
	}

	c.tracer = tracer

	return c.tracer, nil
}

func (c *ControllerConfig) TokenExchangeClient() (*authn.TokenExchangeClient, error) {
	if c.tokenExchangeClient != nil {
		return c.tokenExchangeClient, nil
	}

	gRPCAuth := c.Settings.SectionWithEnvOverrides("grpc_client_authentication")
	token := gRPCAuth.Key("token").String()
	if token == "" {
		return nil, fmt.Errorf("token is required in [grpc_client_authentication] section")
	}
	tokenExchangeURL := gRPCAuth.Key("token_exchange_url").String()
	if tokenExchangeURL == "" {
		return nil, fmt.Errorf("token_exchange_url is required in [grpc_client_authentication] section")
	}

	tokenExchangeClient, err := authn.NewTokenExchangeClient(authn.TokenExchangeConfig{
		TokenExchangeURL: tokenExchangeURL,
		Token:            token,
	})

	if err != nil {
		return nil, fmt.Errorf("failed to create token exchange client: %w", err)
	}
	c.tokenExchangeClient = tokenExchangeClient

	return tokenExchangeClient, nil
}

func (c *ControllerConfig) TLSConfig() (rest.TLSClientConfig, error) {
	if c.tlsConfig != nil {
		return *c.tlsConfig, nil
	}

	tlsConfig, err := buildTLSConfig(
		c.Settings.SectionWithEnvOverrides("operator").Key("tls_insecure").MustBool(false),
		c.Settings.SectionWithEnvOverrides("operator").Key("tls_cert_file").String(),
		c.Settings.SectionWithEnvOverrides("operator").Key("tls_key_file").String(),
		c.Settings.SectionWithEnvOverrides("operator").Key("tls_ca_file").String(),
	)

	if err != nil {
		return rest.TLSClientConfig{}, fmt.Errorf("failed to build TLS configuration: %w", err)
	}

	c.tlsConfig = &tlsConfig

	return tlsConfig, nil
}

func (c *ControllerConfig) RepositoryFactory() (repository.Factory, error) {
	if c.repositoryFactory != nil {
		return c.repositoryFactory, nil
	}

	if c.RepositoryFactoryFunc != nil {
		repositoryFactory, err := c.RepositoryFactoryFunc()
		if err != nil {
			return nil, fmt.Errorf("failed to get repository factory: %w", err)
		}
		c.repositoryFactory = repositoryFactory
		return repositoryFactory, nil
	}

	decryptSvc, err := c.DecryptService()
	if err != nil {
		return nil, fmt.Errorf("setup decrypt service: %w", err)
	}

	repositoryFactory, err := setupRepoFactory(c.Settings, repository.ProvideDecrypter(decryptSvc), c.provisioningClient, c.Registry())
	if err != nil {
		return nil, fmt.Errorf("setup repository factory: %w", err)
	}

	c.repositoryFactory = repositoryFactory

	return repositoryFactory, nil
}

func (c *ControllerConfig) ConnectionFactory() (connection.Factory, error) {
	if c.connectionFactory != nil {
		return c.connectionFactory, nil
	}

	if c.ConnectionFactoryFunc != nil {
		connectionFactory, err := c.ConnectionFactoryFunc()
		if err != nil {
			return nil, fmt.Errorf("failed to get connection factory: %w", err)
		}
		c.connectionFactory = connectionFactory
		return connectionFactory, nil
	}

	decryptSvc, err := c.DecryptService()
	if err != nil {
		return nil, fmt.Errorf("setup decrypt service: %w", err)
	}

	connectionFactory, err := setupConnectionFactory(c.Settings, connection.ProvideDecrypter(decryptSvc))
	if err != nil {
		return nil, fmt.Errorf("setup connection factory: %w", err)
	}

	c.connectionFactory = connectionFactory

	return connectionFactory, nil
}

func (c *ControllerConfig) HealthMetricsRecorder() (controller.HealthMetricsRecorder, error) {
	if c.healthMetricsRecorder != nil {
		return c.healthMetricsRecorder, nil
	}

	c.healthMetricsRecorder = controller.NewHealthMetricsRecorder(c.Registry())

	return c.healthMetricsRecorder, nil
}

func (c *ControllerConfig) URLProvider() (func(ctx context.Context, namespace string) string, error) {
	if c.urlProvider != nil {
		return c.urlProvider, nil
	}

	if c.URLProviderFunc != nil {
		urlProvider, err := c.URLProviderFunc()
		if err != nil {
			return nil, fmt.Errorf("failed to get URL provider: %w", err)
		}
		c.urlProvider = urlProvider
		return c.urlProvider, nil
	}

	c.urlProvider = func(ctx context.Context, namespace string) string {
		return c.Settings.AppURL
	}

	return c.urlProvider, nil
}

func setupRepoFactory(
	cfg *setting.Cfg,
	decrypter repository.Decrypter,
	_ *client.Clientset,
	registry prometheus.Registerer,
) (repository.Factory, error) {
	operatorSec := cfg.SectionWithEnvOverrides("operator")
	provisioningSec := cfg.SectionWithEnvOverrides("provisioning")
	repoTypes := provisioningSec.Key("repository_types").Strings("|")
	if len(repoTypes) == 0 {
		repoTypes = []string{"github"}
	}

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
		case provisioning.GitRepositoryType:
			extras = append(extras, gitrepo.Extra(decrypter))
		case provisioning.GitHubRepositoryType:
			var webhook *webhooks.WebhookExtraBuilder
			provisioningAppURL := operatorSec.Key("provisioning_server_public_url").String()
			if provisioningAppURL != "" {
				webhook = webhooks.ProvideWebhooks(provisioningAppURL, registry)
			}

			extras = append(extras, githubrepo.Extra(decrypter, githubrepo.ProvideFactory(), webhook))
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

	repoFactory, err := repository.ProvideFactory(alreadyRegistered, extras)
	if err != nil {
		return nil, fmt.Errorf("create repository factory: %w", err)
	}

	return repoFactory, nil
}

func setupConnectionFactory(
	cfg *setting.Cfg,
	decrypter connection.Decrypter,
) (connection.Factory, error) {
	// For now, only support GitHub connections
	// TODO: Add support for other connection types
	extras := []connection.Extra{
		githubconnection.Extra(decrypter, githubconnection.ProvideFactory()),
	}
	enabledTypes := map[provisioning.ConnectionType]struct{}{
		provisioning.GithubConnectionType: {},
	}

	connectionFactory, err := connection.ProvideFactory(enabledTypes, extras)
	if err != nil {
		return nil, fmt.Errorf("create connection factory: %w", err)
	}

	return connectionFactory, nil
}

func setupDecryptService(cfg *setting.Cfg, tracer tracing.Tracer, tokenExchangeClient *authn.TokenExchangeClient) (decrypt.DecryptService, error) {
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
		secretsSec.Key("grpc_client_load_balancing").MustBool(false),
	)
	if err != nil {
		return nil, fmt.Errorf("create decrypt service: %w", err)
	}

	return decryptSvc, nil
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
