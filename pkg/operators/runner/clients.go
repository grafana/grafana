package runner

import (
	"crypto/x509"
	"fmt"
	"os"
	"sync"

	"github.com/grafana/authlib/authn"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/util/flowcontrol"

	"github.com/grafana/grafana/pkg/clientauth"
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

// RESTConfig builds a client config for the apiserver at [operator]
// serverURLKey, exchanging tokens for audience. It builds its own TLS settings
// and token exchange client; operators should use [Clients.RESTConfig].
func RESTConfig(cfg *setting.Cfg, serverURLKey, audience string) (*rest.Config, error) {
	return NewClients(cfg).RESTConfig(serverURLKey, audience)
}

// Clients builds the TLS settings and token exchange client once, so every
// apiserver client of an operator shares them and one token cache.
type Clients struct {
	cfg      *setting.Cfg
	mu       sync.Mutex
	tls      *rest.TLSClientConfig
	exchange *authn.TokenExchangeClient
}

func NewClients(cfg *setting.Cfg) *Clients {
	return &Clients{cfg: cfg}
}

func (c *Clients) TLSConfig() (rest.TLSClientConfig, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.tls == nil {
		tlsConfig, err := TLSConfig(c.cfg)
		if err != nil {
			return rest.TLSClientConfig{}, err
		}
		c.tls = &tlsConfig
	}
	return *c.tls, nil
}

func (c *Clients) TokenExchangeClient() (*authn.TokenExchangeClient, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.exchange == nil {
		exchange, err := TokenExchangeClient(c.cfg)
		if err != nil {
			return nil, err
		}
		c.exchange = exchange
	}
	return c.exchange, nil
}

// RESTConfig builds a client config for the apiserver at [operator]
// serverURLKey, exchanging tokens for audience. Each API group can live on its
// own apiserver, so each gets its own config.
func (c *Clients) RESTConfig(serverURLKey, audience string) (*rest.Config, error) {
	cfg := c.cfg
	serverURL := cfg.SectionWithEnvOverrides("operator").Key(serverURLKey).String()
	if serverURL == "" {
		return nil, fmt.Errorf("%s is required in [operator] section", serverURLKey)
	}
	tlsConfig, err := c.TLSConfig()
	if err != nil {
		return nil, err
	}
	tokenExchangeClient, err := c.TokenExchangeClient()
	if err != nil {
		return nil, err
	}
	return &rest.Config{
		APIPath:         "/apis",
		Host:            serverURL,
		WrapTransport:   clientauth.NewStaticTokenExchangeTransportWrapper(tokenExchangeClient, audience, clientauth.WildcardNamespace),
		TLSClientConfig: tlsConfig,
		RateLimiter:     flowcontrol.NewFakeAlwaysRateLimiter(),
	}, nil
}
