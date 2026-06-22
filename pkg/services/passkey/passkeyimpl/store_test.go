package passkeyimpl

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/passkey"
	"github.com/grafana/grafana/pkg/tests/testsuite"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func TestIntegrationPasskeyStore(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	ctx := context.Background()
	store := ProvideStore(db.InitTestDB(t))

	const userID int64 = 1
	cred1 := &passkey.Credential{UserID: userID, CredentialID: []byte("cred-1"), PublicKey: []byte("pk-1"), Name: "Laptop"}
	cred2 := &passkey.Credential{UserID: userID, CredentialID: []byte("cred-2"), PublicKey: []byte("pk-2"), Name: "Phone"}

	require.NoError(t, store.Create(ctx, cred1))
	require.NoError(t, store.Create(ctx, cred2))
	require.NotZero(t, cred1.ID, "Create should populate the credential id")
	require.NotEqual(t, cred1.ID, cred2.ID)

	t.Run("GetByCredentialID returns the matching credential via its hash", func(t *testing.T) {
		got, err := store.GetByCredentialID(ctx, []byte("cred-1"))
		require.NoError(t, err)
		require.Equal(t, cred1.ID, got.ID)
		require.Equal(t, []byte("pk-1"), got.PublicKey)
		require.NotEmpty(t, got.CredentialIDHash, "Create should have derived the hash")
		require.False(t, got.Created.IsZero(), "Create should have stamped created")
	})

	t.Run("GetByCredentialID returns ErrCredentialNotFound for an unknown id", func(t *testing.T) {
		_, err := store.GetByCredentialID(ctx, []byte("nope"))
		require.ErrorIs(t, err, passkey.ErrCredentialNotFound)
	})

	t.Run("ListByUser returns all of the user's credentials", func(t *testing.T) {
		creds, err := store.ListByUser(ctx, userID)
		require.NoError(t, err)
		require.Len(t, creds, 2)
	})

	t.Run("RecordUse persists sign count and last_used", func(t *testing.T) {
		require.NoError(t, store.RecordUse(ctx, cred1.ID, 7))
		got, err := store.GetByCredentialID(ctx, []byte("cred-1"))
		require.NoError(t, err)
		require.EqualValues(t, 7, got.SignCount)
		require.NotNil(t, got.LastUsed)
	})

	t.Run("Rename only affects the owner's credential", func(t *testing.T) {
		// Wrong user: no-op.
		require.NoError(t, store.Rename(ctx, cred1.ID, userID+999, "Hacked"))
		got, err := store.GetByCredentialID(ctx, []byte("cred-1"))
		require.NoError(t, err)
		require.Equal(t, "Laptop", got.Name)

		// Correct user: renamed.
		require.NoError(t, store.Rename(ctx, cred1.ID, userID, "Work Laptop"))
		got, err = store.GetByCredentialID(ctx, []byte("cred-1"))
		require.NoError(t, err)
		require.Equal(t, "Work Laptop", got.Name)
	})

	t.Run("Delete removes the credential", func(t *testing.T) {
		require.NoError(t, store.Delete(ctx, cred1.ID, userID))
		_, err := store.GetByCredentialID(ctx, []byte("cred-1"))
		require.ErrorIs(t, err, passkey.ErrCredentialNotFound)

		creds, err := store.ListByUser(ctx, userID)
		require.NoError(t, err)
		require.Len(t, creds, 1)
	})
}
