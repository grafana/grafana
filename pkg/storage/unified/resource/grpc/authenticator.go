package grpc

import (
	"context"
	"crypto/tls"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"strconv"
	"sync"

	"go.opentelemetry.io/otel/attribute"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"

	"github.com/grafana/authlib/authn"
	"github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/grpcserver/interceptors"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/prometheus/client_golang/prometheus"
)

const (
	mdToken   = "grafana-idtoken"
	mdLogin   = "grafana-login"
	mdUserID  = "grafana-user-id"
	mdUserUID = "grafana-user-uid"
	mdOrgID   = "grafana-org-id"
	mdOrgRole = "grafana-org-role"
)

var logger = slog.Default().With("logger", "legacy.grpc.Authenticator")

// This is in a package we can no import
// var _ interceptors.Authenticator = (*Authenticator)(nil)

type Authenticator struct {
	Tracer tracing.Tracer
}

func (f *Authenticator) Authenticate(ctx context.Context) (context.Context, error) {
	ctx, span := f.Tracer.Start(ctx, "legacy.grpc.Authenticator.Authenticate")
	defer span.End()

	r, err := identity.GetRequester(ctx)
	if err == nil && r != nil {
		return ctx, nil // noop, requester exists
	}

	md, ok := metadata.FromIncomingContext(ctx)
	if !ok {
		err := status.Error(codes.Unauthenticated, "no metadata found in grpc context")
		span.RecordError(err)
		return nil, err
	}
	user, err := f.decodeMetadata(md)
	if err != nil {
		span.RecordError(err)
		return nil, err
	}
	return identity.WithRequester(ctx, user), nil
}

func (f *Authenticator) decodeMetadata(meta metadata.MD) (identity.Requester, error) {
	// Avoid NPE/panic with getting keys
	getter := func(key string) string {
		v := meta.Get(key)
		if len(v) > 0 {
			return v[0]
		}
		return ""
	}

	user := &identity.StaticRequester{}
	user.Login = getter(mdLogin)
	if user.Login == "" {
		return nil, status.Error(codes.Unauthenticated, "no login found in grpc metadata")
	}

	// The namespaced versions have a "-" in the key
	// TODO, remove after this has been deployed to unified storage
	if getter(mdUserID) == "" {
		var err error
		user.Type = types.TypeUser
		user.UserID, err = strconv.ParseInt(getter("grafana-userid"), 10, 64)
		if err != nil {
			return nil, status.Error(codes.Unauthenticated, "invalid user id")
		}
		user.OrgID, err = strconv.ParseInt(getter("grafana-orgid"), 10, 64)
		if err != nil {
			return nil, status.Error(codes.Unauthenticated, "invalid org id")
		}
		return user, nil
	}

	typ, id, err := types.ParseTypeID(getter(mdUserID))
	if err != nil {
		return nil, status.Error(codes.Unauthenticated, "invalid user id")
	}
	user.Type = typ
	user.UserID, err = strconv.ParseInt(id, 10, 64)
	if err != nil {
		return nil, status.Error(codes.Unauthenticated, "invalid user id")
	}

	_, uid, err := types.ParseTypeID(getter(mdUserUID))
	if err != nil {
		return nil, status.Error(codes.Unauthenticated, "invalid user uid")
	}
	user.UserUID = uid

	user.OrgID, err = strconv.ParseInt(getter(mdOrgID), 10, 64)
	if err != nil {
		return nil, status.Error(codes.Unauthenticated, "invalid org id")
	}
	user.OrgRole = identity.RoleType(getter(mdOrgRole))
	return user, nil
}

func UnaryClientInterceptor(ctx context.Context, method string, req, reply interface{}, cc *grpc.ClientConn, invoker grpc.UnaryInvoker, opts ...grpc.CallOption) error {
	ctx, err := wrapContext(ctx)
	if err != nil {
		return err
	}
	return invoker(ctx, method, req, reply, cc, opts...)
}

var _ grpc.UnaryClientInterceptor = UnaryClientInterceptor

func StreamClientInterceptor(ctx context.Context, desc *grpc.StreamDesc, cc *grpc.ClientConn, method string, streamer grpc.Streamer, opts ...grpc.CallOption) (grpc.ClientStream, error) {
	ctx, err := wrapContext(ctx)
	if err != nil {
		return nil, err
	}
	return streamer(ctx, desc, cc, method, opts...)
}

