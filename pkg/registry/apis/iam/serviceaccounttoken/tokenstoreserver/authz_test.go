package tokenstoreserver

import (
	"context"
	"testing"

	"github.com/fullstorydev/grpchan"
	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/otel/trace/noop"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	authnlib "github.com/grafana/authlib/authn"
	"github.com/grafana/authlib/types"

	satokenpb "github.com/grafana/grafana/apps/iam/serviceaccounttoken/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	satoken "github.com/grafana/grafana/pkg/storage/serviceaccount/token"
)

// allRPCs drives every RPC on the service so authz coverage cannot drift when a
// method is added.
func allRPCs(ctx context.Context, client satokenpb.ServiceAccountTokenStoreClient) map[string]func() error {
	return map[string]func() error{
		"CreateToken": func() error {
			_, err := client.CreateToken(ctx, &satokenpb.CreateTokenRequest{Namespace: testNamespace, Name: "token-a"})
			return err
		},
		"GetToken": func() error {
			_, err := client.GetToken(ctx, &satokenpb.GetTokenRequest{Namespace: testNamespace, Name: "token-a"})
			return err
		},
		"ListTokens": func() error {
			_, err := client.ListTokens(ctx, &satokenpb.ListTokensRequest{Namespace: testNamespace})
			return err
		},
		"DeleteToken": func() error {
			_, err := client.DeleteToken(ctx, &satokenpb.DeleteTokenRequest{Namespace: testNamespace, Name: "token-a"})
			return err
		},
		"GetTokenByHash": func() error {
			_, err := client.GetTokenByHash(ctx, &satokenpb.GetTokenByHashRequest{Namespace: testNamespace, Hash: "hashed-a"})
			return err
		},
		"UpdateTokenLastUsedDate": func() error {
			_, err := client.UpdateTokenLastUsedDate(ctx, &satokenpb.UpdateTokenLastUsedDateRequest{Namespace: testNamespace, Id: "token-uuid"})
			return err
		},
	}
}

func fullFakeStore() *fakeStore {
	return &fakeStore{
		addToken:       sampleToken(),
		getToken:       sampleToken(),
		listRes:        &satoken.ListResult{},
		getByHashToken: sampleToken(),
	}
}

// newAuthenticatedClient builds a client whose calls carry an access token signed for
// namespace, which is how the identity reaches the server.
func newAuthenticatedClient(t *testing.T, store satoken.Storage, namespace string) satokenpb.ServiceAccountTokenStoreClient {
	t.Helper()

	tracer := noop.NewTracerProvider().Tracer("test")
	exchanger, err := NewInProcTokenExchanger()
	require.NoError(t, err)

	interceptor := authnlib.NewGrpcClientInterceptor(
		exchanger,
		authnlib.WithClientInterceptorNamespace(namespace),
		authnlib.WithClientInterceptorAudience([]string{"iam.grafana.app"}),
	)
	cc := grpchan.InterceptClientConn(
		NewInProcChannel(store, tracer),
		interceptor.UnaryClientInterceptor,
		interceptor.StreamClientInterceptor,
	)

	return satokenpb.NewServiceAccountTokenStoreClient(cc)
}

func TestInProcChannelAllowsAnAccessPolicyToken(t *testing.T) {
	store := fullFakeStore()
	client := newAuthenticatedClient(t, store, testNamespace)

	for name, call := range allRPCs(context.Background(), client) {
		t.Run(name, func(t *testing.T) {
			require.NoError(t, call())
		})
	}
}

func TestInProcChannelRejectsCallersWithoutAnIdentity(t *testing.T) {
	store := fullFakeStore()
	tracer := noop.NewTracerProvider().Tracer("test")
	// No client interceptor, so no access token is attached.
	client := satokenpb.NewServiceAccountTokenStoreClient(NewInProcChannel(store, tracer))

	// The authenticator rejects before the authz interceptor runs, so this is an
	// authentication failure rather than PermissionDenied. What matters is that the
	// call is refused and never reaches the store.
	for name, call := range allRPCs(context.Background(), client) {
		t.Run(name, func(t *testing.T) {
			require.Error(t, call())
		})
	}

	require.Nil(t, store.addCmd, "the store must not be reached by an unauthenticated caller")
	require.Nil(t, store.getQuery)
	require.Nil(t, store.listArgs)
	require.Nil(t, store.deleteArg)
	require.Empty(t, store.getByHashArg)
	require.Empty(t, store.updateLastUsedArg)
}

// callInterceptor runs the authz interceptor over a handler that records whether
// it ran, which is how these tests assert the call never reaches the service.
func callInterceptor(ctx context.Context, t *testing.T) (bool, error) {
	t.Helper()
	return callInterceptorForNamespace(ctx, t, testNamespace)
}

func callInterceptorForNamespace(ctx context.Context, t *testing.T, requestNamespace string) (bool, error) {
	t.Helper()

	handled := false
	handler := func(context.Context, any) (any, error) {
		handled = true
		return &satokenpb.CreateTokenResponse{}, nil
	}
	info := &grpc.UnaryServerInfo{FullMethod: "/iam.serviceaccounttoken.v0alpha1.ServiceAccountTokenStore/CreateToken"}

	_, err := AuthorizeUnaryInterceptor(ctx, &satokenpb.CreateTokenRequest{Namespace: requestNamespace}, info, handler)
	return handled, err
}

func TestAuthorizeAllowsAnAccessPolicyIdentity(t *testing.T) {
	handled, err := callInterceptor(nsCtx(testNamespace), t)

	require.NoError(t, err)
	require.True(t, handled)
}

func TestAuthorizeRejectsIdentityTypesOtherThanAccessPolicy(t *testing.T) {
	for name, identityType := range map[string]types.IdentityType{
		"user":            types.TypeUser,
		"service account": types.TypeServiceAccount,
		"render key":      types.TypeRenderService,
		"anonymous":       types.TypeAnonymous,
		"empty":           types.IdentityType(""),
	} {
		t.Run(name, func(t *testing.T) {
			ctx := identity.WithRequester(context.Background(), &identity.StaticRequester{
				Type:      identityType,
				Namespace: testNamespace,
				UserID:    1,
				UserUID:   "user-uid",
			})

			handled, err := callInterceptor(ctx, t)

			require.Equal(t, codes.PermissionDenied, status.Code(err))
			require.False(t, handled, "the RPC must not run")
		})
	}
}

func TestAuthorizeRejectsAMissingIdentity(t *testing.T) {
	handled, err := callInterceptor(context.Background(), t)

	require.Equal(t, codes.Unauthenticated, status.Code(err))
	require.False(t, handled, "the RPC must not run")
}

func TestAuthorizeRejectsANamespaceTheTokenDoesNotPermit(t *testing.T) {
	handled, err := callInterceptorForNamespace(nsCtx(testNamespace), t, "other")

	require.Equal(t, codes.PermissionDenied, status.Code(err))
	require.False(t, handled, "the RPC must not run")
}

func TestAuthorizeAllowsAClusterScopedTokenIntoAnyNamespace(t *testing.T) {
	// The shared in-process token is signed for "*", which NamespaceMatches accepts.
	ctx := identity.WithRequester(context.Background(), &identity.StaticRequester{
		Type:      types.TypeAccessPolicy,
		Namespace: "*",
	})

	handled, err := callInterceptorForNamespace(ctx, t, testNamespace)

	require.NoError(t, err)
	require.True(t, handled)
}
