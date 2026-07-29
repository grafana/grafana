package grpcstore

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/otel/trace/noop"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/registry/apis/iam/serviceaccounttoken/tokenstoreserver"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	satoken "github.com/grafana/grafana/pkg/storage/serviceaccount/token"
	"github.com/grafana/grafana/pkg/storage/serviceaccount/token/database"
	"github.com/grafana/grafana/pkg/storage/serviceaccount/token/migrator"
)

const (
	testNamespace = "default"
	testSAName    = "sa-1"
)

// newTestStore wires the client through a real in-process gRPC hop, including real
// token minting and server-side authentication, onto the real SQL store. embedded is
// returned so tests can assert against the table directly, bypassing gRPC.
func newTestStore(t *testing.T) (satoken.Storage, satoken.EmbeddedStorage) {
	t.Helper()

	testDB := sqlstore.NewTestStore(t, sqlstore.WithMigrator(migrator.New()))
	tracer := noop.NewTracerProvider().Tracer("test")
	embedded, err := satoken.ProvideEmbeddedStorage(database.ProvideDatabase(testDB, tracer), tracer)
	require.NoError(t, err)

	exchanger, err := tokenstoreserver.NewInProcTokenExchanger()
	require.NoError(t, err)

	return New(tokenstoreserver.NewInProcChannel(embedded, tracer), exchanger, tracer), embedded
}

func addToken(t *testing.T, store satoken.Storage, name string, secondsToLive int64) *satoken.Token {
	t.Helper()
	token, err := store.Add(context.Background(), &satoken.AddTokenCommand{
		Namespace:          testNamespace,
		Name:               name,
		Key:                "hashed-" + name,
		ServiceAccountName: testSAName,
		SecondsToLive:      secondsToLive,
	})
	require.NoError(t, err)
	return token
}

func TestAddReturnsToken(t *testing.T) {
	store, _ := newTestStore(t)

	token := addToken(t, store, "token-a", 3600)

	require.NotEmpty(t, token.ID)
	require.Equal(t, testNamespace, token.Namespace)
	require.Equal(t, "token-a", token.Name)
	require.Equal(t, testSAName, token.ServiceAccountName)
	require.False(t, token.Created.IsZero())
	require.NotNil(t, token.IsRevoked)
	require.False(t, *token.IsRevoked)
	require.NotNil(t, token.Expires)
	require.Equal(t, token.Created.Unix()+3600, *token.Expires)
}

func TestAddPersistsToTheServiceAccountTokenTable(t *testing.T) {
	store, embedded := newTestStore(t)

	added := addToken(t, store, "token-a", 0)

	// Read back through the SQL store directly, bypassing gRPC entirely.
	stored, err := embedded.GetByName(context.Background(), &satoken.GetByNameQuery{
		Namespace:          testNamespace,
		ServiceAccountName: testSAName,
		Name:               "token-a",
	})
	require.NoError(t, err)
	require.Equal(t, added.ID, stored.ID)
	require.Equal(t, "hashed-token-a", stored.Key, "the hashed key must reach the table")
}

func TestAddWithoutExpiryLeavesExpiresNil(t *testing.T) {
	store, _ := newTestStore(t)

	token := addToken(t, store, "token-a", 0)

	require.Nil(t, token.Expires, "0 on the wire means never expires")
	require.Nil(t, token.LastUsedAt, "0 on the wire means never used")
}

func TestAddDuplicateReturnsErrTokenDuplicate(t *testing.T) {
	store, _ := newTestStore(t)
	addToken(t, store, "token-a", 0)

	_, err := store.Add(context.Background(), &satoken.AddTokenCommand{
		Namespace:          testNamespace,
		Name:               "token-a",
		Key:                "hashed-other",
		ServiceAccountName: testSAName,
	})

	require.ErrorIs(t, err, satoken.ErrTokenDuplicate)
}

func TestGetByNameReturnsAddedToken(t *testing.T) {
	store, _ := newTestStore(t)
	added := addToken(t, store, "token-a", 0)

	got, err := store.GetByName(context.Background(), &satoken.GetByNameQuery{
		Namespace:          testNamespace,
		ServiceAccountName: testSAName,
		Name:               "token-a",
	})

	require.NoError(t, err)
	require.Equal(t, added.ID, got.ID)
	require.Equal(t, added.Created.Unix(), got.Created.Unix())
}

func TestGetByNameMissingReturnsErrTokenNotFound(t *testing.T) {
	store, _ := newTestStore(t)

	_, err := store.GetByName(context.Background(), &satoken.GetByNameQuery{
		Namespace:          testNamespace,
		ServiceAccountName: testSAName,
		Name:               "nope",
	})

	require.ErrorIs(t, err, satoken.ErrTokenNotFound)
}

func TestListByServiceAccountReturnsTokensSortedByName(t *testing.T) {
	store, _ := newTestStore(t)
	for _, name := range []string{"token-c", "token-a", "token-b"} {
		addToken(t, store, name, 0)
	}

	res, err := store.ListByServiceAccount(context.Background(), testNamespace, testSAName, 0, 0)

	require.NoError(t, err)
	require.Len(t, res.Items, 3)
	require.Equal(t, "token-a", res.Items[0].Name)
	require.Equal(t, "token-b", res.Items[1].Name)
	require.Equal(t, "token-c", res.Items[2].Name)
	require.Zero(t, res.Continue)
}

