package resource

import (
	"bytes"
	"context"
	"errors"
	"io"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/storage/unified/resource/kv"
)

// flakyGetKV wraps a KV and injects an error into the first failTimes calls to Get.
type flakyGetKV struct {
	kv.KV
	err       error
	failTimes int
	calls     int
}

func (f *flakyGetKV) Get(ctx context.Context, section, key string) (io.ReadCloser, error) {
	f.calls++
	if f.calls <= f.failTimes {
		return nil, f.err
	}
	return f.KV.Get(ctx, section, key)
}

// setupGetRetryTest seeds a single key into a real Badger store and wraps it
// with a flakyGetKV that fails the first failTimes Get calls with err.
func setupGetRetryTest(t *testing.T, failTimes int, err error) (*dataStore, DataKey) {
	t.Helper()
	realKV := setupBadgerKV(t)
	ds := newDataStore(realKV, nil)
	key := makeTestDataKey("obj-a")
	require.NoError(t, ds.Save(context.Background(), key, bytes.NewReader([]byte("value"))))
	flaky := &flakyGetKV{KV: realKV, failTimes: failTimes, err: err}
	return newDataStore(flaky, nil), key
}

func TestDataStoreGet_Retry(t *testing.T) {
	swapListBackoff(t)

	t.Run("succeeds on first attempt without retrying", func(t *testing.T) {
		ds, key := setupGetRetryTest(t, 0, nil)
		raw, err := ds.Get(context.Background(), key)
		require.NoError(t, err)
		require.NotNil(t, raw)
	})

	t.Run("retries and succeeds after one retryable failure", func(t *testing.T) {
		ds, key := setupGetRetryTest(t, 1, retryableErr(errors.New("transient")))
		raw, err := ds.Get(context.Background(), key)
		require.NoError(t, err)
		require.NotNil(t, raw)
	})

	t.Run("retries and succeeds when last attempt succeeds", func(t *testing.T) {
		// maxKvGetRetryAttempts-1 failures then success on the final allowed attempt.
		ds, key := setupGetRetryTest(t, maxKvGetRetryAttempts-1, retryableErr(errors.New("transient")))
		raw, err := ds.Get(context.Background(), key)
		require.NoError(t, err)
		require.NotNil(t, raw)
	})

	t.Run("exhausts retry budget and returns retryable error", func(t *testing.T) {
		ds, key := setupGetRetryTest(t, maxKvGetRetryAttempts, retryableErr(errors.New("down")))
		raw, err := ds.Get(context.Background(), key)
		require.Error(t, err)
		assert.Nil(t, raw)
		assert.ErrorIs(t, err, kv.ErrRetryable)
	})

	t.Run("non-retryable error propagates immediately without retrying", func(t *testing.T) {
		nonRetryable := errors.New("permanent")
		ds, key := setupGetRetryTest(t, 1, nonRetryable)
		raw, err := ds.Get(context.Background(), key)
		require.Error(t, err)
		assert.Nil(t, raw)
		assert.ErrorIs(t, err, nonRetryable)
		assert.False(t, errors.Is(err, kv.ErrRetryable))
	})

	t.Run("context cancellation during backoff aborts retry", func(t *testing.T) {
		ctx, cancel := context.WithCancel(context.Background())
		cancel()
		ds, key := setupGetRetryTest(t, maxKvGetRetryAttempts, retryableErr(errors.New("transient")))
		_, err := ds.Get(ctx, key)
		require.Error(t, err)
	})
}
