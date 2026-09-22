package resource

import (
	"context"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"testing"

	"github.com/go-jose/go-jose/v4"
	"github.com/go-jose/go-jose/v4/jwt"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/otel/trace/noop"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"

	authnlib "github.com/grafana/authlib/authn"
	"github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

// signAccessToken signs claims the way the auth signer would, so the unverified parse in
// onBehalfOfSubjectToken sees the real JWT shape.
func signAccessToken(t *testing.T, rest authnlib.AccessTokenClaims) string {
	t.Helper()

	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	require.NoError(t, err)

	signer, err := jose.NewSigner(jose.SigningKey{Algorithm: jose.ES256, Key: key}, &jose.SignerOptions{
		ExtraHeaders: map[jose.HeaderKey]interface{}{jose.HeaderKey("typ"): authnlib.TokenTypeAccess},
	})
	require.NoError(t, err)

	token, err := jwt.Signed(signer).Claims(authnlib.Claims[authnlib.AccessTokenClaims]{
		Claims: jwt.Claims{Subject: "access-policy:gateway"},
		Rest:   rest,
	}).Serialize()
	require.NoError(t, err)
	return token
}

// userActorToken is an access token whose actor chain ends in a user: the OBO shape the
// gateway for example produces.
func userActorToken(t *testing.T) string {
	t.Helper()
	return signAccessToken(t, authnlib.AccessTokenClaims{
		Namespace: "stacks-1",
		Actor: &authnlib.ActorClaims{
			Subject:       "user:1",
			IDTokenClaims: authnlib.IDTokenClaims{Type: types.TypeUser},
		},
	})
}

// serviceActorToken is a classic access token: the actor chain, if any, holds only services.
func serviceActorToken(t *testing.T) string {
	t.Helper()
	return signAccessToken(t, authnlib.AccessTokenClaims{
		Namespace: "*",
		Actor: &authnlib.ActorClaims{
			Subject:       "access-policy:aggregator",
			IDTokenClaims: authnlib.IDTokenClaims{Type: types.TypeAccessPolicy},
		},
	})
}

func TestOnBehalfOfSubjectToken(t *testing.T) {
	for _, tc := range []struct {
		name  string
		token string
	}{
		{name: "no access token"},
		{name: "not a jwt", token: "not-a-jwt"},
		{name: "token without an actor", token: signAccessToken(t, authnlib.AccessTokenClaims{Namespace: "*"})},
		{name: "actor chain ending in a service", token: serviceActorToken(t)},
	} {
		t.Run(tc.name, func(t *testing.T) {
			info := &identity.StaticRequester{Type: types.TypeUser, AccessToken: tc.token}
			assert.Empty(t, onBehalfOfSubjectToken(info))
		})
	}

	t.Run("actor chain ending in a user", func(t *testing.T) {
		token := userActorToken(t)
		info := &identity.StaticRequester{Type: types.TypeUser, AccessToken: token}
		assert.Equal(t, token, onBehalfOfSubjectToken(info))
	})

	t.Run("nested actor chain ending in a user", func(t *testing.T) {
		token := signAccessToken(t, authnlib.AccessTokenClaims{
			Namespace: "stacks-1",
			Actor: &authnlib.ActorClaims{
				Subject: "access-policy:aggregator",
				Actor: &authnlib.ActorClaims{
					Subject:       "user:1",
					IDTokenClaims: authnlib.IDTokenClaims{Type: types.TypeUser},
				},
			},
		})
		info := &identity.StaticRequester{Type: types.TypeUser, AccessToken: token}
		assert.Equal(t, token, onBehalfOfSubjectToken(info))
	})
}

// recordingExchanger captures the request it delegates for and returns a fixed token.
type recordingExchanger struct {
	calls int
	req   authnlib.TokenExchangeRequest
}

func (e *recordingExchanger) Exchange(_ context.Context, req authnlib.TokenExchangeRequest) (*authnlib.TokenExchangeResponse, error) {
	e.calls++
	e.req = req
	return &authnlib.TokenExchangeResponse{Token: "exchanged"}, nil
}

func TestOnBehalfOfExchanger(t *testing.T) {
	serviceReq := authnlib.TokenExchangeRequest{Namespace: "*", Audiences: []string{"resourceStore"}}
	enabled := func(context.Context) bool { return true }
	withInfo := func(r *identity.StaticRequester) context.Context {
		return types.WithAuthInfo(context.Background(), r)
	}

	t.Run("no auth info passes through untouched", func(t *testing.T) {
		delegate := &recordingExchanger{}
		e := &onBehalfOfExchanger{delegate: delegate, enabled: enabled}

		_, err := e.Exchange(context.Background(), serviceReq)

		require.NoError(t, err)
		assert.Equal(t, serviceReq, delegate.req)
	})

	t.Run("caller not carried in the token passes through untouched", func(t *testing.T) {
		delegate := &recordingExchanger{}
		e := &onBehalfOfExchanger{delegate: delegate, enabled: enabled}
		ctx := withInfo(&identity.StaticRequester{Type: types.TypeUser, Namespace: "stacks-1", AccessToken: serviceActorToken(t)})

		_, err := e.Exchange(ctx, serviceReq)

		require.NoError(t, err)
		assert.Equal(t, serviceReq, delegate.req)
	})

	// Validate this will pass through untouched if we have the exchanger flag off.
	t.Run("policy off passes through untouched", func(t *testing.T) {
		delegate := &recordingExchanger{}
		e := &onBehalfOfExchanger{delegate: delegate, enabled: func(context.Context) bool { return false }}
		ctx := withInfo(&identity.StaticRequester{Type: types.TypeUser, Namespace: "stacks-1", AccessToken: userActorToken(t)})

		_, err := e.Exchange(ctx, serviceReq)

		require.NoError(t, err)
		assert.Equal(t, serviceReq, delegate.req)
	})

	t.Run("carried caller becomes the exchange subject in the caller's namespace", func(t *testing.T) {
		token := userActorToken(t)
		delegate := &recordingExchanger{}
		e := &onBehalfOfExchanger{delegate: delegate, enabled: enabled}
		ctx := withInfo(&identity.StaticRequester{Type: types.TypeUser, Namespace: "stacks-1", AccessToken: token})

		resp, err := e.Exchange(ctx, serviceReq)

		require.NoError(t, err)
		assert.Equal(t, "exchanged", resp.Token)
		assert.Equal(t, token, delegate.req.SubjectToken)
		assert.Equal(t, "stacks-1", delegate.req.Namespace)
		assert.Equal(t, []string{"resourceStore"}, delegate.req.Audiences)
	})

	for _, tc := range []struct{ name, ns string }{
		{name: "empty caller namespace fails before the round trip", ns: ""},
		{name: "wildcard caller namespace fails before the round trip", ns: "*"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			delegate := &recordingExchanger{}
			e := &onBehalfOfExchanger{delegate: delegate, enabled: enabled}
			ctx := withInfo(&identity.StaticRequester{Type: types.TypeUser, Namespace: tc.ns, AccessToken: userActorToken(t)})

			_, err := e.Exchange(ctx, serviceReq)

			assert.Equal(t, codes.PermissionDenied, status.Code(err))
			assert.Zero(t, delegate.calls, "the signer must not be called")
		})
	}
}

