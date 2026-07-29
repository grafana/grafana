package tokenstoreserver

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	satokenpb "github.com/grafana/grafana/apps/iam/serviceaccounttoken/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	satoken "github.com/grafana/grafana/pkg/storage/serviceaccount/token"
)

const (
	testNamespace = "default"
	testSAName    = "sa-1"
)

// fakeStore records calls and returns canned results so the tests can pin the
// server's proto and status-code mapping precisely. Persistence itself is covered
// by the grpcstore tests, which run against a real SQL store.
type fakeStore struct {
	satoken.Storage

	addCmd    *satoken.AddTokenCommand
	addToken  *satoken.Token
	addErr    error
	getQuery  *satoken.GetByNameQuery
	getToken  *satoken.Token
	getErr    error
	listArgs  []any
	listRes   *satoken.ListResult
	listErr   error
	deleteArg []string
	deleteErr error

	getByHashArg      string
	getByHashToken    *satoken.Token
	getByHashErr      error
	updateLastUsedArg string
	updateLastUsedErr error
}

func (f *fakeStore) GetByHash(_ context.Context, hash string) (*satoken.Token, error) {
	f.getByHashArg = hash
	return f.getByHashToken, f.getByHashErr
}

func (f *fakeStore) UpdateLastUsedDate(_ context.Context, id string) error {
	f.updateLastUsedArg = id
	return f.updateLastUsedErr
}

func (f *fakeStore) Add(_ context.Context, cmd *satoken.AddTokenCommand) (*satoken.Token, error) {
	f.addCmd = cmd
	return f.addToken, f.addErr
}

func (f *fakeStore) GetByName(_ context.Context, q *satoken.GetByNameQuery) (*satoken.Token, error) {
	f.getQuery = q
	return f.getToken, f.getErr
}

func (f *fakeStore) ListByServiceAccount(_ context.Context, ns, saName string, limit, continueToken int64) (*satoken.ListResult, error) {
	f.listArgs = []any{ns, saName, limit, continueToken}
	return f.listRes, f.listErr
}

func (f *fakeStore) Delete(_ context.Context, ns, saName, name string) error {
	f.deleteArg = []string{ns, saName, name}
	return f.deleteErr
}

func sampleToken() *satoken.Token {
	revoked := false
	expires := int64(1785174438)
	lastUsed := time.Unix(1785170000, 0).UTC()
	return &satoken.Token{
		ID:                 "token-uuid",
		Namespace:          testNamespace,
		Name:               "token-a",
		Key:                "hashed-a",
		ServiceAccountName: testSAName,
		Created:            time.Unix(1785170838, 0).UTC(),
		Updated:            time.Unix(1785170839, 0).UTC(),
		LastUsedAt:         &lastUsed,
		IsRevoked:          &revoked,
		Expires:            &expires,
	}
}

func TestCreateTokenForwardsTheCommandToTheStore(t *testing.T) {
	store := &fakeStore{addToken: sampleToken()}
	srv := NewServer(store)

	_, err := srv.CreateToken(context.Background(), &satokenpb.CreateTokenRequest{
		Namespace:          testNamespace,
		ServiceAccountName: testSAName,
		Name:               "token-a",
		Key:                "hashed-a",
		SecondsToLive:      3600,
	})

	require.NoError(t, err)
	require.Equal(t, &satoken.AddTokenCommand{
		Namespace:          testNamespace,
		ServiceAccountName: testSAName,
		Name:               "token-a",
		Key:                "hashed-a",
		SecondsToLive:      3600,
	}, store.addCmd)
}

