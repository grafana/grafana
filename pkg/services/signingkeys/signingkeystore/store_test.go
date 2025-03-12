package signingkeystore

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/signingkeys"
	"github.com/grafana/grafana/pkg/tests/testsuite"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func TestIntegrationSigningKeyStore(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	ctx, store := context.Background(), NewSigningKeyStore(db.InitTestDB(t))

	t.Run("Should successfully add new singing key", func(_ *testing.T) {
		key, err := store.Add(ctx, &signingkeys.SigningKey{KeyID: "1", AddedAt: time.Now().UTC(), PrivateKey: ""}, false)
		require.NoError(t, err)
		assert.Equal(t, "1", key.KeyID)
	})

	t.Run("Should return old key if already exists", func(_ *testing.T) {
		// try to add the same key again with a different AddedAt
		key2, err := store.Add(ctx, &signingkeys.SigningKey{KeyID: "1", PrivateKey: "", AddedAt: time.Now().Add(10 * time.Minute).UTC()}, false)
		require.ErrorIs(t, err, signingkeys.ErrSigningKeyAlreadyExists)
		assert.Equal(t, "1", key2.KeyID)
	})

	t.Run("Should update old key when force is true", func(t *testing.T) {
		key, err := store.Add(ctx, &signingkeys.SigningKey{KeyID: "2", PrivateKey: "", AddedAt: time.Now().UTC()}, false)
		require.NoError(t, err)
		assert.Equal(t, "2", key.KeyID)

		// try to add the same key again with a different AddedAt and force is true
		key2, err := store.Add(ctx, &signingkeys.SigningKey{KeyID: "2", PrivateKey: "", AddedAt: time.Now().Add(10 * time.Minute).UTC()}, true)
		require.NoError(t, err)
		assert.Equal(t, "2", key2.KeyID)
		assert.NotEqual(t, key.AddedAt, key2.AddedAt)
	})

	t.Run("Should update old key when expired", func(t *testing.T) {
		key, err := store.Add(ctx, &signingkeys.SigningKey{KeyID: "3", PrivateKey: "", AddedAt: time.Now().UTC(), ExpiresAt: &time.Time{}}, false)
		require.NoError(t, err)
		assert.Equal(t, "3", key.KeyID)

		// try to add the same key again with a different AddedAt and force is false
		key2, err := store.Add(ctx, &signingkeys.SigningKey{KeyID: "3", PrivateKey: "", AddedAt: time.Now().Add(10 * time.Minute).UTC()}, false)
		require.NoError(t, err)
		assert.Equal(t, "3", key2.KeyID)
		assert.NotEqual(t, key.AddedAt, key2.AddedAt)
	})

	t.Run("List should return all keys that are not expired", func(t *testing.T) {
		// expire key 3
		_, err := store.Add(ctx, &signingkeys.SigningKey{KeyID: "3", PrivateKey: "", AddedAt: time.Now().UTC(), ExpiresAt: &time.Time{}}, true)
		require.NoError(t, err)

		keys, err := store.List(ctx)
		require.NoError(t, err)
		require.Len(t, keys, 2)
	})
}
