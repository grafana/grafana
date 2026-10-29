package folder

import (
	"crypto/x509"
	"fmt"
	"os"

	"github.com/grafana/authlib/authn"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/util/flowcontrol"

	"github.com/grafana/grafana/pkg/clientauth"
	"github.com/grafana/grafana/pkg/setting"
)

// buildRESTClient keeps keys-only requests and watches on the same authentication settings:
// [operator] and [grpc_client_authentication].
//
// [operator]
// folders_server_url =
// tls_insecure =
// tls_cert_file =
// tls_key_file =
// tls_ca_file =
// [grpc_client_authentication]
// token =
// token_exchange_url =
func buildRESTClient(cfg *setting.Cfg) (rest.Interface, error) {
	operatorSec := cfg.SectionWithEnvOverrides("operator")

	serverURL := operatorSec.Key("folders_server_url").String()
	if serverURL == "" {
		return nil, fmt.Errorf("folders_server_url is required in [operator] section")
	}

	tlsConfig, err := buildTLSConfig(
		operatorSec.Key("tls_insecure").MustBool(false),
		operatorSec.Key("tls_cert_file").String(),
		operatorSec.Key("tls_key_file").String(),
		operatorSec.Key("tls_ca_file").String(),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to build TLS configuration: %w", err)
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

	client, err := rest.UnversionedRESTClientFor(dynamic.ConfigFor(restConfig))
	if err != nil {
		return nil, fmt.Errorf("failed to create folder REST client: %w", err)
	}

	return client, nil
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
