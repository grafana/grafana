package externalsessionimpl

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/auth"
	"github.com/grafana/grafana/pkg/services/secrets/fakes"
	"github.com/grafana/grafana/pkg/tests/testsuite"
	"github.com/stretchr/testify/require"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func TestGetExternalSession(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	t.Run("returns existing external session", func(t *testing.T) {
		store := setupTest(t)

		extSession := &auth.ExternalSession{
			AccessToken: "access-token",
		}

		err := store.CreateExternalSession(context.Background(), extSession)
		require.NoError(t, err)

		actual, err := store.GetExternalSession(context.Background(), extSession.ID)
		require.NoError(t, err)
		require.EqualValues(t, extSession.ID, actual.ID)
		require.EqualValues(t, extSession.AccessToken, actual.AccessToken)
	})

	t.Run("returns not found if the external session is missing", func(t *testing.T) {
		store := setupTest(t)

		_, err := store.GetExternalSession(context.Background(), 999)
		require.ErrorIs(t, err, auth.ErrExternalSessionNotFound)
	})
}

func TestFindExternalSessions(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	t.Run("returns external sessions by ID", func(t *testing.T) {
		store := setupTest(t)

		extSession := &auth.ExternalSession{
			AccessToken: "access-token",
		}

		err := store.CreateExternalSession(context.Background(), extSession)
		require.NoError(t, err)

		query := &auth.GetExternalSessionQuery{ID: extSession.ID}
		actual, err := store.FindExternalSessions(context.Background(), query)
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
		err := store.CreateExternalSession(context.Background(), extSession)
		require.NoError(t, err)

		query := &auth.GetExternalSessionQuery{SessionID: extSession.SessionID}
		actual, err := store.FindExternalSessions(context.Background(), query)
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

		err := store.CreateExternalSession(context.Background(), extSession)
		require.NoError(t, err)

		query := &auth.GetExternalSessionQuery{NameID: extSession.NameID}
		actual, err := store.FindExternalSessions(context.Background(), query)
		require.NoError(t, err)
		require.Len(t, actual, 1)
		require.EqualValues(t, extSession.ID, actual[0].ID)
		require.EqualValues(t, extSession.NameID, actual[0].NameID)
	})

	t.Run("returns empty result if no external sessions match the query", func(t *testing.T) {
		store := setupTest(t)

		query := &auth.GetExternalSessionQuery{ID: 999}
		actual, err := store.FindExternalSessions(context.Background(), query)
		require.NoError(t, err)
		require.Len(t, actual, 0)
	})
}

func TestDeleteExternalSessionsByUserID(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

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

		err := store.CreateExternalSession(context.Background(), extSession1)
		require.NoError(t, err)
		err = store.CreateExternalSession(context.Background(), extSession2)
		require.NoError(t, err)

		err = store.DeleteExternalSessionsByUserID(context.Background(), userID)
		require.NoError(t, err)

		query := &auth.GetExternalSessionQuery{}
		actual, err := store.FindExternalSessions(context.Background(), query)
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

func TestDeleteExternalSession(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	t.Run("deletes an existing external session", func(t *testing.T) {
		store := setupTest(t)

		extSession := &auth.ExternalSession{
			AccessToken: "access-token",
		}

		err := store.CreateExternalSession(context.Background(), extSession)
		require.NoError(t, err)

		err = store.DeleteExternalSession(context.Background(), extSession.ID)
		require.NoError(t, err)

		_, err = store.GetExternalSession(context.Background(), extSession.ID)
		require.ErrorIs(t, err, auth.ErrExternalSessionNotFound)
	})

	t.Run("returns no error if the external session does not exist", func(t *testing.T) {
		store := setupTest(t)

		err := store.DeleteExternalSession(context.Background(), 999)
		require.NoError(t, err)
	})
}

func setupTest(t *testing.T) *Store {
	sqlStore := db.InitTestDB(t)
	secretService := fakes.NewFakeSecretsService()
	tracer := tracing.InitializeTracerForTest()
	externalSessionStore := ProvideStore(sqlStore, secretService, tracer).(*Store)
	return externalSessionStore
}
