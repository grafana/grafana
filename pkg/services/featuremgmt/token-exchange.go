package featuremgmt

import (
	"fmt"
	"strconv"

	authlib "github.com/grafana/authlib/authn"
	"github.com/grafana/grafana/pkg/infra/features"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/setting"
)

type signerSettings struct {
	token            string
	tokenExchangeURL string
}

// TestingTokenExchangeMiddleware creates a middleware for testing purposes
func TestingTokenExchangeMiddleware(tokenExchangeClient authlib.TokenExchanger) *features.TokenExchangeMiddleware {
	return features.NewTokenExchangeMiddleware(tokenExchangeClient, "*")
}

// getTokenExchangeConfig reads token exchange configuration from Grafana settings
// and returns the token exchanger and namespace.
func getTokenExchangeConfig(cfg *setting.Cfg) (authlib.TokenExchanger, string, error) {
	clientCfg, err := readSignerSettings(cfg)
	if err != nil {
		return nil, "", err
	}

	stackID := cfg.SectionWithEnvOverrides("environment").Key("stack_id").MustString("")
	if stackID == "" {
		return nil, "", fmt.Errorf("stack_id is required")
	}

	stackIDInt, err := strconv.ParseInt(stackID, 10, 64)
	if err != nil {
		return nil, "", fmt.Errorf("failed to parse stack_id: %w", err)
	}
	nsMapper := request.GetNamespaceMapper(cfg)
	namespace := nsMapper(stackIDInt)

	tokenExchangeClient, err := authlib.NewTokenExchangeClient(authlib.TokenExchangeConfig{
		Token:            clientCfg.token,
		TokenExchangeURL: clientCfg.tokenExchangeURL,
	})
	if err != nil {
		return nil, "", err
	}

	return tokenExchangeClient, namespace, nil
}

// NewTokenExchangeMiddleware creates a token exchange middleware from Grafana configuration.
// This is a Grafana-specific wrapper that reads configuration from setting.Cfg.
//
// Deprecated: Use getTokenExchangeConfig with features.CreateHTTPClientWithTokenExchange instead.
func NewTokenExchangeMiddleware(cfg *setting.Cfg) (*features.TokenExchangeMiddleware, error) {
	tokenExchangeClient, namespace, err := getTokenExchangeConfig(cfg)
	if err != nil {
		return nil, err
	}
	return features.NewTokenExchangeMiddleware(tokenExchangeClient, namespace), nil
}

// we exercise the below code path in OSS but would rather have it fail
// instead of documenting these non-pertinent settings and requiring mock values for them.
// hence, the error return is handled above as non-critical and a mock
// exchange client is returned.
func readSignerSettings(cfg *setting.Cfg) (*signerSettings, error) {
	grpcClientAuthSection := cfg.SectionWithEnvOverrides("grpc_client_authentication")

	s := &signerSettings{}

	s.token = grpcClientAuthSection.Key("token").MustString("")
	s.tokenExchangeURL = grpcClientAuthSection.Key("token_exchange_url").MustString("")

	if s.token == "" || s.tokenExchangeURL == "" {
		return nil, fmt.Errorf("authorization:  missing token or tokenExchangeUrl")
	}

	return s, nil
}
