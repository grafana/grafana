package provider

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/otel/trace"
	"go.opentelemetry.io/otel/trace/noop"

	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
	satoken "github.com/grafana/grafana/pkg/storage/serviceaccount/token"
	"github.com/grafana/grafana/pkg/storage/serviceaccount/token/database"
	"github.com/grafana/grafana/pkg/storage/serviceaccount/token/migrator"
)

// stubEmbeddedStorage is a sentinel for the identity assertions, where the store
// is never called.
type stubEmbeddedStorage struct {
	satoken.Storage
}

func newTestTracer() trace.Tracer {
	return noop.NewTracerProvider().Tracer("test")
}

// newEmbeddedStorage builds the real SQL-backed store against a sqlite test DB.
func newEmbeddedStorage(t *testing.T) satoken.EmbeddedStorage {
	t.Helper()
	testDB := sqlstore.NewTestStore(t, sqlstore.WithMigrator(migrator.New()))
	tracer := newTestTracer()
	embedded, err := satoken.ProvideEmbeddedStorage(database.ProvideDatabase(testDB, tracer), tracer)
	require.NoError(t, err)
	return embedded
}

func TestEmbeddedStoreTypeReturnsTheEmbeddedStorage(t *testing.T) {
	embedded := &stubEmbeddedStorage{}
	cfg := &setting.Cfg{SATokenStoreType: string(satoken.StoreTypeEmbedded)}

	got, err := ProvideStorage(cfg, embedded, newTestTracer())

	require.NoError(t, err)
	require.Same(t, embedded, got)
}

func TestEmptyStoreTypeDefaultsToEmbedded(t *testing.T) {
	embedded := &stubEmbeddedStorage{}
	cfg := &setting.Cfg{SATokenStoreType: ""}

	got, err := ProvideStorage(cfg, embedded, newTestTracer())

	require.NoError(t, err)
	require.Same(t, embedded, got)
}

func TestUnknownStoreTypeIsAnError(t *testing.T) {
	cfg := &setting.Cfg{SATokenStoreType: "nonsense"}

	_, err := ProvideStorage(cfg, &stubEmbeddedStorage{}, newTestTracer())

	require.ErrorContains(t, err, "nonsense")
}

func TestMTStoreTypeIsNotTheEmbeddedStorage(t *testing.T) {
	embedded := &stubEmbeddedStorage{}
	cfg := &setting.Cfg{SATokenStoreType: string(satoken.StoreTypeMT)}

	got, err := ProvideStorage(cfg, embedded, newTestTracer())

	require.NoError(t, err)
	require.NotSame(t, embedded, got)
}

func TestMTStoreTypeWithoutAddressWritesThroughToTheEmbeddedStore(t *testing.T) {
	embedded := newEmbeddedStorage(t)
	cfg := &setting.Cfg{SATokenStoreType: string(satoken.StoreTypeMT)}

	store, err := ProvideStorage(cfg, embedded, newTestTracer())
	require.NoError(t, err)
	require.NotNil(t, store)

	added, err := store.Add(context.Background(), &satoken.AddTokenCommand{
		Namespace:          "default",
		Name:               "token-a",
		Key:                "hashed-a",
		ServiceAccountName: "sa-1",
	})
	require.NoError(t, err)
	require.NotEmpty(t, added.ID)

	// The in-process server must persist to the same serviceaccount_token table
	// the embedded store reads.
	stored, err := embedded.GetByHash(context.Background(), "default", "hashed-a")
	require.NoError(t, err)
	require.Equal(t, added.ID, stored.ID)
}

func TestMTStoreTypeWithoutAddressDeletesThroughToTheEmbeddedStore(t *testing.T) {
	embedded := newEmbeddedStorage(t)
	cfg := &setting.Cfg{SATokenStoreType: string(satoken.StoreTypeMT)}

	store, err := ProvideStorage(cfg, embedded, newTestTracer())
	require.NoError(t, err)

	_, err = store.Add(context.Background(), &satoken.AddTokenCommand{
		Namespace:          "default",
		Name:               "token-a",
		Key:                "hashed-a",
		ServiceAccountName: "sa-1",
	})
	require.NoError(t, err)

	require.NoError(t, store.Delete(context.Background(), "default", "sa-1", "token-a"))

	_, err = embedded.GetByHash(context.Background(), "default", "hashed-a")
	require.ErrorIs(t, err, satoken.ErrTokenNotFound)
}

func TestMTStoreTypeWithAddressRequiresTokenExchangeConfig(t *testing.T) {
	cfg := setting.NewCfg()
	cfg.SATokenStoreType = string(satoken.StoreTypeMT)
	cfg.SATokenStoreGrpcAddress = "127.0.0.1:10000"

	_, err := ProvideStorage(cfg, &stubEmbeddedStorage{}, newTestTracer())

	require.ErrorContains(t, err, "token_exchange_url")
}
