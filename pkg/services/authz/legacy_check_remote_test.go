package authz

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
	"github.com/grafana/authlib/grpcutils"
	grpcAuth "github.com/grpc-ecosystem/go-grpc-middleware/v2/interceptors/auth"
	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/otel/trace/noop"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/test/bufconn"

	"github.com/grafana/grafana/pkg/services/accesscontrol"
	legacyv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
	"github.com/grafana/grafana/pkg/services/authz/rbac"
)

// Exercises the production JWT verifier and serialized gRPC transport. The
// permission store is a fixture; this does not prove standalone SQL/resolver parity.
func TestLegacyCheckAuthenticatedRPC(t *testing.T) {
	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	require.NoError(t, err)
	keys := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewEncoder(w).Encode(jose.JSONWebKeySet{Keys: []jose.JSONWebKey{{Key: key.Public(), KeyID: "test", Algorithm: string(jose.ES256)}}})
	}))
	t.Cleanup(keys.Close)
	sign := func(namespace, audience string) string {
		signer, err := jose.NewSigner(jose.SigningKey{Algorithm: jose.ES256, Key: key}, (&jose.SignerOptions{}).WithType(jose.ContentType(authn.TokenTypeAccess)).WithHeader("kid", "test"))
		require.NoError(t, err)
		token, err := jwt.Signed(signer).Claims(jwt.Claims{Subject: "access-policy:iam", Audience: jwt.Audience{audience}, Expiry: jwt.NewNumericDate(time.Now().Add(time.Minute))}).Claims(authn.AccessTokenClaims{Namespace: namespace}).Serialize()
		require.NoError(t, err)
		return token
	}
	authenticate := grpcutils.NewAuthenticator(&grpcutils.AuthenticatorConfig{SigningKeysURL: keys.URL, AllowedAudiences: []string{AuthzServiceAudience}}, noop.NewTracerProvider().Tracer("test"))
	server := grpc.NewServer(grpc.UnaryInterceptor(grpcAuth.UnaryServerInterceptor(authenticate)))
	registerLegacyCheckService(server, rbac.NewTestService("subject", []accesscontrol.Permission{{Action: "ldap:read"}}, nil))
	listener := bufconn.Listen(1024 * 1024)
	go func() { _ = server.Serve(listener) }()
	t.Cleanup(server.Stop)
	t.Cleanup(func() { _ = listener.Close() })
	conn, err := grpc.NewClient("passthrough:///authz", grpc.WithTransportCredentials(insecure.NewCredentials()), grpc.WithContextDialer(func(context.Context, string) (net.Conn, error) { return listener.Dial() }))
	require.NoError(t, err)
	t.Cleanup(func() { _ = conn.Close() })
	client := legacyv1.NewLegacyAuthzServiceClient(conn)
	for _, tc := range []struct {
		name, token, namespace, action string
		allowed, wantError             bool
	}{
		{name: "holder", token: sign("stacks-1", AuthzServiceAudience), namespace: "stacks-1", action: "ldap:read", allowed: true},
		{name: "nonholder", token: sign("stacks-1", AuthzServiceAudience), namespace: "stacks-1", action: "ldap:write"},
		{name: "different tenant", token: sign("stacks-1", AuthzServiceAudience), namespace: "stacks-2", action: "ldap:read", wantError: true},
		{name: "wrong audience", token: sign("stacks-1", "another-service"), namespace: "stacks-1", action: "ldap:read", wantError: true},
		{name: "invalid signature", token: sign("stacks-1", AuthzServiceAudience) + "invalid", namespace: "stacks-1", action: "ldap:read", wantError: true},
		{name: "unauthenticated", namespace: "stacks-1", action: "ldap:read", wantError: true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			ctx, cancel := context.WithTimeout(t.Context(), 5*time.Second)
			defer cancel()
			if tc.token != "" {
				ctx = metadata.NewOutgoingContext(ctx, metadata.Pairs("x-access-token", tc.token))
			}
			allowed, err := LegacyCheck(ctx, client, &legacyv1.LegacyCheckRequest{Namespace: tc.namespace, Subject: "user:subject", SkipCache: true, Expression: &legacyv1.LegacyExpression{Node: &legacyv1.LegacyExpression_Permission{Permission: &legacyv1.LegacyPermission{Action: tc.action}}}})
			if tc.wantError {
				require.Error(t, err)
			} else {
				require.NoError(t, err)
			}
			require.Equal(t, tc.allowed, allowed)
		})
	}
}
