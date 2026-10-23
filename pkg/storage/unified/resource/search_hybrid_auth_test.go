package resource

import (
	"context"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"encoding/json"
	"net"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/go-jose/go-jose/v4"
	"github.com/go-jose/go-jose/v4/jwt"
	"github.com/grafana/authlib/authn"
	"github.com/grafana/authlib/authz"
	"github.com/grafana/authlib/grpcutils"
	"github.com/grafana/authlib/types"
	grpcAuth "github.com/grpc-ecosystem/go-grpc-middleware/v2/interceptors/auth"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/otel"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"

	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/search/vector"
)

func TestHybridSearch_AuthenticatedInframemoryServiceRead(t *testing.T) {
	const group = "assistant.inframemories.ext.grafana.app"
	const resource = "inframemories"
	const collection = group + "/" + resource
	const namespace = "stacks-1"

	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	require.NoError(t, err)
	jwks, err := json.Marshal(jose.JSONWebKeySet{Keys: []jose.JSONWebKey{{
		Key: &key.PublicKey, KeyID: "inframemory-test", Algorithm: string(jose.ES256), Use: "sig",
	}}})
	require.NoError(t, err)
	keys := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write(jwks)
	}))
	t.Cleanup(keys.Close)

	sign := func(signingKey *ecdsa.PrivateKey, tokenType string, claims any) string {
		t.Helper()
		signer, err := jose.NewSigner(jose.SigningKey{Algorithm: jose.ES256, Key: signingKey},
			&jose.SignerOptions{ExtraHeaders: map[jose.HeaderKey]any{"typ": tokenType, "kid": "inframemory-test"}})
		require.NoError(t, err)
		token, err := jwt.Signed(signer).Claims(claims).Serialize()
		require.NoError(t, err)
		return token
	}
	common := jwt.Claims{
		Issuer: "grafana", Subject: "access-policy:caller", Audience: jwt.Audience{"resourceStore"},
		IssuedAt: jwt.NewNumericDate(time.Now().Add(-time.Minute)),
		Expiry:   jwt.NewNumericDate(time.Now().Add(time.Hour)),
	}
	accessToken := func(signingKey *ecdsa.PrivateKey, service string, actor *authn.ActorClaims) string {
		return sign(signingKey, authn.TokenTypeAccess, authn.Claims[authn.AccessTokenClaims]{
			Claims: common,
			Rest: authn.AccessTokenClaims{
				Namespace: "*", ServiceIdentity: service, Permissions: []string{collection + ":get"},
				DelegatedPermissions: []string{collection + ":get"}, Actor: actor,
			},
		})
	}

	backend := &fakeVectorBackend{
		collection: &vector.Collection{Group: group, Resource: resource, PartitionKey: resource, IsExternal: true},
		results:    []vector.VectorSearchResult{{UID: "memory", Title: "Memory", Score: 0.1}},
	}
	lexical := &fakeLexicalSearcher{hits: []vector.LexicalHit{{UID: "memory", Title: "Memory"}}}
	access := NewAuthzLimitedClient(authz.NewClient(nil), AuthzOptions{Registry: prometheus.NewRegistry()})
	s, index, embeddingClient := newHybridTestServer(lexTableResponse(), backend, access)
	s.externalLexical = lexical
	s.collectionAllowlist = vector.NewCollectionAllowlist(nil, []string{collection})
	s.allowedReadServices = map[string][]string{collection: {"assistant"}}

	identities := make(chan types.AuthInfo, 5)
	authenticator := grpcutils.NewAuthenticator(&grpcutils.AuthenticatorConfig{
		SigningKeysURL: keys.URL, AllowedAudiences: []string{"resourceStore"},
	}, otel.Tracer("inframemory-auth-test"))
	server := grpc.NewServer(grpc.ChainUnaryInterceptor(
		grpcAuth.UnaryServerInterceptor(authenticator),
		func(ctx context.Context, req any, _ *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (any, error) {
			info, ok := types.AuthInfoFrom(ctx)
			if !ok {
				return nil, status.Error(codes.Internal, "authenticated request has no identity")
			}
			identities <- info
			return handler(ctx, req)
		},
	))
	resourcepb.RegisterResourceIndexServer(server, s)
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	require.NoError(t, err)
	go func() { _ = server.Serve(listener) }()
	t.Cleanup(server.Stop)

	rawConn, err := grpc.NewClient(listener.Addr().String(), grpc.WithTransportCredentials(insecure.NewCredentials()))
	require.NoError(t, err)
	t.Cleanup(func() { _ = rawConn.Close() })
	request := &resourcepb.HybridSearchRequest{
		Key: &resourcepb.ResourceKey{Namespace: namespace, Group: group, Resource: resource}, Query: "memory",
	}

	t.Run("direct assistant service exchange", func(t *testing.T) {
		requests := make(chan authn.TokenExchangeRequest, 1)
		assistantToken := accessToken(key, "assistant", nil)
		exchange := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			var exchangeRequest authn.TokenExchangeRequest
			if err := json.NewDecoder(r.Body).Decode(&exchangeRequest); err != nil {
				http.Error(w, err.Error(), http.StatusBadRequest)
				return
			}
			requests <- exchangeRequest
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(map[string]any{"data": map[string]string{
				"token": assistantToken,
			}})
		}))
		defer exchange.Close()
		exchanger, err := authn.NewTokenExchangeClient(authn.TokenExchangeConfig{
			Token: "local-test-cap", TokenExchangeURL: exchange.URL,
		})
		require.NoError(t, err)
		interceptor := authn.NewGrpcClientInterceptor(exchanger,
			authn.WithClientInterceptorNamespace("*"),
			authn.WithClientInterceptorAudience([]string{"resourceStore"}),
		)
		conn, err := grpc.NewClient(listener.Addr().String(), grpc.WithTransportCredentials(insecure.NewCredentials()),
			grpc.WithUnaryInterceptor(interceptor.UnaryClientInterceptor))
		require.NoError(t, err)
		defer func() { _ = conn.Close() }()
		resp, err := resourcepb.NewResourceIndexClient(conn).HybridSearch(t.Context(), request)
		require.NoError(t, err)
		require.Len(t, resp.Results, 1)
		require.Equal(t, "memory", resp.Results[0].Key.Name)
		require.Equal(t, authn.TokenExchangeRequest{Namespace: "*", Audiences: []string{"resourceStore"}}, <-requests)
		info := <-identities
		require.Equal(t, types.TypeAccessPolicy, info.GetIdentityType())
		require.Equal(t, []string{"assistant"}, info.GetExtra()[authn.ServiceIdentityKey])
		require.True(t, lexical.called)
		require.Equal(t, namespace, backend.gotNamespace)
		require.Equal(t, resource, backend.gotResource)
		require.NotEmpty(t, backend.gotEmbedding)
		require.Nil(t, index.gotReq)
	})

	callWithTokens := func(t *testing.T, accessToken, idToken string) (*resourcepb.HybridSearchResponse, error) {
		t.Helper()
		md := metadata.Pairs("x-access-token", accessToken)
		if idToken != "" {
			md.Set("x-id-token", idToken)
		}
		return resourcepb.NewResourceIndexClient(rawConn).HybridSearch(metadata.NewOutgoingContext(t.Context(), md), request)
	}
	user := authn.IDTokenClaims{Type: types.TypeUser, Identifier: "1", Namespace: namespace}
	for _, tc := range []struct {
		name         string
		accessToken  string
		idToken      string
		identityType types.IdentityType
	}{
		{name: "other service", accessToken: accessToken(key, "other", nil), identityType: types.TypeAccessPolicy},
		{name: "separate user ID token", accessToken: accessToken(key, "assistant", nil),
			identityType: types.TypeUser,
			idToken: sign(key, authn.TokenTypeID, authn.Claims[authn.IDTokenClaims]{Claims: jwt.Claims{
				Issuer: "grafana", Subject: "user:1", Audience: jwt.Audience{"resourceStore"},
				IssuedAt: common.IssuedAt, Expiry: common.Expiry,
			}, Rest: user})},
		{name: "embedded user", identityType: types.TypeUser, accessToken: accessToken(key, "assistant", &authn.ActorClaims{
			Subject: "user:1", IDTokenClaims: user,
		})},
	} {
		t.Run(tc.name, func(t *testing.T) {
			before := backend.resolveCalls
			embeddingClient.gotIn.Texts = nil
			resp, err := callWithTokens(t, tc.accessToken, tc.idToken)
			require.Equal(t, codes.PermissionDenied, status.Code(err))
			require.Nil(t, resp)
			require.Equal(t, before, backend.resolveCalls)
			require.Nil(t, index.gotReq)
			require.Empty(t, embeddingClient.gotIn.Texts)
			require.Equal(t, tc.identityType, (<-identities).GetIdentityType())
		})
	}

	t.Run("invalid signature", func(t *testing.T) {
		otherKey, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
		require.NoError(t, err)
		before := backend.resolveCalls
		resp, err := callWithTokens(t, accessToken(otherKey, "assistant", nil), "")
		require.ErrorContains(t, err, jose.ErrCryptoFailure.Error())
		require.Nil(t, resp)
		require.Equal(t, before, backend.resolveCalls)
		require.Empty(t, identities)
	})
}