func TestListByServiceAccountPaginates(t *testing.T) {
	store, _ := newTestStore(t)
	for _, name := range []string{"token-a", "token-b", "token-c"} {
		addToken(t, store, name, 0)
	}

	first, err := store.ListByServiceAccount(context.Background(), testNamespace, testSAName, 2, 0)
	require.NoError(t, err)
	require.Len(t, first.Items, 2)
	require.Equal(t, int64(2), first.Continue)

	second, err := store.ListByServiceAccount(context.Background(), testNamespace, testSAName, 2, first.Continue)
	require.NoError(t, err)
	require.Len(t, second.Items, 1)
	require.Zero(t, second.Continue)
}

func TestListByServiceAccountEmptyIsNotAnError(t *testing.T) {
	store, _ := newTestStore(t)

	res, err := store.ListByServiceAccount(context.Background(), testNamespace, testSAName, 0, 0)

	require.NoError(t, err)
	require.Empty(t, res.Items)
}

func TestDeleteRemovesTheToken(t *testing.T) {
	store, _ := newTestStore(t)
	addToken(t, store, "token-a", 0)

	require.NoError(t, store.Delete(context.Background(), testNamespace, testSAName, "token-a"))

	_, err := store.GetByName(context.Background(), &satoken.GetByNameQuery{
		Namespace:          testNamespace,
		ServiceAccountName: testSAName,
		Name:               "token-a",
	})
	require.ErrorIs(t, err, satoken.ErrTokenNotFound)
}

func TestDeleteRemovesTheRowFromTheTable(t *testing.T) {
	store, embedded := newTestStore(t)
	addToken(t, store, "token-a", 0)

	require.NoError(t, store.Delete(context.Background(), testNamespace, testSAName, "token-a"))

	// Confirm the row is gone from the table, not just from the gRPC read path.
	_, err := embedded.GetByName(context.Background(), &satoken.GetByNameQuery{
		Namespace:          testNamespace,
		ServiceAccountName: testSAName,
		Name:               "token-a",
	})
	require.ErrorIs(t, err, satoken.ErrTokenNotFound)
}

func TestDeleteMissingTokenReturnsErrTokenNotFound(t *testing.T) {
	store, _ := newTestStore(t)

	err := store.Delete(context.Background(), testNamespace, testSAName, "nope")

	require.ErrorIs(t, err, satoken.ErrTokenNotFound)
}

// nsCtx carries the namespaced identity the hash-lookup and last-used RPCs use to
// decide which namespace to mint the access token for.
func nsCtx(namespace string) context.Context {
	return identity.WithServiceIdentityForSingleNamespaceContext(context.Background(), namespace)
}

func TestGetByHashReturnsTheToken(t *testing.T) {
	store, _ := newTestStore(t)
	added := addToken(t, store, "token-a", 0)

	got, err := store.GetByHash(nsCtx(testNamespace), "hashed-token-a")

	require.NoError(t, err)
	require.Equal(t, added.ID, got.ID)
	require.Equal(t, testNamespace, got.Namespace)
	require.Equal(t, "token-a", got.Name)
}

func TestGetByHashUnknownHashReturnsErrTokenNotFound(t *testing.T) {
	store, _ := newTestStore(t)

	_, err := store.GetByHash(nsCtx(testNamespace), "hashed-nope")

	require.ErrorIs(t, err, satoken.ErrTokenNotFound)
}

func TestGetByHashDoesNotCrossNamespaces(t *testing.T) {
	store, _ := newTestStore(t)
	addToken(t, store, "token-a", 0)

	_, err := store.GetByHash(nsCtx("other"), "hashed-token-a")

	require.ErrorIs(t, err, satoken.ErrTokenNotFound)
}

func TestGetByHashRequiresANamespacedIdentity(t *testing.T) {
	store, _ := newTestStore(t)
	addToken(t, store, "token-a", 0)

	_, err := store.GetByHash(context.Background(), "hashed-token-a")

	require.Error(t, err)
	require.NotErrorIs(t, err, satoken.ErrTokenNotFound, "a missing identity is a caller bug, not a missing token")
}

func TestUpdateLastUsedDateStampsTheToken(t *testing.T) {
	store, embedded := newTestStore(t)
	added := addToken(t, store, "token-a", 0)
	require.Nil(t, added.LastUsedAt)

	require.NoError(t, store.UpdateLastUsedDate(nsCtx(testNamespace), added.ID))

	stored, err := embedded.GetByName(context.Background(), &satoken.GetByNameQuery{
		Namespace:          testNamespace,
		ServiceAccountName: testSAName,
		Name:               "token-a",
	})
	require.NoError(t, err)
	require.NotNil(t, stored.LastUsedAt, "last_used_at must be persisted to the table")
}

func TestUpdateLastUsedDateUnknownIDReturnsErrTokenNotFound(t *testing.T) {
	store, _ := newTestStore(t)

	err := store.UpdateLastUsedDate(nsCtx(testNamespace), "no-such-id")

	require.ErrorIs(t, err, satoken.ErrTokenNotFound)
}

func TestUpdateLastUsedDateRequiresANamespacedIdentity(t *testing.T) {
	store, _ := newTestStore(t)
	added := addToken(t, store, "token-a", 0)

	err := store.UpdateLastUsedDate(context.Background(), added.ID)

	require.Error(t, err)
	require.NotErrorIs(t, err, satoken.ErrTokenNotFound)
}
