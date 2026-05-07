package authimpl

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/auth"
	"github.com/grafana/grafana/pkg/services/secrets/fakes"
	"github.com/grafana/grafana/pkg/util/testutil"
	"github.com/stretchr/testify/require"
)

func TestIntegrationGetExternalSession(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	t.Run("returns existing external session", func(t *testing.T) {
		store := setupTest(t)

		extSession := &auth.ExternalSession{
			AccessToken: "access-token",
		}

		err := store.Create(context.Background(), extSession)
		require.NoError(t, err)

		actual, err := store.Get(context.Background(), extSession.ID)
		require.NoError(t, err)
		require.EqualValues(t, extSession.ID, actual.ID)
		require.EqualValues(t, extSession.AccessToken, actual.AccessToken)
	})

	t.Run("returns not found if the external session is missing", func(t *testing.T) {
		store := setupTest(t)

		_, err := store.Get(context.Background(), 999)
		require.ErrorIs(t, err, auth.ErrExternalSessionNotFound)
	})
}

func TestIntegrationListExternalSessions(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	t.Run("returns external sessions by ID", func(t *testing.T) {
		store := setupTest(t)

		extSession := &auth.ExternalSession{}

		err := store.Create(context.Background(), extSession)
		require.NoError(t, err)

		query := &auth.ListExternalSessionQuery{ID: extSession.ID}
		actual, err := store.List(context.Background(), query)
		require.NoError(t, err)
		require.Len(t, actual, 1)
		require.EqualValues(t, extSession.ID, actual[0].ID)
		require.EqualValues(t, extSession.AccessToken, actual[0].AccessToken)
	})

	t.Run("returns external sessions by SessionID", func(t *testing.T) {
		store := setupTest(t)

		extSession := &auth.ExternalSession{
			SessionID: "session-index",
		}
		err := store.Create(context.Background(), extSession)
		require.NoError(t, err)

		query := &auth.ListExternalSessionQuery{SessionID: extSession.SessionID}
		actual, err := store.List(context.Background(), query)
		require.NoError(t, err)
		require.Len(t, actual, 1)
		require.EqualValues(t, extSession.ID, actual[0].ID)
		require.EqualValues(t, extSession.SessionID, actual[0].SessionID)
	})

	t.Run("returns external sessions by NameID", func(t *testing.T) {
		store := setupTest(t)

		extSession := &auth.ExternalSession{
			NameID: "name-id",
		}

		err := store.Create(context.Background(), extSession)
		require.NoError(t, err)

		query := &auth.ListExternalSessionQuery{NameID: extSession.NameID}
		actual, err := store.List(context.Background(), query)
		require.NoError(t, err)
		require.Len(t, actual, 1)
		require.EqualValues(t, extSession.ID, actual[0].ID)
		require.EqualValues(t, extSession.NameID, actual[0].NameID)
	})

	t.Run("returns empty result if no external sessions match the query", func(t *testing.T) {
		store := setupTest(t)

		query := &auth.ListExternalSessionQuery{ID: 999}
		actual, err := store.List(context.Background(), query)
		require.NoError(t, err)
		require.Len(t, actual, 0)
	})
}

func TestIntegrationDeleteExternalSessionsByUserID(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	t.Run("deletes all external sessions for a given user ID", func(t *testing.T) {
		store := setupTest(t)

		userID := int64(1)
		extSession1 := &auth.ExternalSession{
			UserID:      userID,
			AccessToken: "access-token-1",
		}
		extSession2 := &auth.ExternalSession{
			UserID:      userID,
			AccessToken: "access-token-2",
		}

		err := store.Create(context.Background(), extSession1)
		require.NoError(t, err)
		err = store.Create(context.Background(), extSession2)
		require.NoError(t, err)

		err = store.DeleteExternalSessionsByUserID(context.Background(), userID)
		require.NoError(t, err)

		query := &auth.ListExternalSessionQuery{}
		actual, err := store.List(context.Background(), query)
		require.NoError(t, err)
		require.Len(t, actual, 0)
	})

	t.Run("returns no error if no external sessions exist for the given user ID", func(t *testing.T) {
		store := setupTest(t)

		userID := int64(999)
		err := store.DeleteExternalSessionsByUserID(context.Background(), userID)
		require.NoError(t, err)
	})
}

func TestIntegrationDeleteExternalSession(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	t.Run("deletes an existing external session", func(t *testing.T) {
		store := setupTest(t)

		extSession := &auth.ExternalSession{
			AccessToken: "access-token",
		}

		err := store.Create(context.Background(), extSession)
		require.NoError(t, err)

		err = store.Delete(context.Background(), extSession.ID)
		require.NoError(t, err)

		_, err = store.Get(context.Background(), extSession.ID)
		require.ErrorIs(t, err, auth.ErrExternalSessionNotFound)
	})

	t.Run("returns no error if the external session does not exist", func(t *testing.T) {
		store := setupTest(t)

		err := store.Delete(context.Background(), 999)
		require.NoError(t, err)
	})
}

func TestIntegrationBatchDeleteExternalSessionsByUserIDs(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	t.Run("deletes all external sessions for given user IDs", func(t *testing.T) {
		store := setupTest(t)

		userID1 := int64(1)
		userID2 := int64(2)
		extSession1 := &auth.ExternalSession{
			UserID:      userID1,
			AccessToken: "access-token-1",
		}
		extSession2 := &auth.ExternalSession{
			UserID:      userID2,
			AccessToken: "access-token-2",
		}

		err := store.Create(context.Background(), extSession1)
		require.NoError(t, err)
		err = store.Create(context.Background(), extSession2)
		require.NoError(t, err)

		err = store.BatchDeleteExternalSessionsByUserIDs(context.Background(), []int64{userID1, userID2})
		require.NoError(t, err)

		query := &auth.ListExternalSessionQuery{}
		actual, err := store.List(context.Background(), query)
		require.NoError(t, err)
		require.Len(t, actual, 0)
	})

	t.Run("returns no error if no external sessions exist for the given user IDs", func(t *testing.T) {
		store := setupTest(t)

		err := store.BatchDeleteExternalSessionsByUserIDs(context.Background(), []int64{999, 1000})
		require.NoError(t, err)
	})
}

func setupTest(t *testing.T) *store {
	sqlStore := db.InitTestDB(t)
	secretService := fakes.NewFakeSecretsService()
	tracer := tracing.InitializeTracerForTest()
	externalSessionStore := provideExternalSessionStore(sqlStore, secretService, tracer).(*store)
	return externalSessionStore
}
