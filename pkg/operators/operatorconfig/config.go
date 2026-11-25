// Package operatorconfig reads the client settings every standalone operator shares.
package operatorconfig

import (
	"crypto/x509"
	"fmt"
	"os"

	"github.com/grafana/authlib/authn"
	"k8s.io/client-go/rest"

	"github.com/grafana/grafana/pkg/setting"
)

// TLSConfig builds the apiserver client TLS settings from:
//
// [operator]
// tls_insecure =
// tls_cert_file =
// tls_key_file =
// tls_ca_file =
func TLSConfig(cfg *setting.Cfg) (rest.TLSClientConfig, error) {
	sec := cfg.SectionWithEnvOverrides("operator")
	tlsConfig, err := buildTLSConfig(
		sec.Key("tls_insecure").MustBool(false),
		sec.Key("tls_cert_file").String(),
		sec.Key("tls_key_file").String(),
		sec.Key("tls_ca_file").String(),
	)
	if err != nil {
		return rest.TLSClientConfig{}, fmt.Errorf("failed to build TLS configuration: %w", err)
	}
	return tlsConfig, nil
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

// TokenExchangeClient builds the token exchange client from:
//
// [grpc_client_authentication]
// token =
// token_exchange_url =
func TokenExchangeClient(cfg *setting.Cfg) (*authn.TokenExchangeClient, error) {
	gRPCAuth := cfg.SectionWithEnvOverrides("grpc_client_authentication")

	token := gRPCAuth.Key("token").String()
	if token == "" {
		return nil, fmt.Errorf("token is required in [grpc_client_authentication] section")
	}
	tokenExchangeURL := gRPCAuth.Key("token_exchange_url").String()
	if tokenExchangeURL == "" {
		return nil, fmt.Errorf("token_exchange_url is required in [grpc_client_authentication] section")
	}

	client, err := authn.NewTokenExchangeClient(authn.TokenExchangeConfig{
		TokenExchangeURL: tokenExchangeURL,
		Token:            token,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create token exchange client: %w", err)
	}
	return client, nil
}