var _ grpc.StreamClientInterceptor = StreamClientInterceptor

func wrapContext(ctx context.Context) (context.Context, error) {
	user, err := identity.GetRequester(ctx)
	if err != nil {
		return ctx, err
	}

	// set grpc metadata into the context to pass to the grpc server
	return metadata.NewOutgoingContext(ctx, encodeIdentityInMetadata(user)), nil
}

func encodeIdentityInMetadata(user identity.Requester) metadata.MD {
	id, _ := user.GetInternalID()

	logger.Debug("encodeIdentityInMetadata", "user.id", user.GetID(), "user.Login", user.GetLogin(), "user.Name", user.GetName())

	return metadata.Pairs(
		// This should be everything needed to recreate the user
		mdToken, user.GetIDToken(),

		// Or we can create it directly
		mdUserID, user.GetID(),
		mdUserUID, user.GetUID(),
		mdOrgID, strconv.FormatInt(user.GetOrgID(), 10),
		mdOrgRole, string(user.GetOrgRole()),
		mdLogin, user.GetLogin(),

		// TODO, Remove after this is deployed to unified storage
		"grafana-userid", strconv.FormatInt(id, 10),
		"grafana-useruid", user.GetRawIdentifier(),
	)
}

type GrpcClientConfig struct {
	Token            string
	TokenExchangeURL string
	TokenNamespace   string
}

func ReadGrpcClientConfig(cfg *setting.Cfg) *GrpcClientConfig {
	section := cfg.SectionWithEnvOverrides("grpc_client_authentication")
	return &GrpcClientConfig{
		Token:            section.Key("token").MustString(""),
		TokenExchangeURL: section.Key("token_exchange_url").MustString(""),
		TokenNamespace:   section.Key("token_namespace").MustString("stacks-" + cfg.StackID),
	}
}

// TODO: use authlib/grpcutils
type GrpcAuthenticatorConfig struct {
	SigningKeysURL   string
	LegacyFallback   bool
	AllowedAudiences []string
	AllowInsecure    bool
}

func ReadGrpcServerConfig(cfg *setting.Cfg) *GrpcAuthenticatorConfig {
	section := cfg.SectionWithEnvOverrides("grpc_server_authentication")

	return &GrpcAuthenticatorConfig{
		SigningKeysURL:   section.Key("signing_keys_url").MustString(""),
		AllowedAudiences: section.Key("allowed_audiences").Strings(","),
		LegacyFallback:   section.Key("legacy_fallback").MustBool(true),
		AllowInsecure:    cfg.Env == setting.Dev,
	}
}

type contextFallbackKey struct{}

type authenticatorWithFallback struct {
	authenticator interceptors.Authenticator
	fallback      interceptors.Authenticator
	metrics       *metrics
	tracer        tracing.Tracer
}

func WithFallback(ctx context.Context) context.Context {
	return context.WithValue(ctx, contextFallbackKey{}, true)
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
		newCtx = context.WithValue(ctx, contextFallbackKey{}, true)
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

// TODO: use authlib/grpcutils
func NewAuthenticator(cfg *GrpcAuthenticatorConfig, tracer tracing.Tracer) interceptors.Authenticator {
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

	return newAuthenticatorInterceptor(auth, tracer)
}

func newAuthenticatorInterceptor(auth authn.Authenticator, tracer tracing.Tracer) interceptors.Authenticator {
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
			if authn.IsUnauthenticatedErr(err) {
				return nil, status.Error(codes.Unauthenticated, err.Error())
			}

			return ctx, status.Error(codes.Internal, err.Error())
		}

		// FIXME: Add attribute with service subject once https://github.com/grafana/authlib/issues/139 is closed.
		span.SetAttributes(attribute.String("subject", info.GetUID()))
		span.SetAttributes(attribute.Bool("service", types.IsIdentityType(info.GetIdentityType(), types.TypeAccessPolicy)))
		return types.WithAuthInfo(ctx, info), nil
	})
}

func NewInProcGrpcAuthenticator() interceptors.Authenticator {
	return newAuthenticatorInterceptor(
		authn.NewDefaultAuthenticator(
			authn.NewUnsafeAccessTokenVerifier(authn.VerifierConfig{}),
			authn.NewUnsafeIDTokenVerifier(authn.VerifierConfig{}),
		),
		tracing.NewNoopTracerService(),
	)
}
