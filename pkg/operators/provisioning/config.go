package provisioning

import (
	"context"
	"crypto/x509"
	"fmt"
	"net/http"
	"os"
	"time"

	"github.com/grafana/authlib/authn"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/transport"

	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/apiserver"
	"github.com/grafana/grafana/pkg/setting"
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

type localConfig struct {
	homePath          string
	permittedPrefixes []string
}

type unifiedStorageConfig struct {
	GrpcAddress      string
	GrpcIndexAddress string
	ClientConfig     resource.RemoteResourceClientConfig
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

// provisioningControllerConfig contains the configuration that overlaps for the jobs and repo controllers
type provisioningControllerConfig struct {
	provisioningClient *client.Clientset
	resyncInterval     time.Duration
	tracer             tracing.Tracer
	repoGetter         *resources.RepositoryGetter
	decrypter          repository.Decrypter
	restCfg            *rest.Config
	historyExpiration  time.Duration
}

// expects:
// [grpc_client_authentication]
// token =
// token_exchange_url =
// [operator]
// provisioning_server_url =
// tls_insecure =
// tls_cert_file =
// tls_key_file =
// tls_ca_file =
// resync_interval =
func setupFromConfig(cfg *setting.Cfg) (controllerCfg *provisioningControllerConfig, err error) {
	// TODO: Enforce required
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
			return authrt.NewRoundTripper(tokenExchangeClient, rt)
		}),
		TLSClientConfig: tlsConfig,
	}

	provisioningClient, err := client.NewForConfig(config)
	if err != nil {
		return nil, fmt.Errorf("failed to create provisioning client: %w", err)
	}

	// Decrypt Service
	secretsSec := cfg.SectionWithEnvOverrides("secrets_manager")
	secretsTls := secretdecrypt.TLSConfig{
		UseTLS: secretsSec.Key("grpc_server_use_tls").MustBool(true),
		CAFile: secretsSec.Key("grpc_server_tls_ca_file").String(),
		// TODO: do we need this one?
		// ServerName:         secretsSec.Key("grpc_server_tls_server_name").String(),
		InsecureSkipVerify: secretsSec.Key("grpc_server_tls_skip_verify").MustBool(false),
	}

	decryptSvc, err := secretdecrypt.NewGRPCDecryptClientWithTLS(
		tokenExchangeClient,
		tracer,
		secretsSec.Key("grpc_server_address").String(),
		secretsTls,
	)
	if err != nil {
		return nil, fmt.Errorf("create decrypt service: %w", err)
	}
	decrypter := repository.ProvideDecrypter(decryptSvc)

	// Repository Types
	// TODO: This depends on the different flavor of Grafana
	// https://github.com/grafana/git-ui-sync-project/issues/495
	repositoryTypes := operatorSec.Key("repository_types").Strings("|")
	availableRepositoryTypes := make(map[provisioning.RepositoryType]struct{})
	for _, t := range repositoryTypes {
		if t != string(provisioning.LocalRepositoryType) && t != string(provisioning.GitHubRepositoryType) {
			return nil, fmt.Errorf("unsupported repository type: %s", t)
		}

		availableRepositoryTypes[provisioning.RepositoryType(t)] = struct{}{}
	}

	// local
	localCfg := localConfig{
		homePath:          operatorSec.Key("home_path").String(),
		permittedPrefixes: operatorSec.Key("local_permitted_prefixes").Strings("|"),
	}

	repoGetter, err := buildRepoGetter(availableRepositoryTypes, decrypter, localCfg, provisioningClient)
	if err != nil {
		return nil, fmt.Errorf("build repository getter: %w", err)
	}

	return &provisioningControllerConfig{
		provisioningClient: provisioningClient,
		resyncInterval:     operatorSec.Key("resync_interval").MustDuration(60 * time.Second),
		tracer:             tracer,
		repoGetter:         repoGetter,
		decrypter:          decrypter,
		restCfg:            config,
	}, nil
}

func buildRepoGetter(
	repoTypes map[provisioning.RepositoryType]struct{},
	decrypter repository.Decrypter,
	localCfg localConfig,
	provisioningClient *client.Clientset,
) (*resources.RepositoryGetter, error) {
	// TODO: This depends on the different flavor of Grafana
	// https://github.com/grafana/git-ui-sync-project/issues/495
	extras := make([]repository.Extra, 0, len(repoTypes))
	for t := range repoTypes {
		switch t {
		case provisioning.GitHubRepositoryType:
			extras = append(extras, github.Extra(
				decrypter,
				github.ProvideFactory(),
				nil, // We don't need the WebhookURL for the execution of jobs, only for the repository controller
			),
			)
		case provisioning.LocalRepositoryType:
			extras = append(extras, local.Extra(
				localCfg.homePath,
				localCfg.permittedPrefixes,
			))
		default:
			return nil, fmt.Errorf("unsupported repository type: %s", t)
		}
	}

	repoFactory, err := repository.ProvideFactory(extras)
	if err != nil {
		return nil, fmt.Errorf("create repository factory: %w", err)
	}

	repoGetter := resources.NewRepositoryGetter(
		repoFactory,
		provisioningClient.ProvisioningV0alpha1(),
	)

	return repoGetter, nil
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
