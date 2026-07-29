package grpcstore

import (
	"context"
	"net"
	"testing"

	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/otel/trace/noop"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"

	satokenpb "github.com/grafana/grafana/apps/iam/serviceaccounttoken/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/iam/serviceaccounttoken/tokenstoreserver"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	satoken "github.com/grafana/grafana/pkg/storage/serviceaccount/token"
	"github.com/grafana/grafana/pkg/storage/serviceaccount/token/database"
	"github.com/grafana/grafana/pkg/storage/serviceaccount/token/migrator"
)

// newRemoteTestStore serves the store from a real gRPC server on a loopback socket
// and dials it, so these tests cover the remote path: real marshalling, a real
// access token in metadata, and server-side authentication.
func newRemoteTestStore(t *testing.T) (satoken.Storage, satoken.EmbeddedStorage) {
	t.Helper()

	testDB := sqlstore.NewTestStore(t, sqlstore.WithMigrator(migrator.New()))
	tracer := noop.NewTracerProvider().Tracer("test")
	embedded, err := satoken.ProvideEmbeddedStorage(database.ProvideDatabase(testDB, tracer), tracer)
	require.NoError(t, err)

	listener, err := net.Listen("tcp", "127.0.0.1:0")
	require.NoError(t, err)

	srv := grpc.NewServer(grpc.ChainUnaryInterceptor(tokenstoreserver.UnaryServerInterceptors(tracer)...))
	satokenpb.RegisterServiceAccountTokenStoreServer(srv, tokenstoreserver.NewServer(embedded))
	go func() { _ = srv.Serve(listener) }()
	t.Cleanup(srv.Stop)

	conn, err := grpc.NewClient(listener.Addr().String(), grpc.WithTransportCredentials(insecure.NewCredentials()))
	require.NoError(t, err)
	t.Cleanup(func() { _ = conn.Close() })

	exchanger, err := tokenstoreserver.NewInProcTokenExchanger()
	require.NoError(t, err)

	return New(conn, exchanger, tracer), embedded
}

func TestRemoteCreateAndReadRoundTrip(t *testing.T) {
	store, embedded := newRemoteTestStore(t)

	added, err := store.Add(context.Background(), &satoken.AddTokenCommand{
		Namespace:          testNamespace,
		Name:               "token-a",
		Key:                "hashed-a",
		ServiceAccountName: testSAName,
		SecondsToLive:      3600,
	})
	require.NoError(t, err)
	require.NotEmpty(t, added.ID)

	got, err := store.GetByName(context.Background(), &satoken.GetByNameQuery{
		Namespace:          testNamespace,
		ServiceAccountName: testSAName,
		Name:               "token-a",
	})
	require.NoError(t, err)
	require.Equal(t, added.ID, got.ID)

	stored, err := embedded.GetByName(context.Background(), &satoken.GetByNameQuery{
		Namespace:          testNamespace,
		ServiceAccountName: testSAName,
		Name:               "token-a",
	})
	require.NoError(t, err)
	require.Equal(t, "hashed-a", stored.Key)
}

func TestRemoteListAndDelete(t *testing.T) {
	store, _ := newRemoteTestStore(t)
	for _, name := range []string{"token-b", "token-a"} {
		_, err := store.Add(context.Background(), &satoken.AddTokenCommand{
			Namespace:          testNamespace,
			Name:               name,
			Key:                "hashed-" + name,
			ServiceAccountName: testSAName,
		})
		require.NoError(t, err)
	}

	res, err := store.ListByServiceAccount(context.Background(), testNamespace, testSAName, 0, 0)
	require.NoError(t, err)
	require.Len(t, res.Items, 2)
	require.Equal(t, "token-a", res.Items[0].Name)

	require.NoError(t, store.Delete(context.Background(), testNamespace, testSAName, "token-a"))

	_, err = store.GetByName(context.Background(), &satoken.GetByNameQuery{
		Namespace:          testNamespace,
		ServiceAccountName: testSAName,
		Name:               "token-a",
	})
	require.ErrorIs(t, err, satoken.ErrTokenNotFound)
}

func TestRemoteGetByHashIsScopedToTheCallerNamespace(t *testing.T) {
	store, _ := newRemoteTestStore(t)
	added, err := store.Add(context.Background(), &satoken.AddTokenCommand{
		Namespace:          testNamespace,
		Name:               "token-a",
		Key:                "hashed-a",
		ServiceAccountName: testSAName,
	})
	require.NoError(t, err)

	got, err := store.GetByHash(nsCtx(testNamespace), "hashed-a")

	require.NoError(t, err)
	require.Equal(t, added.ID, got.ID)
}

func TestRemoteGetByHashDoesNotCrossNamespaces(t *testing.T) {
	store, _ := newRemoteTestStore(t)
	_, err := store.Add(context.Background(), &satoken.AddTokenCommand{
		Namespace:          testNamespace,
		Name:               "token-a",
		Key:                "hashed-a",
		ServiceAccountName: testSAName,
	})
	require.NoError(t, err)

	_, err = store.GetByHash(nsCtx("other"), "hashed-a")

	require.ErrorIs(t, err, satoken.ErrTokenNotFound)
}

func TestRemoteRequiresANamespacedCaller(t *testing.T) {
	// GetByHash and UpdateLastUsedDate carry no namespace argument, so an unscoped
	// caller must be refused rather than defaulted.
	store, _ := newRemoteTestStore(t)

	_, err := store.GetByHash(context.Background(), "hashed-a")
	require.ErrorContains(t, err, "namespaced caller identity is required")

	err = store.UpdateLastUsedDate(context.Background(), "some-id")
	require.ErrorContains(t, err, "namespaced caller identity is required")
}

func TestRemoteUpdateLastUsedDate(t *testing.T) {
	store, embedded := newRemoteTestStore(t)
	added, err := store.Add(context.Background(), &satoken.AddTokenCommand{
		Namespace:          testNamespace,
		Name:               "token-a",
		Key:                "hashed-a",
		ServiceAccountName: testSAName,
	})
	require.NoError(t, err)

	require.NoError(t, store.UpdateLastUsedDate(nsCtx(testNamespace), added.ID))

	stored, err := embedded.GetByName(context.Background(), &satoken.GetByNameQuery{
		Namespace:          testNamespace,
		ServiceAccountName: testSAName,
		Name:               "token-a",
	})
	require.NoError(t, err)
	require.NotNil(t, stored.LastUsedAt)
}
