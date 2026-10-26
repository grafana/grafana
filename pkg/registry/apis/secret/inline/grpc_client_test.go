package inline

import (
	"context"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"net"
	"testing"

	"github.com/go-jose/go-jose/v4"
	"github.com/go-jose/go-jose/v4/jwt"
	authnlib "github.com/grafana/authlib/authn"
	"github.com/grafana/authlib/types"
	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/otel/trace/noop"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/test/bufconn"

	inlinev1beta1 "github.com/grafana/grafana/apps/secret/inline/v1beta1"
	secretv1beta1 "github.com/grafana/grafana/apps/secret/pkg/apis/secret/v1beta1"
	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

func TestGRPCInlineClient_CanReference_ForwardsRequester(t *testing.T) {
	t.Parallel()

	const namespace = "stacks-1234"
	userToken := referenceAccessToken(t, types.TypeUser)
	serviceAccountToken := referenceAccessToken(t, types.TypeServiceAccount)
	serviceToken := referenceAccessToken(t, types.TypeAccessPolicy)

	for _, tc := range []struct {
		name        string
		requester   *identity.StaticRequester
		wantSubject string
	}{
		{
			name: "user carried in access token",
			requester: &identity.StaticRequester{
				Type: types.TypeUser, AccessToken: userToken,
			},
			wantSubject: userToken,
		},
		{
			name: "service account carried in access token",
			requester: &identity.StaticRequester{
				Type: types.TypeServiceAccount, AccessToken: serviceAccountToken,
			},
			wantSubject: serviceAccountToken,
		},
		{
			name: "existing actor chain takes precedence over separate ID token",
			requester: &identity.StaticRequester{
				Type: types.TypeUser, AccessToken: userToken, IDToken: "user-id-token",
			},
			wantSubject: userToken,
		},
		{
			name: "separate user ID token accompanies a service access token",
			requester: &identity.StaticRequester{
				Type: types.TypeUser, AccessToken: serviceToken, IDToken: "user-id-token",
			},
			wantSubject: "user-id-token",
		},
		{
			name: "separate service account ID token",
			requester: &identity.StaticRequester{
				Type: types.TypeServiceAccount, IDToken: "service-account-id-token",
			},
			wantSubject: "service-account-id-token",
		},
		{
			name: "access policy carries its permissions through exchange",
			requester: &identity.StaticRequester{
				Type: types.TypeAccessPolicy, AccessToken: serviceToken,
			},
			wantSubject: serviceToken,
		},
		{
			name:      "legacy user without credentials keeps owned secret support",
			requester: &identity.StaticRequester{Type: types.TypeUser},
		},
		{
			name: "service account without ID token does not forward a service-only token",
			requester: &identity.StaticRequester{
				Type: types.TypeServiceAccount, AccessToken: serviceToken,
			},
		},
		{
			name: "internal calls without requester keep owned secret support",
		},
		{
			name:      "internal service without a token keeps owned secret support",
			requester: &identity.StaticRequester{Type: types.TypeAccessPolicy},
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			listener := bufconn.Listen(1024 * 1024)
			t.Cleanup(func() { require.NoError(t, listener.Close()) })
			server := grpc.NewServer()
			t.Cleanup(server.Stop)
			received := make(chan metadata.MD, 1)
			inlinev1beta1.RegisterInlineSecureValueServiceServer(server, &referenceServer{received: received})
			go func() { _ = server.Serve(listener) }()

			conn, err := grpc.NewClient("passthrough:///inline",
				grpc.WithTransportCredentials(insecure.NewCredentials()),
				grpc.WithContextDialer(func(context.Context, string) (net.Conn, error) { return listener.Dial() }),
			)
			require.NoError(t, err)
			t.Cleanup(func() { require.NoError(t, conn.Close()) })
			exchanger := &referenceTokenExchanger{}
			client := &GRPCInlineClient{
				conn: conn, tracer: noop.NewTracerProvider().Tracer("test"),
				tokenExchanger: exchanger, tokenExchangerNamespaceAll: true,
			}
			ctx := t.Context()
			if tc.requester != nil {
				tc.requester.Namespace = namespace
				ctx = types.WithAuthInfo(ctx, tc.requester)
			}
			err = client.CanReference(ctx, common.ObjectReference{Namespace: namespace}, "secret")
			require.NoError(t, err)
			require.Len(t, exchanger.requests, 1)
			wantNamespace := namespace
			if tc.wantSubject == "" {
				wantNamespace = "*"
			}
			require.True(t, tc.wantSubject == exchanger.requests[0].SubjectToken, "exchange must carry the requester's signed credentials")
			require.Equal(t, wantNamespace, exchanger.requests[0].Namespace)
			require.Equal(t, []string{secretv1beta1.APIGroup}, exchanger.requests[0].Audiences)
			require.Equal(t, []string{"exchanged-token"}, (<-received).Get("x-access-token"))
		})
	}
}

type referenceTokenExchanger struct {
	requests []authnlib.TokenExchangeRequest
}

func (e *referenceTokenExchanger) Exchange(_ context.Context, req authnlib.TokenExchangeRequest) (*authnlib.TokenExchangeResponse, error) {
	e.requests = append(e.requests, req)
	return &authnlib.TokenExchangeResponse{Token: "exchanged-token"}, nil
}

type referenceServer struct {
	inlinev1beta1.UnimplementedInlineSecureValueServiceServer
	received chan metadata.MD
}

func (s *referenceServer) CanReference(ctx context.Context, _ *inlinev1beta1.CanReferenceRequest) (*inlinev1beta1.CanReferenceResponse, error) {
	md, _ := metadata.FromIncomingContext(ctx)
	s.received <- md
	return &inlinev1beta1.CanReferenceResponse{}, nil
}

func referenceAccessToken(t *testing.T, identityType types.IdentityType) string {
	t.Helper()
	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	require.NoError(t, err)
	signer, err := jose.NewSigner(jose.SigningKey{Algorithm: jose.ES256, Key: key},
		(&jose.SignerOptions{}).WithType(jose.ContentType(authnlib.TokenTypeAccess)))
	require.NoError(t, err)
	claims := authnlib.AccessTokenClaims{Namespace: "stacks-1234"}
	if identityType != types.TypeAccessPolicy {
		claims.Actor = &authnlib.ActorClaims{
			Subject:       string(identityType) + ":requester",
			IDTokenClaims: authnlib.IDTokenClaims{Type: identityType},
		}
	}
	token, err := jwt.Signed(signer).Claims(jwt.Claims{Subject: "access-policy:api-server"}).Claims(claims).Serialize()
	require.NoError(t, err)
	return token
}