// The obo decision must hold across the whole interceptor: the exchange carries the caller
// as subject in the caller's namespace, and no ID token leaves the client alongside it.
func TestRemoteClientExchangesOnBehalfOfCaller(t *testing.T) {
	token := userActorToken(t)
	exchanger := &recordingExchanger{}

	interceptor, err := NewAuthnGrpcClientInterceptor(noop.NewTracerProvider().Tracer(""), RemoteResourceClientConfig{
		Namespace:      "*",
		Audiences:      []string{"resourceStore"},
		TokenExchanger: exchanger,
		OnBehalfOf:     func(context.Context) bool { return true },
	})
	require.NoError(t, err)

	ctx := types.WithAuthInfo(context.Background(), &identity.StaticRequester{
		Type:        types.TypeUser,
		Namespace:   "stacks-1",
		AccessToken: token,
		IDToken:     "id-token",
	})

	var md metadata.MD
	err = interceptor.UnaryClientInterceptor(ctx, "/resource.ResourceStore/List", nil, nil, nil,
		func(ctx context.Context, _ string, _, _ any, _ *grpc.ClientConn, _ ...grpc.CallOption) error {
			md, _ = metadata.FromOutgoingContext(ctx)
			return nil
		})
	require.NoError(t, err)

	assert.Equal(t, token, exchanger.req.SubjectToken)
	assert.Equal(t, "stacks-1", exchanger.req.Namespace)
	assert.Equal(t, []string{"resourceStore"}, exchanger.req.Audiences)
	assert.Equal(t, []string{"exchanged"}, md.Get("X-Access-Token"))
	assert.Empty(t, md.Get("X-Id-Token"), "pure obo must not forward the id token")
}
