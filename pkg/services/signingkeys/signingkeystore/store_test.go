package signingkeystore

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/signingkeys"
)

func TestIntegrationSigningKeyStore2(t *testing.T) {
	setup := func() (context.Context, *Store) {
		return context.Background(), NewSigningKeyStore(db.InitTestDB(t))
	}

	t.Run("Should successfully add new singing key", func(_ *testing.T) {
		ctx, store := setup()
		key, err := store.Add(ctx, &signingkeys.SigningKey{KeyID: "1", AddedAt: time.Now().UTC(), PrivateKey: []byte{}}, false)
		require.NoError(t, err)
		assert.Equal(t, "1", key.KeyID)
	})

	t.Run("Should return old key if already exists", func(_ *testing.T) {
		ctx, store := setup()
		key, err := store.Add(ctx, &signingkeys.SigningKey{KeyID: "1", PrivateKey: []byte{}, AddedAt: time.Now().UTC()}, false)
		require.NoError(t, err)
		assert.Equal(t, "1", key.KeyID)

		// try to add the same key again with a different AddedAt
		key2, err := store.Add(ctx, &signingkeys.SigningKey{KeyID: "1", PrivateKey: []byte{}, AddedAt: time.Now().Add(10 * time.Minute).UTC()}, false)
		fmt.Println(err)
		require.ErrorIs(t, err, signingkeys.ErrSigningKeyAlreadyExists)
		assert.Equal(t, "1", key2.KeyID)
		assert.Equal(t, key.AddedAt, key2.AddedAt)
	})

	t.Run("Should update old key when force is true", func(t *testing.T) {
		ctx, store := setup()
		key, err := store.Add(ctx, &signingkeys.SigningKey{KeyID: "1", PrivateKey: []byte{}, AddedAt: time.Now().UTC()}, false)
		require.NoError(t, err)
		assert.Equal(t, "1", key.KeyID)

		// try to add the same key again with a different AddedAt and force is true
		key2, err := store.Add(ctx, &signingkeys.SigningKey{KeyID: "1", PrivateKey: []byte{}, AddedAt: time.Now().Add(10 * time.Minute).UTC()}, true)
		require.NoError(t, err)
		assert.Equal(t, "1", key2.KeyID)
		assert.NotEqual(t, key.AddedAt, key2.AddedAt)
	})

	t.Run("Should update old key when expired", func(t *testing.T) {
		ctx, store := setup()
		key, err := store.Add(ctx, &signingkeys.SigningKey{KeyID: "1", PrivateKey: []byte{}, AddedAt: time.Now().UTC(), ExpiresAt: &time.Time{}}, false)
		require.NoError(t, err)
		assert.Equal(t, "1", key.KeyID)

		// try to add the same key again with a different AddedAt and force is false
		key2, err := store.Add(ctx, &signingkeys.SigningKey{KeyID: "1", PrivateKey: []byte{}, AddedAt: time.Now().Add(10 * time.Minute).UTC()}, false)
		require.NoError(t, err)
		assert.Equal(t, "1", key2.KeyID)
		assert.NotEqual(t, key.AddedAt, key2.AddedAt)
	})

	t.Run("List should return all keys that are not expired", func(t *testing.T) {
		ctx, store := setup()
		_, err := store.Add(ctx, &signingkeys.SigningKey{KeyID: "1", PrivateKey: []byte{}, AddedAt: time.Now().UTC()}, false)
		require.NoError(t, err)
		_, err = store.Add(ctx, &signingkeys.SigningKey{KeyID: "2", PrivateKey: []byte{}, AddedAt: time.Now().UTC(), ExpiresAt: &time.Time{}}, false)
		require.NoError(t, err)
		_, err = store.Add(ctx, &signingkeys.SigningKey{KeyID: "3", PrivateKey: []byte{}, AddedAt: time.Now().UTC()}, false)
		require.NoError(t, err)

		keys, err := store.List(ctx)
		require.NoError(t, err)
		require.Len(t, keys, 2)
	})
}
