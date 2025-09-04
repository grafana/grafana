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

	"github.com/grafana/grafana/pkg/setting"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	authrt "github.com/grafana/grafana/apps/provisioning/pkg/auth"
	client "github.com/grafana/grafana/apps/provisioning/pkg/generated/clientset/versioned"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository/github"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository/local"
	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
)

// provisioningControllerConfig contains the configuration that overlaps for the jobs and repo controllers
type provisioningControllerConfig struct {
	provisioningClient *client.Clientset
	resyncInterval     time.Duration
	repoFactory        repository.Factory
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
// repository_types =
// home_path =
// local_permitted_prefixes =
func setupFromConfig(cfg *setting.Cfg) (controllerCfg *provisioningControllerConfig, err error) {
	if cfg == nil {
		return nil, fmt.Errorf("no configuration available")
	}

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

	// TODO: Replace with a real decrypter that uses the Grafana secret service
	repoFactory, err := setupRepoFactory(cfg, emptyValuesDecrypter, provisioningClient)
	if err != nil {
		return nil, fmt.Errorf("failed to setup repository getter: %w", err)
	}

	return &provisioningControllerConfig{
		provisioningClient: provisioningClient,
		repoFactory:        repoFactory,
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

// emptyValuesDecrypter is a decrypter that always returns empty values.
// This is a temporary implementation and should be replaced with a real decrypter.
// TODO: remove this and use a real decrypter that uses the Grafana secret service
func emptyValuesDecrypter(r *provisioning.Repository) repository.SecureValues {
	return &emptyValues{}
}

// emptyValues is a that always returns empty values.
// This is a temporary implementation and should be replaced with a real decrypter.
// TODO: remove this and use a real decrypter that uses the Grafana secret service
type emptyValues struct{}

func (s *emptyValues) Token(ctx context.Context) (common.RawSecureValue, error) {
	return common.NewSecretValue(""), nil
}

func (s *emptyValues) WebhookSecret(ctx context.Context) (common.RawSecureValue, error) {
	return common.NewSecretValue(""), nil
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