func TestCreateTokenMapsStoredTokenToProto(t *testing.T) {
	store := &fakeStore{addToken: sampleToken()}
	srv := NewServer(store)

	resp, err := srv.CreateToken(context.Background(), &satokenpb.CreateTokenRequest{Name: "token-a"})

	require.NoError(t, err)
	got := resp.GetToken()
	require.Equal(t, "token-uuid", got.GetId())
	require.Equal(t, testNamespace, got.GetNamespace())
	require.Equal(t, "token-a", got.GetName())
	require.Equal(t, testSAName, got.GetServiceAccountName())
	require.Equal(t, int64(1785170838), got.GetCreated())
	require.Equal(t, int64(1785170839), got.GetUpdated())
	require.Equal(t, int64(1785170000), got.GetLastUsedAt())
	require.Equal(t, int64(1785174438), got.GetExpires())
	require.False(t, got.GetIsRevoked())
}

func TestCreateTokenMapsNilOptionalsToZero(t *testing.T) {
	token := sampleToken()
	token.LastUsedAt = nil
	token.Expires = nil
	token.IsRevoked = nil
	srv := NewServer(&fakeStore{addToken: token})

	resp, err := srv.CreateToken(context.Background(), &satokenpb.CreateTokenRequest{Name: "token-a"})

	require.NoError(t, err)
	require.Zero(t, resp.GetToken().GetLastUsedAt())
	require.Zero(t, resp.GetToken().GetExpires())
	require.False(t, resp.GetToken().GetIsRevoked())
}

func TestCreateTokenMapsDuplicateToAlreadyExists(t *testing.T) {
	srv := NewServer(&fakeStore{addErr: satoken.ErrTokenDuplicate})

	_, err := srv.CreateToken(context.Background(), &satokenpb.CreateTokenRequest{Name: "token-a"})

	require.Equal(t, codes.AlreadyExists, status.Code(err))
}

func TestCreateTokenMapsUnknownErrorToInternal(t *testing.T) {
	srv := NewServer(&fakeStore{addErr: errors.New("boom")})

	_, err := srv.CreateToken(context.Background(), &satokenpb.CreateTokenRequest{Name: "token-a"})

	require.Equal(t, codes.Internal, status.Code(err))
}

func TestGetTokenForwardsTheQueryToTheStore(t *testing.T) {
	store := &fakeStore{getToken: sampleToken()}
	srv := NewServer(store)

	resp, err := srv.GetToken(context.Background(), &satokenpb.GetTokenRequest{
		Namespace:          testNamespace,
		ServiceAccountName: testSAName,
		Name:               "token-a",
	})

	require.NoError(t, err)
	require.Equal(t, &satoken.GetByNameQuery{
		Namespace:          testNamespace,
		ServiceAccountName: testSAName,
		Name:               "token-a",
	}, store.getQuery)
	require.Equal(t, "token-uuid", resp.GetToken().GetId())
}

func TestGetTokenMapsNotFoundToNotFound(t *testing.T) {
	srv := NewServer(&fakeStore{getErr: satoken.ErrTokenNotFound})

	_, err := srv.GetToken(context.Background(), &satokenpb.GetTokenRequest{Name: "nope"})

	require.Equal(t, codes.NotFound, status.Code(err))
}

func TestListTokensForwardsPaginationToTheStore(t *testing.T) {
	store := &fakeStore{listRes: &satoken.ListResult{
		Items:    []*satoken.Token{sampleToken()},
		Continue: 7,
	}}
	srv := NewServer(store)

	resp, err := srv.ListTokens(context.Background(), &satokenpb.ListTokensRequest{
		Namespace:          testNamespace,
		ServiceAccountName: testSAName,
		Limit:              2,
		ContinueToken:      4,
	})

	require.NoError(t, err)
	require.Equal(t, []any{testNamespace, testSAName, int64(2), int64(4)}, store.listArgs)
	require.Len(t, resp.GetItems(), 1)
	require.Equal(t, "token-uuid", resp.GetItems()[0].GetId())
	require.Equal(t, int64(7), resp.GetContinueToken())
}

func TestListTokensEmptyResultIsNotAnError(t *testing.T) {
	srv := NewServer(&fakeStore{listRes: &satoken.ListResult{}})

	resp, err := srv.ListTokens(context.Background(), &satokenpb.ListTokensRequest{Namespace: testNamespace})

	require.NoError(t, err)
	require.Empty(t, resp.GetItems())
	require.Zero(t, resp.GetContinueToken())
}

