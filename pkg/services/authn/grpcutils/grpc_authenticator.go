package grpcutils

import (
	"context"
	"crypto/tls"
	"errors"
	"fmt"
	"net/http"
	"sync"

	"github.com/grafana/authlib/authn"
	"github.com/grafana/authlib/claims"
	"github.com/prometheus/client_golang/prometheus"
	"go.opentelemetry.io/otel/attribute"
	"google.golang.org/grpc/metadata"

	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/grpcserver/interceptors"
	"github.com/grafana/grafana/pkg/setting"
)

var errMissingMetadata = errors.New("missing metadata")

var once sync.Once

func NewInProcGrpcAuthenticator() interceptors.Authenticator {
	auth := authn.NewIDTokenAuthenticator(
		authn.NewUnsafeIDTokenVerifier(authn.VerifierConfig{}),
	)

	return interceptors.AuthenticatorFunc(func(ctx context.Context) (context.Context, error) {
		md, ok := metadata.FromIncomingContext(ctx)
		if !ok {
			return nil, errMissingMetadata
		}

		info, err := auth.Authenticate(ctx, authn.NewGRPCTokenProvider(md))
		if err != nil {
			// for now we return empty AuthInfo because this is how it worked before
			// but this is wrong, we need to be able to call resource store as grafana somehow
			return claims.WithClaims(ctx, &authn.AuthInfo{}), nil
		}

		return claims.WithClaims(ctx, info), nil
	})
}

func NewGrpcAuthenticator(authCfg *GrpcServerConfig, tracer tracing.Tracer) (interceptors.Authenticator, error) {
	if authCfg.Mode == ModeOnPrem {
		return NewInProcGrpcAuthenticator(), nil
	}

	opts := []authn.DefaultKeyRetrieverOption{}
	if authCfg.AllowInsecure {
		opts = append(opts, authn.WithHTTPClientKeyRetrieverOpt(&http.Client{Transport: &http.Transport{TLSClientConfig: &tls.Config{InsecureSkipVerify: true}}}))
	}

	keys := authn.NewKeyRetriever(authn.KeyRetrieverConfig{SigningKeysURL: authCfg.SigningKeysURL}, opts...)

	auth := authn.NewDefaultAuthenticator(
		authn.NewAccessTokenVerifier(authn.VerifierConfig{AllowedAudiences: authCfg.AllowedAudiences}, keys),
		authn.NewIDTokenVerifier(authn.VerifierConfig{}, keys),
	)

	return interceptors.AuthenticatorFunc(func(ctx context.Context) (context.Context, error) {
		spanCtx, span := tracer.Start(ctx, "GrpcAuthenticator.Authenticate")
		defer span.End()

		md, ok := metadata.FromIncomingContext(spanCtx)
		if !ok {
			return nil, errMissingMetadata
		}

		info, err := auth.Authenticate(ctx, authn.NewGRPCTokenProvider(md))
		if err != nil {
			span.RecordError(err)
			return nil, fmt.Errorf("failed to authenticate grpc request: %w", err)
		}

		return claims.WithClaims(ctx, info), nil
	}), nil
}

type contextFallbackKey struct{}

type AuthenticatorWithFallback struct {
	authenticator interceptors.Authenticator
	fallback      interceptors.Authenticator
	metrics       *metrics
	tracer        tracing.Tracer
}

func NewGrpcAuthenticatorWithFallback(cfg *setting.Cfg, reg prometheus.Registerer, tracer tracing.Tracer, fallback interceptors.Authenticator) (interceptors.Authenticator, error) {
	authCfg, err := ReadGrpcServerConfig(cfg)
	if err != nil {
		return nil, err
	}

	authenticator, err := NewGrpcAuthenticator(authCfg, tracer)
	if err != nil {
		return nil, err
	}

	if !authCfg.LegacyFallback {
		return authenticator, nil
	}

	return &AuthenticatorWithFallback{
		authenticator: authenticator,
		fallback:      fallback,
		metrics:       newMetrics(reg),
		tracer:        tracer,
	}, nil
}

func FallbackUsed(ctx context.Context) bool {
	return ctx.Value(contextFallbackKey{}) != nil
}

func (f *AuthenticatorWithFallback) Authenticate(ctx context.Context) (context.Context, error) {
	ctx, span := f.tracer.Start(ctx, "grpcutils.AuthenticatorWithFallback.Authenticate")
	defer span.End()

	// Try to authenticate with the new authenticator first
	span.SetAttributes(attribute.Bool("fallback_used", false))
	newCtx, err := f.authenticator.Authenticate(ctx)
	if err == nil {
		// fallback not used, authentication successful
		f.metrics.requestsTotal.WithLabelValues("false", "true").Inc()
		return newCtx, nil
	}

	// In case of error, fallback to the legacy authenticator
	span.SetAttributes(attribute.Bool("fallback_used", true))
	newCtx, err = f.fallback.Authenticate(ctx)
	if newCtx != nil {
		newCtx = context.WithValue(newCtx, contextFallbackKey{}, true)
	}
	f.metrics.requestsTotal.WithLabelValues("true", fmt.Sprintf("%t", err == nil)).Inc()
	return newCtx, err
}

const (
	metricsNamespace = "grafana"
	metricsSubSystem = "grpc_authenticator_with_fallback"
)

type metrics struct {
	requestsTotal *prometheus.CounterVec
}

func newMetrics(reg prometheus.Registerer) *metrics {
	m := &metrics{
		requestsTotal: prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Namespace: metricsNamespace,
				Subsystem: metricsSubSystem,
				Name:      "requests_total",
				Help:      "Number requests using the authenticator with fallback",
			}, []string{"fallback_used", "result"}),
	}

	if reg != nil {
		once.Do(func() {
			reg.MustRegister(m.requestsTotal)
		})
	}

	return m
}
