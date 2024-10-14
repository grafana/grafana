package grpcutils

import (
	"context"
	"crypto/tls"
	"errors"
	"fmt"
	"net/http"

	authnlib "github.com/grafana/authlib/authn"
	"github.com/prometheus/client_golang/prometheus"

	"github.com/grafana/grafana/pkg/services/grpcserver/interceptors"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource/grpc"
)

func NewGrpcAuthenticator(cfg *setting.Cfg) (*authnlib.GrpcAuthenticator, error) {
	authCfg, err := ReadGrpcServerConfig(cfg)
	if err != nil {
		return nil, err
	}
	grpcAuthCfg := authnlib.GrpcAuthenticatorConfig{
		KeyRetrieverConfig: authnlib.KeyRetrieverConfig{
			SigningKeysURL: authCfg.SigningKeysURL,
		},
		VerifierConfig: authnlib.VerifierConfig{
			AllowedAudiences: authCfg.AllowedAudiences,
		},
	}

	client := http.DefaultClient
	if cfg.Env == setting.Dev {
		// allow insecure connections in development mode to facilitate testing
		client = &http.Client{Transport: &http.Transport{TLSClientConfig: &tls.Config{InsecureSkipVerify: true}}}
	}
	keyRetriever := authnlib.NewKeyRetriever(grpcAuthCfg.KeyRetrieverConfig, authnlib.WithHTTPClientKeyRetrieverOpt(client))

	grpcOpts := []authnlib.GrpcAuthenticatorOption{
		authnlib.WithIDTokenAuthOption(true),
		authnlib.WithKeyRetrieverOption(keyRetriever),
	}
	if authCfg.Mode == ModeOnPrem {
		grpcOpts = append(grpcOpts,
			// Access token are not yet available on-prem
			authnlib.WithDisableAccessTokenAuthOption(),
		)
	}

	return authnlib.NewGrpcAuthenticator(
		&grpcAuthCfg,
		grpcOpts...,
	)
}

func NewInProcGrpcAuthenticator() *authnlib.GrpcAuthenticator {
	// In proc grpc ID token signature verification can be skipped
	return authnlib.NewUnsafeGrpcAuthenticator(
		&authnlib.GrpcAuthenticatorConfig{},
		authnlib.WithDisableAccessTokenAuthOption(),
		authnlib.WithIDTokenAuthOption(true),
	)
}

type AuthenticatorWithFallback struct {
	authenticator       *authnlib.GrpcAuthenticator
	legacyAuthenticator *grpc.Authenticator
	fallbackEnabled     bool
	metrics             *metrics
}

func NewGrpcAuthenticatorWithFallback(cfg *setting.Cfg, reg prometheus.Registerer) (interceptors.Authenticator, error) {
	authCfg, err := ReadGrpcServerConfig(cfg)
	if err != nil {
		return nil, err
	}

	authenticator, err := NewGrpcAuthenticator(cfg)
	if err != nil {
		return nil, err
	}

	legacyAuthenticator := &grpc.Authenticator{}

	metrics, err := newMetrics(reg)
	if err != nil {
		return nil, err
	}

	return &AuthenticatorWithFallback{
		authenticator:       authenticator,
		legacyAuthenticator: legacyAuthenticator,
		fallbackEnabled:     authCfg.LegacyFallback,
		metrics:             metrics,
	}, nil
}

func (f *AuthenticatorWithFallback) Authenticate(ctx context.Context) (context.Context, error) {
	origCtx := ctx
	// Try to authenticate with the new authenticator first
	ctx, err := f.authenticator.Authenticate(ctx)
	if err == nil {
		// If successful, return the context
		return ctx, nil
	} else if f.fallbackEnabled {
		// If the new authenticator failed and the fallback is enabled, try the legacy authenticator
		ctx, err = f.legacyAuthenticator.Authenticate(origCtx)
		f.metrics.fallbackCounter.WithLabelValues(fmt.Sprintf("%t", err == nil)).Inc()
	}
	return ctx, err
}

const (
	metricsNamespace = "grafana"
	metricsSubSystem = "grpc_authenticator"
)

type metrics struct {
	fallbackCounter *prometheus.CounterVec
}

func newMetrics(reg prometheus.Registerer) (*metrics, error) {
	m := &metrics{
		fallbackCounter: prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Namespace: metricsNamespace,
				Subsystem: metricsSubSystem,
				Name:      "fallback_total",
				Help:      "Number of times the fallback authenticator was used",
			}, []string{"result"}),
	}

	if err := reg.Register(m.fallbackCounter); err != nil {
		// If the counter is already registered, reuse it.
		// This has the benefit of allowing multiple calls to `newMetrics()`.
		var are prometheus.AlreadyRegisteredError
		if errors.As(err, &are) {
			m.fallbackCounter = are.ExistingCollector.(*prometheus.CounterVec)
		} else {
			return nil, err
		}
	}

	return m, nil
}
