package server

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"fmt"
	"net"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/grafana/authlib/authn"
	"github.com/grafana/dskit/services"

	"github.com/grafana/grafana/pkg/legacyapi"
	"github.com/grafana/grafana/pkg/setting"
)

const legacyAPIShutdownTimeout = 30 * time.Second

func (s *ModuleServer) initLegacyAPIModule() (services.Service, error) {
	addr, cfg, err := legacyAPIConfig(s.cfg)
	if err != nil {
		return nil, err
	}
	if cfg.TokenExchanger == nil {
		s.log.Warn("legacy API: [grpc_client_authentication] token is not set, so creators and updaters will show as Anonymous")
	}
	return newLegacyAPIService(addr, s.healthNotifier, legacyapi.NewHandler(cfg)), nil
}

// legacyAPIService serves the legacy API translation service's routes on
// their own address. The instrumentation server keeps /metrics and the
// health probes on its port.
type legacyAPIService struct {
	*services.BasicService

	addr   string
	health *HealthNotifier
	srv    *http.Server
	ln     net.Listener
}

func newLegacyAPIService(addr string, health *HealthNotifier, handler http.Handler) *legacyAPIService {
	s := &legacyAPIService{
		addr:   addr,
		health: health,
		srv:    &http.Server{Handler: handler, ReadHeaderTimeout: 5 * time.Second},
	}
	s.BasicService = services.NewBasicService(s.start, s.run, s.stop)
	return s
}

// Addr is the address the service listens on, once it has started.
func (s *legacyAPIService) Addr() net.Addr {
	return s.ln.Addr()
}

func (s *legacyAPIService) start(ctx context.Context) error {
	ln, err := (&net.ListenConfig{}).Listen(ctx, "tcp", s.addr)
	if err != nil {
		return fmt.Errorf("legacy API: listening on %s: %w", s.addr, err)
	}
	s.ln = ln
	s.health.SetReady()
	return nil
}

func (s *legacyAPIService) run(ctx context.Context) error {
	errc := make(chan error, 1)
	go func() { errc <- s.srv.Serve(s.ln) }()

	select {
	case <-ctx.Done():
		return nil
	case err := <-errc:
		return err
	}
}

func (s *legacyAPIService) stop(_ error) error {
	s.health.SetNotReady()
	ctx, cancel := context.WithTimeout(context.Background(), legacyAPIShutdownTimeout)
	defer cancel()
	return s.srv.Shutdown(ctx)
}

// legacyAPIConfig reads [legacy_api], and the service token from
// [grpc_client_authentication], which the other app platform clients use.
func legacyAPIConfig(cfg *setting.Cfg) (string, legacyapi.Config, error) {
	section := cfg.SectionWithEnvOverrides("legacy_api")
	addr := net.JoinHostPort(
		strings.TrimSpace(section.Key("http_addr").MustString("")),
		strings.TrimSpace(section.Key("http_port").MustString("3001")),
	)
	out := legacyapi.Config{
		DashboardAPIURL: strings.TrimSpace(section.Key("dashboard_api_url").MustString("")),
		FolderAPIURL:    strings.TrimSpace(section.Key("folder_api_url").MustString("")),
		IAMAPIURL:       strings.TrimSpace(section.Key("iam_api_url").MustString("")),
	}
	for key, value := range map[string]string{
		"dashboard_api_url": out.DashboardAPIURL,
		"folder_api_url":    out.FolderAPIURL,
		"iam_api_url":       out.IAMAPIURL,
	} {
		if value == "" {
			return "", legacyapi.Config{}, fmt.Errorf("legacy API: [legacy_api] %s is required", key)
		}
	}

	tlsConfig := &tls.Config{MinVersion: tls.VersionTLS12}
	if caPath := strings.TrimSpace(section.Key("tls_ca_path").MustString("")); caPath != "" {
		pem, err := os.ReadFile(caPath) //nolint:gosec // the path comes from the operator's config
		if err != nil {
			return "", legacyapi.Config{}, fmt.Errorf("legacy API: reading [legacy_api] tls_ca_path: %w", err)
		}
		pool := x509.NewCertPool()
		if !pool.AppendCertsFromPEM(pem) {
			return "", legacyapi.Config{}, fmt.Errorf("legacy API: [legacy_api] tls_ca_path %s has no PEM certificates", caPath)
		}
		tlsConfig.RootCAs = pool
	}
	transport := http.DefaultTransport.(*http.Transport).Clone()
	transport.TLSClientConfig = tlsConfig
	out.HTTPClient = &http.Client{Transport: transport, Timeout: 30 * time.Second}

	grpcSection := cfg.SectionWithEnvOverrides("grpc_client_authentication")
	token := strings.TrimSpace(grpcSection.Key("token").MustString(""))
	tokenExchangeURL := strings.TrimSpace(grpcSection.Key("token_exchange_url").MustString(""))
	switch {
	case token == "":
	case tokenExchangeURL == "":
		out.TokenExchanger = authn.NewStaticTokenExchanger(token)
	default:
		exchanger, err := authn.NewTokenExchangeClient(authn.TokenExchangeConfig{Token: token, TokenExchangeURL: tokenExchangeURL})
		if err != nil {
			return "", legacyapi.Config{}, fmt.Errorf("legacy API: creating token exchange client: %w", err)
		}
		out.TokenExchanger = exchanger
	}

	return addr, out, nil
}
