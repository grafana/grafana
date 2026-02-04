package resources

import (
	"context"
	"fmt"
	"net/http"

	authnlib "github.com/grafana/authlib/authn"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/clientauth"
	"github.com/grafana/grafana/pkg/services/apiserver"
	"github.com/grafana/grafana/pkg/services/authn/grpcutils"
	"github.com/grafana/grafana/pkg/setting"
	clientrest "k8s.io/client-go/rest"
	"k8s.io/client-go/util/flowcontrol"
)

// TokenExchangeClientFactoryConfig contains configuration for creating a client factory with token exchange
type TokenExchangeClientFactoryConfig struct {
	Settings              *setting.Cfg
	FolderServerURL       string
	DashboardServerURL    string
	ProvisioningServerURL string
	TLSInsecure           bool
	TLSCertFile           string
	TLSKeyFile            string
	TLSCAFile             string
}

// NewClientFactoryWithTokenExchange creates a ClientFactory that uses token exchange for authentication.
// This is similar to how the provisioning operators authenticate with folder/dashboard services.
// It creates separate REST configs for each service (folder, dashboard) with proper audience configuration.
func NewClientFactoryWithTokenExchange(cfg TokenExchangeClientFactoryConfig) (ClientFactory, error) {
	// Read gRPC client authentication config
	grpcClientCfg := grpcutils.ReadGrpcClientConfig(cfg.Settings)
	if grpcClientCfg.Token == "" {
		return nil, fmt.Errorf("token is required in [grpc_client_authentication] section")
	}
	if grpcClientCfg.TokenExchangeURL == "" {
		return nil, fmt.Errorf("token_exchange_url is required in [grpc_client_authentication] section")
	}

	// Create token exchange client
	tokenExchangeClient, err := authnlib.NewTokenExchangeClient(authnlib.TokenExchangeConfig{
		TokenExchangeURL: grpcClientCfg.TokenExchangeURL,
		Token:            grpcClientCfg.Token,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create token exchange client: %w", err)
	}

	// Build TLS config
	tlsConfig := clientrest.TLSClientConfig{
		Insecure: cfg.TLSInsecure,
		CertFile: cfg.TLSCertFile,
		KeyFile:  cfg.TLSKeyFile,
		CAFile:   cfg.TLSCAFile,
	}

	tlsConfigForTransport, err := clientrest.TLSConfigFor(&clientrest.Config{TLSClientConfig: tlsConfig})
	if err != nil {
		return nil, fmt.Errorf("failed to convert TLS config for transport: %w", err)
	}

	// Create REST config for each API server, similar to how the operator does it
	// See: pkg/operators/provisioning/config.go:218-241
	apiServerURLs := map[string]string{
		DashboardResource.Group: cfg.DashboardServerURL,
		FolderResource.Group:    cfg.FolderServerURL,
		provisioning.GROUP:      cfg.ProvisioningServerURL,
	}

	configProviders := make(map[string]apiserver.RestConfigProvider)

	for group, url := range apiServerURLs {
		if url == "" {
			continue // Skip if URL is not configured
		}

		// Build audiences: always include the group, and add provisioning.GROUP only if different
		// This ensures the token is accepted by both the target service and passes managed.go checks
		audiences := []string{group}
		if group != provisioning.GROUP {
			audiences = append(audiences, provisioning.GROUP)
		}

		config := &clientrest.Config{
			APIPath: "/apis",
			Host:    url,
			// Use token exchange transport wrapper, similar to operator
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

	if len(configProviders) == 0 {
		return nil, fmt.Errorf("no API server URLs configured")
	}

	// Create multi-server client factory
	return NewClientFactoryForMultipleAPIServers(configProviders), nil
}

// directConfigProvider is a simple RestConfigProvider that always returns the same rest.Config
// it implements apiserver.RestConfigProvider
type directConfigProvider struct {
	cfg *clientrest.Config
}

// NewDirectConfigProvider creates a REST config provider that returns a fixed config
func NewDirectConfigProvider(cfg *clientrest.Config) apiserver.RestConfigProvider {
	return &directConfigProvider{cfg: cfg}
}

func (r *directConfigProvider) GetRestConfig(ctx context.Context) (*clientrest.Config, error) {
	return r.cfg, nil
}
