package resourceclient

import (
	"context"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/tls"
	"fmt"
	"net/http"

	"github.com/fullstorydev/grpchan"
	"github.com/go-jose/go-jose/v4"
	"github.com/go-jose/go-jose/v4/jwt"
	"github.com/open-feature/go-sdk/openfeature"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"go.opentelemetry.io/otel/trace"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	authnlib "github.com/grafana/authlib/authn"
	"github.com/grafana/authlib/types"
	"github.com/grafana/grafana-app-sdk/logging"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// Feature flag names as generated in pkg/services/featuremgmt, repeated so this module does
// not depend on the grafana core module.
const (
	FlagUnifiedStorageClientRequireCallerIdentity = "unifiedStorageClient.requireCallerIdentity"
	FlagUnifiedStorageClientOnBehalfOf            = "unifiedStorageClient.onBehalfOf"
)

//go:generate mockery --name ResourceClient --structname MockResourceClient --inpackage --filename client_mock.go --with-expecter
type ResourceClient interface {
	SearchClient
	resourcepb.ResourceStoreClient
	resourcepb.ResourceStatsClient
	resourcepb.BulkStoreClient
	resourcepb.BlobStoreClient
	resourcepb.QuotasClient
}

type SearchClient interface {
	resourcepb.ResourceIndexClient
	resourcepb.ManagedObjectIndexClient
	resourcepb.DiagnosticsClient //nolint:staticcheck
}

// Internal implementation
type resourceClient struct {
	resourcepb.ResourceStoreClient
	resourcepb.ResourceStatsClient
	resourcepb.ResourceIndexClient
	resourcepb.ManagedObjectIndexClient
	resourcepb.BulkStoreClient
	resourcepb.BlobStoreClient
	resourcepb.DiagnosticsClient
	resourcepb.QuotasClient
}

// NewResourceClientFromConns sends store calls over storageCc and index calls over indexCc.
// Interceptors must already be applied to both connections.
func NewResourceClientFromConns(storageCc grpc.ClientConnInterface, indexCc grpc.ClientConnInterface) ResourceClient {
	return &resourceClient{
		ResourceStoreClient:      resourcepb.NewResourceStoreClient(storageCc),
		ResourceStatsClient:      resourcepb.NewResourceStatsClient(storageCc),
		ResourceIndexClient:      resourcepb.NewResourceIndexClient(indexCc),
		ManagedObjectIndexClient: resourcepb.NewManagedObjectIndexClient(indexCc),
		BulkStoreClient:          resourcepb.NewBulkStoreClient(storageCc),
		BlobStoreClient:          newBlobStoreClient(storageCc),
		DiagnosticsClient:        resourcepb.NewDiagnosticsClient(storageCc),
		QuotasClient:             resourcepb.NewQuotasClient(storageCc),
	}
}

func NewAuthlessResourceClient(cc grpc.ClientConnInterface) ResourceClient {
	return NewResourceClientFromConns(cc, cc)
}

type RemoteResourceClientConfig struct {
	Token            string
	TokenExchangeURL string
	Audiences        []string
	Namespace        string
	AllowInsecure    bool
	IsDev            bool
	// TokenExchanger overrides the default exchange client when non-nil.
	TokenExchanger authnlib.TokenExchanger

	// RequireCallerIdentity decides, per request, whether to fail a user request the client
	// cannot carry an identity for rather than calling storage as the service. Nil defers to
	// the unifiedStorageClient.requireCallerIdentity feature flag.
	RequireCallerIdentity func(context.Context) bool

	// OnBehalfOf decides, per request, whether a caller already carried inside the verified
	// access token is exchanged on behalf of that caller (caller's token as exchange subject,
	// scoped to the caller's namespace) instead of being flattened into the plain service
	// exchange. Nil defers to the unifiedStorageClient.onBehalfOf feature flag.
	OnBehalfOf func(context.Context) bool

	// CarriesCallerIdentity marks a client whose TokenExchanger already puts the caller in
	// the access token, so a missing ID token is not an identity drop.
	//
	// Deprecated: superseded by OnBehalfOf; kept only until enterprise apiextensions migrates.
	CarriesCallerIdentity bool
}

// onBehalfOfPolicy resolves the per-request OBO decision, deferring to the feature flag
// when the config does not override it.
func (cfg RemoteResourceClientConfig) onBehalfOfPolicy() func(context.Context) bool {
	if cfg.OnBehalfOf != nil {
		return cfg.OnBehalfOf
	}
	return onBehalfOfFlag
}

func NewRemoteResourceClient(tracer trace.Tracer, conn grpc.ClientConnInterface, indexConn grpc.ClientConnInterface, cfg RemoteResourceClientConfig) (ResourceClient, error) {
	clientInt, err := NewAuthnGrpcClientInterceptor(tracer, cfg)
	if err != nil {
		return nil, err
	}

	cc := grpchan.InterceptClientConn(conn, clientInt.UnaryClientInterceptor, clientInt.StreamClientInterceptor)
	cci := grpchan.InterceptClientConn(indexConn, clientInt.UnaryClientInterceptor, clientInt.StreamClientInterceptor)
	return NewResourceClientFromConns(cc, cci), nil
}

// NewAuthnGrpcClientInterceptor builds the authlib gRPC client interceptor used to authenticate outbound calls to
// unified storage services. Will use the in-process token exchanger when the token exchange url is empty and dev mode is enabled.
func NewAuthnGrpcClientInterceptor(tracer trace.Tracer, cfg RemoteResourceClientConfig) (*authnlib.GrpcClientInterceptor, error) {
	var tc authnlib.TokenExchanger
	if cfg.TokenExchanger != nil {
		tc = cfg.TokenExchanger
	} else if cfg.TokenExchangeURL == "" {
		if !cfg.IsDev {
			return nil, fmt.Errorf("token exchange url is required outside of development mode")
		}
		tc = ProvideInProcExchanger()
	} else {
		exchangeOpts := []authnlib.ExchangeClientOpts{}
		if cfg.AllowInsecure {
			// Matches the client this replaces. Raising the minimum TLS version is a separate change.
			// nosemgrep: go.lang.security.audit.crypto.missing-ssl-minversion.missing-ssl-minversion
			exchangeOpts = append(exchangeOpts, authnlib.WithHTTPClient(&http.Client{Transport: &http.Transport{TLSClientConfig: &tls.Config{InsecureSkipVerify: true}}}))
		}
		client, err := authnlib.NewTokenExchangeClient(authnlib.TokenExchangeConfig{
			Token:            cfg.Token,
			TokenExchangeURL: cfg.TokenExchangeURL,
		}, exchangeOpts...)
		if err != nil {
			return nil, err
		}
		tc = client
	}

	// Wrapped unconditionally: the wrapper passes through unless the per-request policy
	// says otherwise, so flag-off behaviour is identical to an unwrapped exchanger.
	tc = &onBehalfOfExchanger{delegate: tc, enabled: cfg.onBehalfOfPolicy()}

	return authnlib.NewGrpcClientInterceptor(
		tc,
		authnlib.WithClientInterceptorTracer(tracer),
		authnlib.WithClientInterceptorNamespace(cfg.Namespace),
		authnlib.WithClientInterceptorAudience(cfg.Audiences),
		authnlib.WithClientInterceptorIDTokenExtractor(newIDTokenExtractor(cfg)),
	), nil
}

// Resolved per call because Grafana installs the App SDK default logger at startup, after
// package-level variables are initialized.
func authLogger(ctx context.Context) logging.Logger {
	return logging.FromContext(ctx).With("logger", "resource-client-auth-interceptor")
}

// How the caller was represented on an outgoing storage call.
const (
	identityModeService         = "service"          // internal service identity, or an access policy calling on its own behalf
	identityModeIDToken         = "id_token"         // user, ID token forwarded alongside the service token
	identityModeOnBehalfOf      = "obo"              // user, carried inside the exchanged access token
	identityModeFallbackService = "fallback_service" // user identity dropped; storage authorizes the service instead
	identityModeDenied          = "denied"           // user identity dropped and the fallback is switched off
	identityModeCancelled       = "cancelled"        // user identity dropped but the request is already done; nothing is sent
	identityModeForwarded       = "forwarded"        // original authenticated access token and optional ID token
)

// Package level so the store and index clients sharing an interceptor do not register twice.
var clientIdentityTotal = promauto.NewCounterVec(prometheus.CounterOpts{
	Name: "grafana_unified_storage_client_identity_total",
	Help: "Outgoing unified storage calls by how the caller's identity was carried.",
}, []string{"mode"})

// RecordForwardedClientIdentity counts an attempted call carrying the original authenticated credentials.
func RecordForwardedClientIdentity() {
	clientIdentityTotal.WithLabelValues(identityModeForwarded).Inc()
}

// IDTokenExtractor keeps the service-identity fallback unconditionally and never exchanges
// on behalf of the caller. Used by the in-process client, whose token never leaves the
// process and whose on-prem users have no ID token.
var IDTokenExtractor = newIDTokenExtractor(RemoteResourceClientConfig{
	RequireCallerIdentity: func(context.Context) bool { return false },
	OnBehalfOf:            func(context.Context) bool { return false },
})

// requireCallerIdentityFlag reads the deny policy from OpenFeature per request: the provider is
// only reachable after the client is built, and targeting is per namespace.
func requireCallerIdentityFlag(ctx context.Context) bool {
	return openfeature.NewDefaultClient().Boolean(ctx,
		FlagUnifiedStorageClientRequireCallerIdentity, false,
		openfeature.TransactionContext(ctx))
}

func newIDTokenExtractor(cfg RemoteResourceClientConfig) func(context.Context) (string, error) {
	requireCallerIdentity := cfg.RequireCallerIdentity
	if requireCallerIdentity == nil {
		requireCallerIdentity = requireCallerIdentityFlag
	}
	onBehalfOf := cfg.onBehalfOfPolicy()

	return func(ctx context.Context) (string, error) {
		if identity.IsServiceIdentity(ctx) {
			clientIdentityTotal.WithLabelValues(identityModeService).Inc()
			return "", nil
		}

		info, ok := types.AuthInfoFrom(ctx)
		if !ok {
			return "", fmt.Errorf("no claims found")
		}

		switch {
		// If the identity is the service identity, we don't need to extract the ID token
		case info.GetIdentityType() == types.TypeAccessPolicy:
			clientIdentityTotal.WithLabelValues(identityModeService).Inc()
			return "", nil
		// The exchanger applies the same predicate and carries the caller inside the
		// exchanged token, so nothing is forwarded here: pure OBO, no ID token.
		case onBehalfOfSubjectToken(info) != "" && onBehalfOf(ctx):
			clientIdentityTotal.WithLabelValues(identityModeOnBehalfOf).Inc()
			return "", nil
		case len(info.GetIDToken()) != 0:
			clientIdentityTotal.WithLabelValues(identityModeIDToken).Inc()
			return info.GetIDToken(), nil
		case cfg.CarriesCallerIdentity:
			clientIdentityTotal.WithLabelValues(identityModeOnBehalfOf).Inc()
			return "", nil
		}

		// A user request with nothing to forward. The exchanged service token is all storage
		// sees, so it authorizes the service across every namespace rather than the user.
		logger := authLogger(ctx).With(
			"subject", info.GetSubject(),
			"uid", info.GetUID(),
			"namespace", info.GetNamespace(),
			"callerService", extraClaim(info, authnlib.ServiceIdentityKey),
			"originService", extraClaim(info, authnlib.InnermostServiceIdentityKey),
		)

		// The call cannot succeed on a done context, so it is neither a fallback nor a denial.
		if err := ctx.Err(); err != nil {
			clientIdentityTotal.WithLabelValues(identityModeCancelled).Inc()
			logger.Debug("request cancelled, not calling resource store as the service")
			return "", status.FromContextError(err).Err()
		}

		if requireCallerIdentity(ctx) {
			clientIdentityTotal.WithLabelValues(identityModeDenied).Inc()
			logger.Error("refusing to call resource store as the service for a user request without an id token")
			return "", status.Error(codes.PermissionDenied, "caller identity is required to call unified storage")
		}

		clientIdentityTotal.WithLabelValues(identityModeFallbackService).Inc()
		logger.Warn("calling resource store as the service without id token or marking it as the service identity")

		return "", nil
	}
}

// extraClaim reads a single-valued claim the authenticator attached to the request. Used to
// name the services if possible in the caller's actor chain, so a dropped identity can be traced back to
// both the service that sent it and the one that started the chain.
// Can be removed after the rollout and cleanup of the ID token extractor.
func extraClaim(info types.AuthInfo, key string) string {
	if v := info.GetExtra()[key]; len(v) > 0 {
		return v[0]
	}
	return ""
}

func ProvideInProcExchanger() authnlib.StaticTokenExchanger {
	token, err := createInProcToken()
	if err != nil {
		panic(err)
	}

	return authnlib.NewStaticTokenExchanger(token)
}

func createInProcToken() (string, error) {
	// Generate ES256 private key
	privateKey, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		return "", fmt.Errorf("failed to generate ES256 private key: %w", err)
	}

	// Create signer with ES256 algorithm
	signer, err := jose.NewSigner(jose.SigningKey{Algorithm: jose.ES256, Key: privateKey}, &jose.SignerOptions{
		ExtraHeaders: map[jose.HeaderKey]interface{}{
			jose.HeaderKey("typ"): authnlib.TokenTypeAccess,
		},
	})
	if err != nil {
		return "", fmt.Errorf("failed to create signer: %w", err)
	}

	// Create claims
	claims := authnlib.Claims[authnlib.AccessTokenClaims]{
		Claims: jwt.Claims{
			Issuer:   "grafana",
			Subject:  types.NewTypeID(types.TypeAccessPolicy, "grafana"),
			Audience: []string{"resourceStore"},
		},
		Rest: authnlib.AccessTokenClaims{
			Namespace:            "*",
			Permissions:          identity.ServiceIdentityClaims.Rest.Permissions,
			DelegatedPermissions: identity.ServiceIdentityClaims.Rest.DelegatedPermissions,
		},
	}

	// Sign and create the JWT
	token, err := jwt.Signed(signer).Claims(claims).Serialize()
	if err != nil {
		return "", fmt.Errorf("failed to sign JWT: %w", err)
	}

	return token, nil
}
