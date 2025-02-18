package grpcutils

import (
	"context"
	"crypto/tls"
	"errors"
	"fmt"
	"net/http"
	"sync"

	"github.com/grafana/authlib/authn"
	"github.com/grafana/authlib/types"
	"github.com/prometheus/client_golang/prometheus"
	"go.opentelemetry.io/otel/attribute"
	"google.golang.org/grpc/metadata"

	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/grpcserver/interceptors"
	"github.com/grafana/grafana/pkg/setting"
)

func NewInProcGrpcAuthenticator() interceptors.Authenticator {
	return newAuthenticator(
		authn.NewDefaultAuthenticator(
			authn.NewUnsafeAccessTokenVerifier(authn.VerifierConfig{}),
			authn.NewUnsafeIDTokenVerifier(authn.VerifierConfig{}),
		),
		tracing.NewNoopTracerService(),
	)
}

func NewAuthenticator(cfg *GrpcServerConfig, tracer tracing.Tracer) interceptors.Authenticator {
	client := http.DefaultClient
	if cfg.AllowInsecure {
		client = &http.Client{Transport: &http.Transport{TLSClientConfig: &tls.Config{InsecureSkipVerify: true}}}
	}

	kr := authn.NewKeyRetriever(authn.KeyRetrieverConfig{
		SigningKeysURL: cfg.SigningKeysURL,
	}, authn.WithHTTPClientKeyRetrieverOpt(client))

	auth := authn.NewDefaultAuthenticator(
		authn.NewAccessTokenVerifier(authn.VerifierConfig{AllowedAudiences: cfg.AllowedAudiences}, kr),
		authn.NewIDTokenVerifier(authn.VerifierConfig{}, kr),
	)

	return newAuthenticator(auth, tracer)
}

func NewAuthenticatorWithFallback(cfg *setting.Cfg, reg prometheus.Registerer, tracer tracing.Tracer, fallback interceptors.Authenticator) interceptors.Authenticator {
	authCfg := ReadGrpcServerConfig(cfg)
	authenticator := NewAuthenticator(authCfg, tracer)
	if !authCfg.LegacyFallback {
		return authenticator
	}

	return &authenticatorWithFallback{
		authenticator: authenticator,
		fallback:      fallback,
		tracer:        tracer,
		metrics:       newMetrics(reg),
	}
}

func newAuthenticator(auth authn.Authenticator, tracer tracing.Tracer) interceptors.Authenticator {
	return interceptors.AuthenticatorFunc(func(ctx context.Context) (context.Context, error) {
		ctx, span := tracer.Start(ctx, "grpcutils.Authenticate")
		defer span.End()

		md, ok := metadata.FromIncomingContext(ctx)
		if !ok {
			return nil, errors.New("missing metedata in context")
		}

		info, err := auth.Authenticate(ctx, authn.NewGRPCTokenProvider(md))
		if err != nil {
			span.RecordError(err)
			return ctx, err
		}

		// FIXME: Add attribute with service subject once https://github.com/grafana/authlib/issues/139 is closed.
		span.SetAttributes(attribute.String("subject", info.GetUID()))
		span.SetAttributes(attribute.Bool("service", types.IsIdentityType(info.GetIdentityType(), types.TypeAccessPolicy)))
		return types.WithAuthInfo(ctx, info), nil
	})
}

type authenticatorWithFallback struct {
	authenticator interceptors.Authenticator
	fallback      interceptors.Authenticator
	metrics       *metrics
	tracer        tracing.Tracer
}

type contextFallbackKey struct{}

func FallbackUsed(ctx context.Context) bool {
	return ctx.Value(contextFallbackKey{}) != nil
}

func (f *authenticatorWithFallback) Authenticate(ctx context.Context) (context.Context, error) {
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

var once sync.Once

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