func TestDeleteTokenForwardsToTheStore(t *testing.T) {
	store := &fakeStore{}
	srv := NewServer(store)

	_, err := srv.DeleteToken(context.Background(), &satokenpb.DeleteTokenRequest{
		Namespace:          testNamespace,
		ServiceAccountName: testSAName,
		Name:               "token-a",
	})

	require.NoError(t, err)
	require.Equal(t, []string{testNamespace, testSAName, "token-a"}, store.deleteArg)
}

func TestDeleteTokenMapsNotFoundToNotFound(t *testing.T) {
	srv := NewServer(&fakeStore{deleteErr: satoken.ErrTokenNotFound})

	_, err := srv.DeleteToken(context.Background(), &satokenpb.DeleteTokenRequest{Name: "nope"})

	require.Equal(t, codes.NotFound, status.Code(err))
}

// nsCtx returns a context carrying a service identity scoped to namespace, which
// is how the namespace reaches the hash-lookup and last-used RPCs.
func nsCtx(namespace string) context.Context {
	return identity.WithServiceIdentityForSingleNamespaceContext(context.Background(), namespace)
}

func TestGetTokenByHashReturnsTheTokenWhenNamespaceMatches(t *testing.T) {
	store := &fakeStore{getByHashToken: sampleToken()}
	srv := NewServer(store)

	resp, err := srv.GetTokenByHash(context.Background(), &satokenpb.GetTokenByHashRequest{
		Namespace: testNamespace,
		Hash:      "hashed-a",
	})

	require.NoError(t, err)
	require.Equal(t, "hashed-a", store.getByHashArg)
	require.Equal(t, "token-uuid", resp.GetToken().GetId())
	require.Equal(t, testNamespace, resp.GetToken().GetNamespace())
}

func TestGetTokenByHashHidesTokensFromOtherNamespaces(t *testing.T) {
	// The key column is globally unique, so without this check a request scoped to one
	// namespace could resolve another namespace's token by hash.
	srv := NewServer(&fakeStore{getByHashToken: sampleToken()})

	_, err := srv.GetTokenByHash(context.Background(), &satokenpb.GetTokenByHashRequest{
		Namespace: "other",
		Hash:      "hashed-a",
	})

	require.Equal(t, codes.NotFound, status.Code(err))
}

func TestGetTokenByHashMapsNotFoundToNotFound(t *testing.T) {
	srv := NewServer(&fakeStore{getByHashErr: satoken.ErrTokenNotFound})

	_, err := srv.GetTokenByHash(context.Background(), &satokenpb.GetTokenByHashRequest{
		Namespace: testNamespace,
		Hash:      "nope",
	})

	require.Equal(t, codes.NotFound, status.Code(err))
}

func TestUpdateTokenLastUsedDateForwardsToTheStore(t *testing.T) {
	store := &fakeStore{}
	srv := NewServer(store)

	_, err := srv.UpdateTokenLastUsedDate(context.Background(), &satokenpb.UpdateTokenLastUsedDateRequest{
		Namespace: testNamespace,
		Id:        "token-uuid",
	})

	require.NoError(t, err)
	require.Equal(t, "token-uuid", store.updateLastUsedArg)
}

func TestUpdateTokenLastUsedDateMapsNotFoundToNotFound(t *testing.T) {
	srv := NewServer(&fakeStore{updateLastUsedErr: satoken.ErrTokenNotFound})

	_, err := srv.UpdateTokenLastUsedDate(context.Background(), &satokenpb.UpdateTokenLastUsedDateRequest{
		Namespace: testNamespace,
		Id:        "nope",
	})

	require.Equal(t, codes.NotFound, status.Code(err))
}

func TestImplementsGeneratedServerInterface(t *testing.T) {
	var _ satokenpb.ServiceAccountTokenStoreServer = NewServer(&fakeStore{})
}
