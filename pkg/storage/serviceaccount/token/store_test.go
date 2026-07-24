package token_test

import (
	"errors"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/otel/trace/noop"

	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/storage/serviceaccount/token"
	"github.com/grafana/grafana/pkg/storage/serviceaccount/token/database"
	"github.com/grafana/grafana/pkg/storage/serviceaccount/token/migrator"
)

func setupStore(t *testing.T) token.Storage {
	t.Helper()

	testDB := sqlstore.NewTestStore(t, sqlstore.WithMigrator(migrator.New()))
	tracer := noop.NewTracerProvider().Tracer("test")
	store, err := token.ProvideStorage(database.ProvideDatabase(testDB, tracer), tracer)
	require.NoError(t, err)
	return store
}

func TestStoreLifecycle(t *testing.T) {
	store := setupStore(t)
	ctx := t.Context()

	created, err := store.Add(ctx, &token.AddTokenCommand{
		Namespace:          "org-1",
		Name:               "bravo",
		Key:                "hash-bravo",
		ServiceAccountName: "sa-one",
		SecondsToLive:      3600,
	})
	require.NoError(t, err)
	require.NotEmpty(t, created.ID)
	require.Equal(t, "org-1", created.Namespace)
	require.Equal(t, "bravo", created.Name)
	require.Equal(t, "hash-bravo", created.Key)
	require.Equal(t, "sa-one", created.ServiceAccountName)
	require.NotNil(t, created.IsRevoked)
	require.False(t, *created.IsRevoked)
	require.NotNil(t, created.Expires)
	require.InDelta(t, time.Now().Unix()+3600, *created.Expires, 2)

	byName, err := store.GetByName(ctx, &token.GetByNameQuery{
		Namespace:          "org-1",
		ServiceAccountName: "sa-one",
		Name:               "bravo",
	})
	require.NoError(t, err)
	require.Equal(t, created.ID, byName.ID)

	byHash, err := store.GetByHash(ctx, "hash-bravo")
	require.NoError(t, err)
	require.Equal(t, created.ID, byHash.ID)

	require.NoError(t, store.UpdateLastUsedDate(ctx, created.ID))
	updated, err := store.GetByHash(ctx, "hash-bravo")
	require.NoError(t, err)
	require.NotNil(t, updated.LastUsedAt)

	require.NoError(t, store.Delete(ctx, "org-1", "sa-one", "bravo"))
	_, err = store.GetByHash(ctx, "hash-bravo")
	require.ErrorIs(t, err, token.ErrTokenNotFound)
	require.ErrorIs(t, store.Delete(ctx, "org-1", "sa-one", "bravo"), token.ErrTokenNotFound)
	require.ErrorIs(t, store.UpdateLastUsedDate(ctx, created.ID), token.ErrTokenNotFound)
}

func TestStoreDuplicateAndIsolation(t *testing.T) {
	store := setupStore(t)
	ctx := t.Context()

	add := func(namespace, serviceAccount, name, hash string) error {
		_, err := store.Add(ctx, &token.AddTokenCommand{
			Namespace:          namespace,
			Name:               name,
			Key:                hash,
			ServiceAccountName: serviceAccount,
		})
		return err
	}

	require.NoError(t, add("org-1", "sa-one", "deploy", "hash-one"))
	require.ErrorIs(t, add("org-1", "sa-one", "deploy", "hash-two"), token.ErrTokenDuplicate)
	require.ErrorIs(t, add("org-2", "sa-two", "other", "hash-one"), token.ErrTokenDuplicate)
	require.NoError(t, add("org-1", "sa-two", "deploy", "hash-three"))
	require.NoError(t, add("org-2", "sa-one", "deploy", "hash-four"))

	_, err := store.GetByName(ctx, &token.GetByNameQuery{
		Namespace:          "org-1",
		ServiceAccountName: "sa-one",
		Name:               "missing",
	})
	require.True(t, errors.Is(err, token.ErrTokenNotFound))
}

func TestStoreListPagination(t *testing.T) {
	store := setupStore(t)
	ctx := t.Context()

	for _, name := range []string{"charlie", "alpha", "bravo"} {
		_, err := store.Add(ctx, &token.AddTokenCommand{
			Namespace:          "org-1",
			Name:               name,
			Key:                "hash-" + name,
			ServiceAccountName: "sa-one",
		})
		require.NoError(t, err)
	}
	_, err := store.Add(ctx, &token.AddTokenCommand{
		Namespace:          "org-1",
		Name:               "not-included",
		Key:                "hash-other",
		ServiceAccountName: "sa-two",
	})
	require.NoError(t, err)

	first, err := store.ListByServiceAccount(ctx, "org-1", "sa-one", 2, 0)
	require.NoError(t, err)
	require.Equal(t, []string{"alpha", "bravo"}, tokenNames(first.Items))
	require.Equal(t, int64(2), first.Continue)

	second, err := store.ListByServiceAccount(ctx, "org-1", "sa-one", 2, first.Continue)
	require.NoError(t, err)
	require.Equal(t, []string{"charlie"}, tokenNames(second.Items))
	require.Zero(t, second.Continue)
}

func tokenNames(tokens []*token.Token) []string {
	names := make([]string, 0, len(tokens))
	for _, item := range tokens {
		names = append(names, item.Name)
	}
	return names
}
