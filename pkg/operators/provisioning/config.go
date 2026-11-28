package provisioning

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/grafana/authlib/authn"
	"github.com/grafana/dskit/services"
	"github.com/grafana/grafana/apps/secret/pkg/decrypt"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/kubernetes/scheme"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/util/flowcontrol"

	"github.com/grafana/grafana/pkg/clientauth"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/operators/runner"
	"github.com/grafana/grafana/pkg/services/apiserver"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/connection"
	githubconnection "github.com/grafana/grafana/apps/provisioning/pkg/connection/github"
	"github.com/grafana/grafana/apps/provisioning/pkg/connection/githuboauth"
	"github.com/grafana/grafana/apps/provisioning/pkg/connection/gitoauth"
	client "github.com/grafana/grafana/apps/provisioning/pkg/generated/clientset/versioned"
	"github.com/grafana/grafana/apps/provisioning/pkg/quotas"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	gitrepo "github.com/grafana/grafana/apps/provisioning/pkg/repository/git"
	githubrepo "github.com/grafana/grafana/apps/provisioning/pkg/repository/github"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository/local"
	provisioningresources "github.com/grafana/grafana/apps/provisioning/pkg/resources"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/controller"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/informer"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/webhooks"
	secretdecrypt "github.com/grafana/grafana/pkg/registry/apis/secret/decrypt"
	keysapi "github.com/grafana/grafana/pkg/services/apiserver/keys"
)

var registeredRunnerOptions = []RunnerOption{}

func RegisterRunnerOptions(opts ...RunnerOption) {
	registeredRunnerOptions = append(registeredRunnerOptions, opts...)
}

type RunnerOption func(ctx context.Context, r *ProvisioningRunner) error

