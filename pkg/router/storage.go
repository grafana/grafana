package router

import (
	"crypto/tls"
	"fmt"
	"net/http"
	"time"

	authnlib "github.com/grafana/authlib/authn"
	"github.com/prometheus/client_golang/prometheus"
	"go.opentelemetry.io/otel/trace"

	"github.com/grafana/grafana/pkg/services/authn/grpcutils"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

// NewRemoteResourceClient carries the caller's access token to remote storage
// through OBO exchange, including callers without an ID token.
func NewRemoteResourceClient(cfg *setting.Cfg, tracer trace.Tracer, reg prometheus.Registerer) (resource.ResourceClient, error) {
	clientCfg := grpcutils.ReadGrpcClientConfig(cfg)
	allowInsecure := cfg.Env == setting.Dev
	var exchangeOpts []authnlib.ExchangeClientOpts
	if allowInsecure {
		// Keep connection timeouts and pooling when overriding certificate verification.
		transport := http.DefaultTransport.(*http.Transport).Clone()
		transport.TLSClientConfig = &tls.Config{
			MinVersion:         tls.VersionTLS13,
			InsecureSkipVerify: true, // #nosec G402 -- development mode only.
		}
		exchangeOpts = append(exchangeOpts, authnlib.WithHTTPClient(
			&http.Client{Transport: transport, Timeout: 5 * time.Second},
		))
	}
	baseExchanger, err := authnlib.NewTokenExchangeClient(authnlib.TokenExchangeConfig{
		Token:            clientCfg.Token,
		TokenExchangeURL: clientCfg.TokenExchangeURL,
	}, exchangeOpts...)
	if err != nil {
		return nil, fmt.Errorf("error creating token exchange client: %w", err)
	}

	return unified.NewRemoteResourceClientWithAuth(cfg, tracer, reg, resource.RemoteResourceClientConfig{
		AllowInsecure:         allowInsecure,
		Namespace:             clientCfg.TokenNamespace,
		Audiences:             []string{"resourceStore"},
		TokenExchanger:        &oboTokenExchanger{delegate: baseExchanger},
		CarriesCallerIdentity: true,
	})
}
