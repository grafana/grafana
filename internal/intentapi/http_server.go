package intentapi

import (
	"context"
	"crypto/tls"
	"errors"
	"net/http"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
)

// HTTPServerConfig is the config for Intent API HTTP server.
type HTTPServerConfig struct {
	Enabled         bool
	ListenAddress   string
	ServerCert      tls.Certificate
	ReadTimeout     time.Duration
	WriteTimeout    time.Duration
	ShutdownTimeout time.Duration
}

// NewHTTPServerConfig parses and returns a new HTTPServerConfig from setting.Cfg.
func NewHTTPServerConfig(cfg *setting.Cfg, featureEnabled bool) (HTTPServerConfig, error) {
	if !featureEnabled {
		return HTTPServerConfig{
			Enabled: false,
		}, nil
	}

	sec := cfg.Raw.Section("intentapi.server")

	serverCert, err := tls.LoadX509KeyPair(
		sec.Key("cert_file_path").MustString(""),
		sec.Key("key_file_path").MustString(""),
	)
	if err != nil {
		return HTTPServerConfig{}, err
	}

	c := HTTPServerConfig{}
	c.Enabled = featureEnabled
	c.ListenAddress = sec.Key("listen_address").MustString("127.0.0.1:8443")
	c.ReadTimeout = sec.Key("read_timeout").MustDuration(1 * time.Minute)
	c.WriteTimeout = sec.Key("write_timeout").MustDuration(1 * time.Minute)
	c.ShutdownTimeout = sec.Key("shutdown_timeout").MustDuration(1 * time.Minute)
	c.ServerCert = serverCert

	return c, nil
}

// Handler handles Intent API requests.
type Handler interface {
	http.Handler
}

// HTTPServer is an HTTP server that exposes Intent API.
type HTTPServer struct {
	config  HTTPServerConfig
	handler Handler
	logger  log.Logger
}

// ProvideHTTPServer provides a new HTTP server for Intent API.
func ProvideHTTPServer(cfg *setting.Cfg, features featuremgmt.FeatureToggles, handler Handler) (*HTTPServer, error) {
	en := features.IsEnabled(featuremgmt.FlagIntentapi)

	config, err := NewHTTPServerConfig(cfg, en)
	if err != nil {
		return nil, err
	}

	return &HTTPServer{
		config:  config,
		handler: handler,
		logger:  log.New("intentapi.http_server"),
	}, nil
}

// IsDisabled returns true if the server should be disabled.
func (s *HTTPServer) IsDisabled() bool {
	return !s.config.Enabled
}

// Run runs the server until ctx is canceled.
// When the context is canceled, the server will be shut down gracefully, depending on the shutdown timeout.
func (s *HTTPServer) Run(ctx context.Context) error {
	server := &http.Server{
		Handler:      s.handler,
		ReadTimeout:  s.config.ReadTimeout,
		WriteTimeout: s.config.WriteTimeout,
	}

	lis, err := tls.Listen(
		"tcp",
		s.config.ListenAddress,
		&tls.Config{
			Certificates: []tls.Certificate{s.config.ServerCert},
		},
	)
	if err != nil {
		return err
	}

	s.logger.Info(
		"Intent API Server Listening",
		"address", lis.Addr().String(),
	)

	go func() {
		<-ctx.Done()

		ctx, cancel := context.WithTimeout(context.Background(), s.config.ShutdownTimeout)
		defer cancel()

		if err := server.Shutdown(ctx); err != nil {
			s.logger.Error("error shutting down server", "error", err)
		}
	}()

	if err := server.Serve(lis); err != nil && !errors.Is(err, http.ErrServerClosed) {
		return err
	}

	return nil
}