// ProvisioningRunner extends the shared operator runtime with what only the
// provisioning operators need: their apiserver clients, factories and extras.
type ProvisioningRunner struct {
	*runner.Runtime
	provisioningClient    *client.Clientset
	provisioningRESTCfg   *rest.Config
	clients               resources.ClientFactory
	manifestWatcher       services.Service
	decryptService        decrypt.DecryptService
	relistProjection      *informer.RelistProjectionMetrics
	freshness             *informer.FreshnessMetrics
	repositoryFactory     repository.Factory
	repositoryExtras      []repository.Extra
	RepositoryExtrasFunc  func() ([]repository.Extra, error)
	connectionFactory     connection.Factory
	connectionExtras      []connection.Extra
	ConnectionExtrasFunc  func() ([]connection.Extra, error)
	healthMetricsRecorder controller.HealthMetricsRecorder
	quotaGetter           quotas.QuotaGetter
	QuotaGetterFunc       func() (quotas.QuotaGetter, error)
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
// [operator]
// provisioning_server_url =
// provisioning_server_public_url =
// dashboards_server_url =
// folders_server_url =
// aggregated_server_url =
// tls_insecure =
// tls_cert_file =
// tls_key_file =
// tls_ca_file =
// resync_interval =
// home_path =
// local_permitted_prefixes =
// [provisioning]
// repository_types =
// connection_types =
// [nats]
// # when enabled, the informers take their watch from NATS instead of the
// # apiserver watch; operators use an external NATS (no embedded server).
// enabled =
// mode = external
// client_urls =
// token =
// subscriber_credentials_file =
// tls_enabled =
func newProvisioningRunner(rt *runner.Runtime) (*ProvisioningRunner, error) {
	if rt.Cfg == nil {
		return nil, fmt.Errorf("no configuration available")
	}

	r := &ProvisioningRunner{Runtime: rt}

	for _, opt := range registeredRunnerOptions {
		if err := opt(context.Background(), r); err != nil {
			return nil, fmt.Errorf("failed to apply runner option: %w", err)
		}
	}

	return r, nil
}

// ResourceLister reads what a repository manages from the provisioning API server.
func (c *ProvisioningRunner) ResourceLister() (resources.ResourceLister, error) {
	provisioningAPI, err := c.ProvisioningRESTClient()
	if err != nil {
		return nil, fmt.Errorf("failed to create provisioning REST client: %w", err)
	}
	return resources.NewResourceListerFromProvisioningAPI(provisioningAPI, c.Cfg.ProvisioningResourceListerPageSize), nil
}

// SupportedResources is the configured provisionable set, which may name collections as wildcards.
func (c *ProvisioningRunner) SupportedResources() ([]resources.SupportedResource, error) {
	supported, err := resources.ParseSupportedResources(c.Cfg.ProvisioningResources)
	if err != nil {
		return nil, fmt.Errorf("invalid [provisioning] resources configuration: %w", err)
	}
	return supported, nil
}

func (c *ProvisioningRunner) NewSupportedResourceProvider() (resources.SupportedResourceProvider, error) {
	configured, err := c.SupportedResources()
	if err != nil {
		return nil, err
	}
	return resources.NewSupportedResourceProvider(configured), nil
}

// ManifestWatcher returns the unstarted service that keeps the supported
// resources of [ProvisioningRunner.Clients] in sync with the API servers.
func (c *ProvisioningRunner) ManifestWatcher() (services.Service, error) {
	if _, err := c.ResourceClients(); err != nil {
		return nil, fmt.Errorf("failed to get clients: %w", err)
	}
	return c.manifestWatcher, nil
}

// Clients Clients are clients that are used to connect to the different API servers.
func (c *ProvisioningRunner) ResourceClients() (resources.ClientFactory, error) {
	if c.clients != nil {
		return c.clients, nil
	}

	operatorSec := c.Cfg.SectionWithEnvOverrides("operator")
	tlsConfig, err := c.Clients.TLSConfig()
	if err != nil {
		return nil, fmt.Errorf("failed to get TLS configuration: %w", err)
	}

	tokenExchangeClient, err := c.Clients.TokenExchangeClient()
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
	// aggregated_server_url serves resource groups that do not have a dedicated server URL
	// (e.g. newly provisionable kinds in their own API group). Dashboards and folders keep
	// their dedicated URLs for backwards compatibility.
	aggregatedServerURL := operatorSec.Key("aggregated_server_url").String()
	apiServerURLs := map[string]string{
		resources.DashboardResource.Group: dashboardsServerURL,
		resources.FolderResource.Group:    foldersServerURL,
		provisioning.GROUP:                provisioningServerURL,
	}

	supportedResourceProvider, err := c.NewSupportedResourceProvider()
	if err != nil {
		return nil, err
	}

	// Dashboards and folders have dedicated server URLs; every other active resource must
	// resolve to the aggregated server — failing loudly when it is unset, rather than hitting
	// "no clients provider for group" at request time. A collection is registered under the
	// collection group, not its members: those cannot be discovered before there is a client to
	// discover through.
	for _, r := range supportedResourceProvider.Configured() {
		if !r.IsActive() {
			continue
		}
		group := provisioningresources.CollectionGroup(r.Group)
		switch group {
		case resources.DashboardResource.Group, resources.FolderResource.Group, provisioning.GROUP:
			continue // built-in groups with dedicated server URLs
		}
		if _, ok := apiServerURLs[group]; ok {
			continue
		}
		if aggregatedServerURL == "" {
			return nil, fmt.Errorf("aggregated_server_url is required in [operator] section to serve resource %s/%s", r.Group, r.Kind)
		}
	}
	if aggregatedServerURL != "" {
		apiServerURLs[resources.AnyGroup] = aggregatedServerURL
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
		if group == resources.AnyGroup {
			audiences = []string{provisioning.GROUP}
		}
		var audienceProvider clientauth.AudienceProvider = clientauth.NewStaticAudienceProvider(audiences...)
		if group == resources.AnyGroup && c.Cfg.ProvisioningRouterClient {
			audienceProvider = clientauth.NewRequestGroupAudienceProvider(setting.ExtJWTAccessTokenExpectAudience)
		}

		config := &rest.Config{
			APIPath: "/apis",
			Host:    url,
			WrapTransport: clientauth.NewTokenExchangeTransportWrapper(
				tokenExchangeClient,
				audienceProvider,
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

	c.manifestWatcher, err = resources.NewRemoteManifestWatcher(supportedResourceProvider, c.Registerer, resource.ManifestWatcherConfig{
		DiscoveryURL:      aggregatedServerURL,
		DiscoveryAudience: setting.ExtJWTAccessTokenExpectAudience,
		Exchanger:         tokenExchangeClient,
		TLS:               &tlsConfig,
		PollInterval:      time.Minute,
		Log:               c.Cfg.Logger,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create manifest watcher: %w", err)
	}
	clients := resources.NewClientFactoryForMultipleAPIServers(configProviders, supportedResourceProvider)
	if c.Cfg.ProvisioningRouterClient {
		if aggregatedServerURL == "" {
			return nil, fmt.Errorf("aggregated_server_url is required in [operator] section when [provisioning] router_client is enabled")
		}
		clients = resources.NewClientFactory(configProviders[resources.AnyGroup], supportedResourceProvider)
	}
	c.clients = clients
	return clients, nil
}

// ControllerCommon returns what every provisioning controller of the operator is
// built from.
func (c *ProvisioningRunner) ControllerCommon() (controller.Common, error) {
	provisioningClient, err := c.ProvisioningClient()
	if err != nil {
		return controller.Common{}, fmt.Errorf("failed to create provisioning client: %w", err)
	}
	common := controller.Common{Client: provisioningClient, Registry: c.Registerer, Tracer: c.Tracer}
	// A nil *SubscriberService must stay a nil interface.
	if c.Subscriber != nil {
		common.Subscriber = c.Subscriber
	}
	return common, nil
}

// ControllerInformer returns the delta source and queue settings of the
// controller for gvr.
func (c *ProvisioningRunner) ControllerInformer(gvr schema.GroupVersionResource) (controller.Informer, error) {
	keys, err := c.ProvisioningKeysLister(gvr)
	if err != nil {
		return controller.Informer{}, err
	}
	return controller.Informer{
		Keys:             keys,
		RelistMetrics:    c.RelistProjectionMetrics(),
		FreshnessMetrics: c.FreshnessMetrics(),
		ResyncInterval:   c.Options.Resync,
		DrainTimeout:     c.Options.DrainTimeout,
	}, nil
}

func (c *ProvisioningRunner) ProvisioningClient() (*client.Clientset, error) {
	if c.provisioningClient != nil {
		return c.provisioningClient, nil
	}

	config, err := c.Clients.RESTConfig("provisioning_server_url", provisioning.GROUP)
	if err != nil {
		return nil, err
	}

	provisioningClient, err := client.NewForConfig(config)
	if err != nil {
		return nil, fmt.Errorf("failed to create provisioning client: %w", err)
	}

	c.provisioningClient = provisioningClient
	// Kept for callers that need a route the typed clientset has no method for,
	// such as the keys-only re-list.
	c.provisioningRESTCfg = config

	return provisioningClient, nil
}

// ProvisioningRESTClient returns a REST client for the provisioning apiserver,
// for endpoints outside the typed clientset. It shares the clientset's config, so
// building the clientset first is what supplies it.
func (c *ProvisioningRunner) ProvisioningRESTClient() (rest.Interface, error) {
	if _, err := c.ProvisioningClient(); err != nil {
		return nil, err
	}

	cfg := rest.CopyConfig(c.provisioningRESTCfg)
	cfg.GroupVersion = &schema.GroupVersion{Group: provisioning.GROUP, Version: provisioning.VERSION}
	cfg.NegotiatedSerializer = scheme.Codecs.WithoutConversion()
	return rest.RESTClientFor(cfg)
}

func (c *ProvisioningRunner) DecryptService() (decrypt.DecryptService, error) {
	if c.decryptService != nil {
		return c.decryptService, nil
	}

	tokenExchangeClient, err := c.Clients.TokenExchangeClient()
	if err != nil {
		return nil, fmt.Errorf("failed to create token exchange client: %w", err)
	}

	decryptSvc, err := setupDecryptService(c.Cfg, c.Tracer, tokenExchangeClient)
	if err != nil {
		return nil, fmt.Errorf("setup decrypt service: %w", err)
	}

	c.decryptService = decryptSvc

	return decryptSvc, nil
}

func (c *ProvisioningRunner) QuotaGetter() (quotas.QuotaGetter, error) {
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

	quotaStatus := provisioning.QuotaStatus{
		MaxResourcesPerRepository: c.Cfg.SectionWithEnvOverrides("provisioning").Key("max_resources_per_repository").MustInt64(0),
		MaxRepositories:           c.Cfg.SectionWithEnvOverrides("provisioning").Key("max_repositories").MustInt64(10),
	}

	c.quotaGetter = quotas.NewFixedQuotaGetter(quotaStatus)

	return c.quotaGetter, nil
}

// RelistProjectionMetrics returns the process's re-list projection metrics.
// Memoized because the collectors register on first call; building them twice
// would panic on the duplicate.
func (c *ProvisioningRunner) RelistProjectionMetrics() *informer.RelistProjectionMetrics {
	if c.relistProjection == nil {
		c.relistProjection = informer.NewRelistProjectionMetrics(c.Registerer)
	}

	return c.relistProjection
}

// FreshnessMetrics returns the process's reconcile read-freshness metrics.
// Memoized for the same reason as RelistProjectionMetrics.
func (c *ProvisioningRunner) FreshnessMetrics() *informer.FreshnessMetrics {
	if c.freshness == nil {
		c.freshness = informer.NewFreshnessMetrics(c.Registerer)
	}

	return c.freshness
}

// ProvisioningKeysLister returns the keys lister the informer re-list reads one
// kind through.
func (c *ProvisioningRunner) ProvisioningKeysLister(gvr schema.GroupVersionResource) (keysapi.Lister, error) {
	restClient, err := c.ProvisioningRESTClient()
	if err != nil {
		return nil, fmt.Errorf("failed to create provisioning REST client: %w", err)
	}

	return keysapi.NewHTTPLister(restClient, gvr), nil
}

func (c *ProvisioningRunner) RepositoryFactory() (repository.Factory, error) {
	if c.repositoryFactory != nil {
		return c.repositoryFactory, nil
	}

	extras, err := c.RepositoryExtras()
	if err != nil {
		return nil, err
	}

	// Build enabled types from the extras
	enabledTypes := make(map[provisioning.RepositoryType]struct{})
	for _, extra := range extras {
		enabledTypes[extra.Type()] = struct{}{}
	}

	tracer := c.Tracer

	repositoryFactory, err := repository.ProvideFactory(enabledTypes, extras, tracer)
	if err != nil {
		return nil, fmt.Errorf("create repository factory: %w", err)
	}

	c.repositoryFactory = repositoryFactory

	return repositoryFactory, nil
}

func (c *ProvisioningRunner) ConnectionFactory() (connection.Factory, error) {
	if c.connectionFactory != nil {
		return c.connectionFactory, nil
	}

	extras, err := c.ConnectionExtras()
	if err != nil {
		return nil, err
	}

	types := c.Cfg.ProvisioningConnectionTypes
	if len(types) == 0 {
		types = defaultConnectionTypes(extras)
	}

	tracer := c.Tracer

	connectionFactory, err := connection.ProvideFactory(connection.ToConnectionTypes(types), extras, tracer)
	if err != nil {
		return nil, fmt.Errorf("create connection factory: %w", err)
	}

	c.connectionFactory = connectionFactory

	return connectionFactory, nil
}

func (c *ProvisioningRunner) HealthMetricsRecorder() (controller.HealthMetricsRecorder, error) {
	if c.healthMetricsRecorder != nil {
		return c.healthMetricsRecorder, nil
	}

	c.healthMetricsRecorder = controller.NewHealthMetricsRecorder(c.Registerer)

	return c.healthMetricsRecorder, nil
}

func (c *ProvisioningRunner) URLProvider() (func(ctx context.Context, namespace string) string, error) {
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
		return c.Cfg.AppURL
	}

	return c.urlProvider, nil
}

func (c *ProvisioningRunner) RepositoryExtras() ([]repository.Extra, error) {
	// Folder metadata read metrics are a process-global singleton recorded by the
	// code that uses them rather than threaded through the returned extras, so they
	// must be registered regardless of which extras path is taken below — including
	// the custom RepositoryExtrasFunc path, which returns early.
	resources.RegisterFolderMetadataMetrics(c.Registerer)

	if c.repositoryExtras != nil {
		return c.repositoryExtras, nil
	}

	if c.RepositoryExtrasFunc != nil {
		extras, err := c.RepositoryExtrasFunc()
		if err != nil {
			return nil, fmt.Errorf("failed to get repository extras: %w", err)
		}
		c.repositoryExtras = extras
		return extras, nil
	}

	// Default OSS implementation
	decryptSvc, err := c.DecryptService()
	if err != nil {
		return nil, fmt.Errorf("get decrypt service: %w", err)
	}
	decrypter := repository.ProvideDecrypter(decryptSvc, repository.RegisterDecryptMetrics(c.Registerer))
	operationMetrics := repository.RegisterOperationMetrics(c.Registerer)
	clientMetrics := gitrepo.RegisterClientMetrics(c.Registerer)

	operatorSec := c.Cfg.SectionWithEnvOverrides("operator")
	provisioningSec := c.Cfg.SectionWithEnvOverrides("provisioning")
	repoTypes := provisioningSec.Key("repository_types").Strings("|")
	if len(repoTypes) == 0 {
		repoTypes = []string{"git", "github"}
	}

	// http:// URLs with a token are only allowed in development or when explicitly opted in,
	// since the token would otherwise travel in cleartext.
	allowInsecure := c.Cfg.Env == setting.Dev || provisioningSec.Key("allow_insecure").MustBool(false)
	userAgent := gitrepo.UserAgent(c.Cfg.BuildVersion)

	extras := make([]repository.Extra, 0)
	for _, t := range repoTypes {
		switch provisioning.RepositoryType(t) {
		case provisioning.GitRepositoryType:
			extras = append(extras, gitrepo.Extra(decrypter, allowInsecure, operationMetrics, clientMetrics, userAgent))
		case provisioning.GitHubRepositoryType:
			var webhook *webhooks.WebhookExtraBuilder
			provisioningAppURL := operatorSec.Key("provisioning_server_public_url").String()
			if provisioningAppURL != "" {
				webhook = webhooks.ProvideWebhooks(
					provisioningAppURL,
					c.Registerer,
					webhooks.NewConfiguredRateLimiter(
						provisioningSec.Key("webhook_rate_limit_rps").MustInt(0),
						provisioningSec.Key("webhook_trusted_ip_header").MustString(""),
					),
				)
			}
			extras = append(extras, githubrepo.Extra(decrypter, githubrepo.ProvideFactory(), webhook, allowInsecure, operationMetrics, clientMetrics, userAgent))
		case provisioning.LocalRepositoryType:
			homePath := operatorSec.Key("home_path").String()
			if homePath == "" {
				return nil, fmt.Errorf("home_path is required in [operator] section for local repository type")
			}
			permittedPrefixes := operatorSec.Key("local_permitted_prefixes").Strings("|")
			if len(permittedPrefixes) == 0 {
				return nil, fmt.Errorf("local_permitted_prefixes is required in [operator] section for local repository type")
			}
			extras = append(extras, local.Extra(homePath, permittedPrefixes, operationMetrics))
		default:
			return nil, fmt.Errorf("unsupported repository type: %s", t)
		}
	}

	c.repositoryExtras = extras
	return extras, nil
}

func (c *ProvisioningRunner) ConnectionExtras() ([]connection.Extra, error) {
	if c.connectionExtras != nil {
		return c.connectionExtras, nil
	}

	if c.ConnectionExtrasFunc != nil {
		extras, err := c.ConnectionExtrasFunc()
		if err != nil {
			return nil, fmt.Errorf("failed to get connection extras: %w", err)
		}
		c.connectionExtras = extras
		return extras, nil
	}

	// Default OSS implementation
	decryptSvc, err := c.DecryptService()
	if err != nil {
		return nil, fmt.Errorf("get decrypt service: %w", err)
	}
	decrypter := connection.ProvideDecrypter(decryptSvc, connection.RegisterDecryptMetrics(c.Registerer))

	// http:// OAuth endpoints are only allowed in development or when explicitly opted in,
	// since the client secret and tokens would otherwise travel in cleartext.
	allowInsecure := c.Cfg.Env == setting.Dev || c.Cfg.SectionWithEnvOverrides("provisioning").Key("allow_insecure").MustBool(false)

	extras := []connection.Extra{
		githubconnection.Extra(decrypter, githubconnection.ProvideFactory()),
		githuboauth.Extra(decrypter, githubrepo.ProvideFactory()),
		gitoauth.Extra(decrypter, allowInsecure),
	}

	c.connectionExtras = extras
	return extras, nil
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
		secretsSec.Key("grpc_token_exchanger_namespace_all").MustBool(false),
	)
	if err != nil {
		return nil, fmt.Errorf("create decrypt service: %w", err)
	}

	return decryptSvc, nil
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

func defaultConnectionTypes(extras []connection.Extra) []string {
	types := make([]string, 0, len(extras))
	for _, extra := range extras {
		types = append(types, string(extra.Type()))
	}
	return types
}

var operatorDefaults = runner.Options{Workers: 1, Resync: 60 * time.Second, DrainTimeout: 30 * time.Second}
