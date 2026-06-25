package passkeyimpl

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/remotecache"
	"github.com/grafana/grafana/pkg/services/passkey"
)

func TestEnrollmentStore(t *testing.T) {
	ctx := context.Background()
	sess := enrollmentSession{UserID: 42, Source: passkey.EnrollSourceSignup, WebAuthnSession: []byte("webauthn-session")}

	t.Run("set then take returns the stored session", func(t *testing.T) {
		store := newEnrollmentStore(newFakeCache())
		require.NoError(t, store.set(ctx, "sess-1", sess))

		got, err := store.take(ctx, "sess-1")
		require.NoError(t, err)
		require.Equal(t, sess, got)
	})

	t.Run("take is single-use: a second take reports not found", func(t *testing.T) {
		store := newEnrollmentStore(newFakeCache())
		require.NoError(t, store.set(ctx, "sess-1", sess))

		_, err := store.take(ctx, "sess-1")
		require.NoError(t, err)

		_, err = store.take(ctx, "sess-1")
		require.ErrorIs(t, err, remotecache.ErrCacheItemNotFound)
	})

	t.Run("take on an unknown session id reports not found", func(t *testing.T) {
		store := newEnrollmentStore(newFakeCache())
		_, err := store.take(ctx, "nope")
		require.ErrorIs(t, err, remotecache.ErrCacheItemNotFound)
	})

	t.Run("set uses a non-zero 5 minute TTL", func(t *testing.T) {
		fake := newFakeCache()
		store := newEnrollmentStore(fake)
		require.NoError(t, store.set(ctx, "sess-1", sess))
		require.Equal(t, 5*time.Minute, fake.expires[enrollKeyPrefix+"sess-1"])
	})
}
