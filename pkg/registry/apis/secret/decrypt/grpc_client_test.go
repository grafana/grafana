package decrypt

import (
	"context"
	"net"
	"sync"
	"testing"

	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/otel/trace/noop"
	"google.golang.org/grpc"
	"google.golang.org/grpc/metadata"

	authnlib "github.com/grafana/authlib/authn"
	"github.com/grafana/authlib/types"
	decryptv1beta1 "github.com/grafana/grafana/apps/secret/decrypt/v1beta1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
)

func TestGRPCDecryptClient_Decrypt_ForwardsSubjectToken(t *testing.T) {
	t.Parallel()

	const accessTokenHeader = "X-Access-Token"

	ctxWithAuthInfo := func(t *testing.T, identityType types.IdentityType, accessToken, idToken string) context.Context {
		return types.WithAuthInfo(t.Context(), &identity.StaticRequester{
			Type:        identityType,
			AccessToken: accessToken,
			IDToken:     idToken,
		})
	}

	tests := []struct {
		name            string
		ctx             context.Context
		wantAccessToken string
	}{
		{
			name:            "access-policy with access token and no id token forwards it",
			ctx:             ctxWithAuthInfo(t, types.TypeAccessPolicy, "at-123", ""),
			wantAccessToken: "token-for:at-123",
		},
		{
			name:            "user identity does not forward",
			ctx:             ctxWithAuthInfo(t, types.TypeUser, "at-123", "id-123"),
			wantAccessToken: "token-for:",
		},
		{
			name:            "access-policy with an id token does not forward",
			ctx:             ctxWithAuthInfo(t, types.TypeAccessPolicy, "at-123", "id-123"),
			wantAccessToken: "token-for:",
		},
		{
			name:            "access-policy with empty access token does not forward",
			ctx:             ctxWithAuthInfo(t, types.TypeAccessPolicy, "", ""),
			wantAccessToken: "token-for:",
		},
		{
			name:            "no auth info does not forward",
			ctx:             t.Context(),
			wantAccessToken: "token-for:",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			srv := &fakeDecryptServer{response: &decryptv1beta1.SecureValueDecryptResponseCollection{}}
			client := newTestClient(t, srv)

			_, err := client.Decrypt(tc.ctx, "svc", "default", "n1")
			require.NoError(t, err)

			require.Equal(t, tc.wantAccessToken, srv.header(t, accessTokenHeader))
		})
	}
}

func TestGRPCDecryptClient_Decrypt_ForwardsServiceIdentity(t *testing.T) {
	t.Parallel()

	srv := &fakeDecryptServer{response: &decryptv1beta1.SecureValueDecryptResponseCollection{}}
	client := newTestClient(t, srv)

	_, err := client.Decrypt(t.Context(), "x.grafana.app", "default", "n1")
	require.NoError(t, err)

	require.Equal(t, "x.grafana.app", srv.header(t, contracts.HeaderGrafanaServiceIdentityName))
}

func TestGRPCDecryptClient_Decrypt_FiltersUnrequestedNames(t *testing.T) {
	t.Parallel()

	srv := &fakeDecryptServer{response: &decryptv1beta1.SecureValueDecryptResponseCollection{
		DecryptedValues: map[string]*decryptv1beta1.Result{
			"wanted": {Result: &decryptv1beta1.Result_Value{Value: "v"}},
			"extra":  {Result: &decryptv1beta1.Result_Value{Value: "extra"}},
		},
	}}
	client := newTestClient(t, srv)

	results, err := client.Decrypt(t.Context(), "svc", "default", "wanted")
	require.NoError(t, err)

	require.Len(t, results, 1)
	require.Contains(t, results, "wanted")
	require.NotContains(t, results, "extra")
}

func TestGRPCDecryptClient_Decrypt_DeduplicatesNames(t *testing.T) {
	t.Parallel()

	srv := &fakeDecryptServer{response: &decryptv1beta1.SecureValueDecryptResponseCollection{}}
	client := newTestClient(t, srv)

	_, err := client.Decrypt(t.Context(), "svc", "default", "dup", "dup", "other", "")
	require.NoError(t, err)

	require.Equal(t, 1, srv.timesCalled())
	require.ElementsMatch(t, []string{"dup", "other"}, srv.requestedNames(t))
}

func TestGRPCDecryptClient_Decrypt_NoNamesToDecrypt(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name  string
		names []string
	}{
		{name: "no names", names: nil},
		{name: "only empty names", names: []string{"", ""}},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			srv := &fakeDecryptServer{}
			client := newTestClient(t, srv)

			results, err := client.Decrypt(t.Context(), "svc", "default", tc.names...)
			require.NoError(t, err)
			require.Empty(t, results)
			require.Zero(t, srv.timesCalled())
		})
	}
}

func TestGRPCDecryptClient_Decrypt_InvalidNamespace(t *testing.T) {
	t.Parallel()

	srv := &fakeDecryptServer{}
	client := newTestClient(t, srv)

	_, err := client.Decrypt(t.Context(), "svc", "org-1", "n1")
	require.Error(t, err)
	require.Zero(t, srv.timesCalled())
}

type fakeTokenExchanger struct{}

func (fakeTokenExchanger) Exchange(_ context.Context, r authnlib.TokenExchangeRequest) (*authnlib.TokenExchangeResponse, error) {
	return &authnlib.TokenExchangeResponse{Token: "token-for:" + r.SubjectToken}, nil
}

type fakeDecryptServer struct {
	decryptv1beta1.UnimplementedSecureValueDecrypterServer

	mu      sync.Mutex
	called  int
	lastMD  metadata.MD
	lastReq *decryptv1beta1.SecureValueDecryptRequest

	response *decryptv1beta1.SecureValueDecryptResponseCollection
	err      error
}

func (s *fakeDecryptServer) DecryptSecureValues(
	ctx context.Context,
	req *decryptv1beta1.SecureValueDecryptRequest,
) (*decryptv1beta1.SecureValueDecryptResponseCollection, error) {
	md, _ := metadata.FromIncomingContext(ctx)

	s.mu.Lock()
	s.called++
	s.lastMD = md
	s.lastReq = req
	s.mu.Unlock()

	if s.err != nil {
		return nil, s.err
	}
	return s.response, nil
}

func (s *fakeDecryptServer) timesCalled() int {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.called
}

func (s *fakeDecryptServer) header(t *testing.T, key string) string {
	t.Helper()
	s.mu.Lock()
	defer s.mu.Unlock()
	require.NotNil(t, s.lastMD, "server was never called")
	vals := s.lastMD.Get(key)
	require.Lenf(t, vals, 1, "expected exactly one %q header", key)
	return vals[0]
}

func (s *fakeDecryptServer) requestedNames(t *testing.T) []string {
	t.Helper()
	s.mu.Lock()
	defer s.mu.Unlock()
	require.NotNil(t, s.lastReq, "server was never called")
	return s.lastReq.GetNames()
}

func newTestClient(t *testing.T, srv *fakeDecryptServer) *GRPCDecryptClient {
	t.Helper()

	lis, err := net.Listen("tcp", "127.0.0.1:0")
	require.NoError(t, err)

	grpcServer := grpc.NewServer()
	decryptv1beta1.RegisterSecureValueDecrypterServer(grpcServer, srv)

	go func() { _ = grpcServer.Serve(lis) }()
	t.Cleanup(grpcServer.Stop)

	client, err := NewGRPCDecryptClient(fakeTokenExchanger{}, noop.NewTracerProvider().Tracer("test"), lis.Addr().String(), false)
	require.NoError(t, err)
	t.Cleanup(func() { _ = client.conn.Close() })

	return client
}
