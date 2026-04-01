package lock

import (
	"context"
	"encoding/json"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gocloud.dev/blob"
	"gocloud.dev/blob/memblob"
	"gocloud.dev/gcerrors"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

// --- conditionalBucket wraps a real memblob bucket with ETag-based conditional writes ---

// conditionalBucket wraps a CDKBucket (backed by memblob) and adds ETag tracking
// to simulate conditional write semantics for testing CDKLockBackend.
type conditionalBucket struct {
	resource.CDKBucket
	mu    sync.Mutex
	etags map[string]string // key -> current etag
	seq   int
}

func newConditionalBucket() *conditionalBucket {
	return &conditionalBucket{
		CDKBucket: memblob.OpenBucket(nil),
		etags:     make(map[string]string),
	}
}

func (c *conditionalBucket) nextETag() string {
	c.seq++
	return "etag-" + string(rune('0'+c.seq%10)) + string(rune('0'+c.seq/10))
}

func (c *conditionalBucket) WriteAll(ctx context.Context, key string, data []byte, opts *blob.WriterOptions) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	_, exists := c.etags[key]

	// Enforce IfNotExist: if the object exists, return the same error that
	// gocloud providers return (FailedPrecondition).
	if opts != nil && opts.IfNotExist && exists {
		// Use the real bucket to attempt a write with IfNotExist so we get a
		// proper gcerr.Error. Write a dummy value first, then try IfNotExist.
		return c.CDKBucket.WriteAll(ctx, key, data, opts)
	}

	// Invoke BeforeWrite to capture conditional match request.
	if opts != nil && opts.BeforeWrite != nil {
		var req *fakeIfMatchRequest
		asFunc := func(target any) bool {
			if p, ok := target.(**fakeIfMatchRequest); ok {
				*p = &fakeIfMatchRequest{}
				req = *p
				return true
			}
			return false
		}
		if err := opts.BeforeWrite(asFunc); err != nil {
			return err
		}
		// Check ETag match.
		if req != nil && exists && req.ETag != c.etags[key] {
			// Need a real gcerrors.FailedPrecondition error. We'll try IfNotExist
			// on an existing key to get one.
			_ = c.CDKBucket.WriteAll(ctx, key+"__etag_check", []byte("x"), nil) // ensure dummy exists
			err := c.CDKBucket.WriteAll(ctx, key+"__etag_check", []byte("x"), &blob.WriterOptions{IfNotExist: true})
			_ = c.CDKBucket.Delete(ctx, key+"__etag_check") // cleanup
			if err != nil {
				return err // This is a proper gcerr.Error with FailedPrecondition
			}
			// Fallback: shouldn't happen, but just in case memblob doesn't error
			return nil
		}
	}

	// Strip BeforeWrite before passing to the real bucket (memblob doesn't support AsFunc).
	cleanOpts := &blob.WriterOptions{}
	if opts != nil {
		cleanOpts.ContentType = opts.ContentType
	}
	if err := c.CDKBucket.WriteAll(ctx, key, data, cleanOpts); err != nil {
		return err
	}
	c.etags[key] = c.nextETag()
	return nil
}

func (c *conditionalBucket) Attributes(ctx context.Context, key string) (*blob.Attributes, error) {
	attrs, err := c.CDKBucket.Attributes(ctx, key)
	if err != nil {
		return nil, err
	}
	c.mu.Lock()
	etag := c.etags[key]
	c.mu.Unlock()
	attrs.ETag = etag
	return attrs, nil
}

func (c *conditionalBucket) Delete(ctx context.Context, key string) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	delete(c.etags, key)
	return c.CDKBucket.Delete(ctx, key)
}

// --- fakeIfMatchRequest for conditional write/delete callbacks ---

type fakeIfMatchRequest struct {
	ETag string
}

func fakeConditionalWrite(attrs *blob.Attributes) func(asFunc func(any) bool) error {
	return func(asFunc func(any) bool) error {
		var req *fakeIfMatchRequest
		if asFunc(&req) {
			req.ETag = attrs.ETag
		}
		return nil
	}
}

func fakeConditionalDeleteFor(bucket *conditionalBucket) ConditionalDeleteFunc {
	return func(ctx context.Context, key string, attrs *blob.Attributes) error {
		bucket.mu.Lock()
		currentETag, exists := bucket.etags[key]
		bucket.mu.Unlock()

		if !exists {
			return bucket.CDKBucket.Delete(ctx, key) // will return NotFound
		}
		if currentETag != attrs.ETag {
			// Need a proper gcerr.Error with FailedPrecondition.
			// Use the IfNotExist trick.
			_ = bucket.CDKBucket.WriteAll(ctx, key+"__del_check", []byte("x"), nil)
			err := bucket.CDKBucket.WriteAll(ctx, key+"__del_check", []byte("x"), &blob.WriterOptions{IfNotExist: true})
			_ = bucket.CDKBucket.Delete(ctx, key+"__del_check")
			return err
		}
		return bucket.Delete(ctx, key)
	}
}

// --- helpers ---

func newTestBackend(bucket *conditionalBucket) *CDKLockBackend {
	return NewCDKLockBackend(bucket, CDKLockBackendOptions{
		ConditionalWrite:  fakeConditionalWrite,
		ConditionalDelete: fakeConditionalDeleteFor(bucket),
	})
}

func lockInfo(owner string, ttl time.Duration) LockInfo {
	return LockInfo{Owner: owner, TTL: ttl, Heartbeat: time.Now()}
}

// --- CDKLockBackend tests ---

func TestCDKLockBackend_Create(t *testing.T) {
	t.Run("succeeds on empty bucket", func(t *testing.T) {
		bucket := newConditionalBucket()
		backend := newTestBackend(bucket)
		ctx := context.Background()

		err := backend.Create(ctx, "lock-1", lockInfo("owner-1", time.Minute))
		require.NoError(t, err)

		info, err := backend.Read(ctx, "lock-1")
		require.NoError(t, err)
		assert.Equal(t, "owner-1", info.Owner)
	})

	t.Run("returns ErrLockHeld for live lock", func(t *testing.T) {
		bucket := newConditionalBucket()
		backend := newTestBackend(bucket)
		ctx := context.Background()

		require.NoError(t, backend.Create(ctx, "lock-1", lockInfo("owner-1", time.Minute)))

		err := backend.Create(ctx, "lock-1", lockInfo("owner-2", time.Minute))
		require.ErrorIs(t, err, ErrLockHeld)
	})

	t.Run("takes over expired lock", func(t *testing.T) {
		bucket := newConditionalBucket()
		backend := newTestBackend(bucket)
		ctx := context.Background()

		// Create a lock, then advance the clock past its TTL.
		require.NoError(t, backend.Create(ctx, "lock-1", lockInfo("owner-1", 100*time.Millisecond)))
		backend.now = func() time.Time { return time.Now().Add(200 * time.Millisecond) }

		err := backend.Create(ctx, "lock-1", lockInfo("owner-2", time.Minute))
		require.NoError(t, err)

		info, err := backend.Read(ctx, "lock-1")
		require.NoError(t, err)
		assert.Equal(t, "owner-2", info.Owner)
	})

	t.Run("takeover race: conditional write fails", func(t *testing.T) {
		bucket := newConditionalBucket()
		backend := newTestBackend(bucket)
		ctx := context.Background()

		require.NoError(t, backend.Create(ctx, "lock-1", lockInfo("owner-1", 100*time.Millisecond)))
		backend.now = func() time.Time { return time.Now().Add(200 * time.Millisecond) }

		// Simulate a race: after the backend reads attrs but before the conditional
		// write, another instance modifies the lock (changing the etag).
		origWrite := backend.conditionalWriteFn
		backend.conditionalWriteFn = func(attrs *blob.Attributes) func(asFunc func(any) bool) error {
			// Mutate the etag underneath to simulate a concurrent write.
			bucket.mu.Lock()
			bucket.etags["lock-1"] = "raced-etag"
			bucket.mu.Unlock()
			return origWrite(attrs)
		}

		err := backend.Create(ctx, "lock-1", lockInfo("owner-2", time.Minute))
		require.ErrorIs(t, err, ErrLockHeld)
	})
}

func TestCDKLockBackend_Update(t *testing.T) {
	t.Run("succeeds for same owner", func(t *testing.T) {
		bucket := newConditionalBucket()
		backend := newTestBackend(bucket)
		ctx := context.Background()

		require.NoError(t, backend.Create(ctx, "lock-1", lockInfo("owner-1", time.Minute)))

		err := backend.Update(ctx, "lock-1", lockInfo("owner-1", 2*time.Minute))
		require.NoError(t, err)

		info, err := backend.Read(ctx, "lock-1")
		require.NoError(t, err)
		assert.Equal(t, 2*time.Minute, info.TTL)
	})

	t.Run("fails for different owner", func(t *testing.T) {
		bucket := newConditionalBucket()
		backend := newTestBackend(bucket)
		ctx := context.Background()

		require.NoError(t, backend.Create(ctx, "lock-1", lockInfo("owner-1", time.Minute)))

		err := backend.Update(ctx, "lock-1", lockInfo("owner-2", time.Minute))
		require.ErrorIs(t, err, ErrLockHeld)
	})

	t.Run("fails on etag mismatch", func(t *testing.T) {
		bucket := newConditionalBucket()
		backend := newTestBackend(bucket)
		ctx := context.Background()

		require.NoError(t, backend.Create(ctx, "lock-1", lockInfo("owner-1", time.Minute)))

		// Simulate concurrent modification.
		origWrite := backend.conditionalWriteFn
		backend.conditionalWriteFn = func(attrs *blob.Attributes) func(asFunc func(any) bool) error {
			bucket.mu.Lock()
			bucket.etags["lock-1"] = "concurrent-etag"
			bucket.mu.Unlock()
			return origWrite(attrs)
		}

		err := backend.Update(ctx, "lock-1", lockInfo("owner-1", 2*time.Minute))
		require.ErrorIs(t, err, ErrLockHeld)
	})

	t.Run("returns ErrLockNotFound for missing key", func(t *testing.T) {
		bucket := newConditionalBucket()
		backend := newTestBackend(bucket)
		ctx := context.Background()

		err := backend.Update(ctx, "no-such-lock", lockInfo("owner-1", time.Minute))
		require.ErrorIs(t, err, ErrLockNotFound)
	})
}

func TestCDKLockBackend_Delete(t *testing.T) {
	t.Run("succeeds for correct owner", func(t *testing.T) {
		bucket := newConditionalBucket()
		backend := newTestBackend(bucket)
		ctx := context.Background()

		require.NoError(t, backend.Create(ctx, "lock-1", lockInfo("owner-1", time.Minute)))
		require.NoError(t, backend.Delete(ctx, "lock-1", "owner-1"))

		_, err := backend.Read(ctx, "lock-1")
		require.ErrorIs(t, err, ErrLockNotFound)
	})

	t.Run("fails for wrong owner", func(t *testing.T) {
		bucket := newConditionalBucket()
		backend := newTestBackend(bucket)
		ctx := context.Background()

		require.NoError(t, backend.Create(ctx, "lock-1", lockInfo("owner-1", time.Minute)))

		err := backend.Delete(ctx, "lock-1", "owner-2")
		require.ErrorIs(t, err, ErrLockHeld)
	})

	t.Run("returns ErrLockNotFound for missing key", func(t *testing.T) {
		bucket := newConditionalBucket()
		backend := newTestBackend(bucket)
		ctx := context.Background()

		err := backend.Delete(ctx, "no-such-lock", "owner-1")
		require.ErrorIs(t, err, ErrLockNotFound)
	})

	t.Run("conditional delete fails on etag mismatch", func(t *testing.T) {
		bucket := newConditionalBucket()
		backend := newTestBackend(bucket)
		ctx := context.Background()

		require.NoError(t, backend.Create(ctx, "lock-1", lockInfo("owner-1", time.Minute)))

		// Modify etag between Attributes() read and conditional delete.
		origDelete := backend.conditionalDeleteFn
		backend.conditionalDeleteFn = func(ctx context.Context, key string, attrs *blob.Attributes) error {
			bucket.mu.Lock()
			bucket.etags[key] = "concurrent-etag"
			bucket.mu.Unlock()
			return origDelete(ctx, key, attrs)
		}

		err := backend.Delete(ctx, "lock-1", "owner-1")
		require.Error(t, err)
		assert.Contains(t, err.Error(), "lock was modified during delete")
	})
}

func TestCDKLockBackend_Read(t *testing.T) {
	t.Run("returns ErrLockNotFound for missing key", func(t *testing.T) {
		bucket := newConditionalBucket()
		backend := newTestBackend(bucket)
		ctx := context.Background()

		_, err := backend.Read(ctx, "no-such-lock")
		require.ErrorIs(t, err, ErrLockNotFound)
	})

	t.Run("returns correct LockInfo", func(t *testing.T) {
		bucket := newConditionalBucket()
		backend := newTestBackend(bucket)
		ctx := context.Background()

		require.NoError(t, backend.Create(ctx, "lock-1", lockInfo("owner-1", 5*time.Minute)))

		info, err := backend.Read(ctx, "lock-1")
		require.NoError(t, err)
		assert.Equal(t, "owner-1", info.Owner)
		assert.Equal(t, 5*time.Minute, info.TTL)
	})
}

func TestCDKLockBackend_Integration(t *testing.T) {
	t.Run("ObjectStorageLock acquire/heartbeat/release cycle", func(t *testing.T) {
		bucket := newConditionalBucket()
		backend := newTestBackend(bucket)

		lock := NewObjectStorageLock(ObjectStorageLockConfig{
			Backend:           backend,
			Key:               "integration-lock",
			Owner:             "instance-1",
			TTL:               5 * time.Second,
			HeartbeatInterval: 50 * time.Millisecond,
		})

		ctx := context.Background()
		require.NoError(t, lock.Acquire(ctx))

		info, err := backend.Read(ctx, "integration-lock")
		require.NoError(t, err)
		assert.Equal(t, "instance-1", info.Owner)

		// Wait for a heartbeat.
		time.Sleep(100 * time.Millisecond)

		select {
		case <-lock.Lost():
			t.Fatal("lock should not be lost")
		default:
		}

		require.NoError(t, lock.Release(ctx))

		_, err = backend.Read(ctx, "integration-lock")
		require.ErrorIs(t, err, ErrLockNotFound)
	})
}

func TestCDKLockBackend_NoConditionalFuncs(t *testing.T) {
	t.Run("fallback to unconditional writes when conditional funcs are nil", func(t *testing.T) {
		bucket := newConditionalBucket()
		backend := NewCDKLockBackend(bucket, CDKLockBackendOptions{})

		ctx := context.Background()
		require.NoError(t, backend.Create(ctx, "lock-1", lockInfo("owner-1", time.Minute)))
		require.NoError(t, backend.Update(ctx, "lock-1", lockInfo("owner-1", 2*time.Minute)))
		require.NoError(t, backend.Delete(ctx, "lock-1", "owner-1"))
	})

	t.Run("expired takeover without conditional write", func(t *testing.T) {
		bucket := newConditionalBucket()
		backend := NewCDKLockBackend(bucket, CDKLockBackendOptions{})

		ctx := context.Background()
		require.NoError(t, backend.Create(ctx, "lock-1", lockInfo("owner-1", 100*time.Millisecond)))
		backend.now = func() time.Time { return time.Now().Add(200 * time.Millisecond) }

		err := backend.Create(ctx, "lock-1", lockInfo("owner-2", time.Minute))
		require.NoError(t, err)

		info, err := backend.Read(ctx, "lock-1")
		require.NoError(t, err)
		assert.Equal(t, "owner-2", info.Owner)
	})
}

func TestCDKLockBackend_CorruptData(t *testing.T) {
	t.Run("returns error on corrupt lock data", func(t *testing.T) {
		bucket := newConditionalBucket()
		backend := newTestBackend(bucket)
		ctx := context.Background()

		// Write corrupt data directly via the underlying bucket.
		require.NoError(t, bucket.CDKBucket.WriteAll(ctx, "lock-1", []byte("not json"), nil))
		bucket.mu.Lock()
		bucket.etags["lock-1"] = "1"
		bucket.mu.Unlock()

		_, err := backend.Read(ctx, "lock-1")
		require.Error(t, err)
		assert.Contains(t, err.Error(), "unmarshal")
	})

	t.Run("corrupt data blocks update", func(t *testing.T) {
		bucket := newConditionalBucket()
		backend := newTestBackend(bucket)
		ctx := context.Background()

		require.NoError(t, bucket.CDKBucket.WriteAll(ctx, "lock-1", []byte("{invalid"), nil))
		bucket.mu.Lock()
		bucket.etags["lock-1"] = "1"
		bucket.mu.Unlock()

		err := backend.Update(ctx, "lock-1", lockInfo("owner-1", time.Minute))
		require.Error(t, err)
		assert.Contains(t, err.Error(), "unmarshal")
	})

	t.Run("corrupt data blocks delete", func(t *testing.T) {
		bucket := newConditionalBucket()
		backend := newTestBackend(bucket)
		ctx := context.Background()

		require.NoError(t, bucket.CDKBucket.WriteAll(ctx, "lock-1", []byte("not json"), nil))
		bucket.mu.Lock()
		bucket.etags["lock-1"] = "1"
		bucket.mu.Unlock()

		err := backend.Delete(ctx, "lock-1", "owner-1")
		require.Error(t, err)
		assert.Contains(t, err.Error(), "unmarshal")
	})

	t.Run("corrupt data blocks takeover", func(t *testing.T) {
		bucket := newConditionalBucket()
		backend := newTestBackend(bucket)
		ctx := context.Background()

		require.NoError(t, bucket.CDKBucket.WriteAll(ctx, "lock-1", []byte("garbage"), nil))
		bucket.mu.Lock()
		bucket.etags["lock-1"] = "1"
		bucket.mu.Unlock()
		backend.now = func() time.Time { return time.Now().Add(10 * time.Minute) }

		err := backend.Create(ctx, "lock-1", lockInfo("owner-2", time.Minute))
		require.Error(t, err)
		assert.Contains(t, err.Error(), "unmarshal")
	})
}

// Verify CDKLockBackend implements LockBackend.
var _ LockBackend = (*CDKLockBackend)(nil)

// Verify we handle the IfNotExist error code check.
func TestCDKLockBackend_IfNotExistError(t *testing.T) {
	bucket := newConditionalBucket()
	backend := newTestBackend(bucket)
	ctx := context.Background()

	require.NoError(t, backend.Create(ctx, "lock-1", lockInfo("owner-1", time.Minute)))

	// Trying to create again should hit IfNotExist, then read and find live lock.
	err := backend.Create(ctx, "lock-1", lockInfo("owner-2", time.Minute))
	require.ErrorIs(t, err, ErrLockHeld)

	// Verify gcerrors.Code on the IfNotExist error is indeed FailedPrecondition.
	writeErr := bucket.CDKBucket.WriteAll(ctx, "lock-1", []byte("x"), &blob.WriterOptions{IfNotExist: true})
	require.Error(t, writeErr)
	assert.Equal(t, gcerrors.FailedPrecondition, gcerrors.Code(writeErr))
}

// Verify the Heartbeat field is preserved through serialization.
func TestCDKLockBackend_HeartbeatPreserved(t *testing.T) {
	bucket := newConditionalBucket()
	backend := newTestBackend(bucket)
	ctx := context.Background()

	now := time.Now().Truncate(time.Millisecond)
	info := LockInfo{Owner: "owner-1", TTL: time.Minute, Heartbeat: now}
	require.NoError(t, backend.Create(ctx, "lock-1", info))

	// Verify raw data contains the heartbeat.
	data, err := bucket.ReadAll(ctx, "lock-1")
	require.NoError(t, err)
	var stored LockInfo
	require.NoError(t, json.Unmarshal(data, &stored))
	assert.Equal(t, now.UTC(), stored.Heartbeat.UTC())
}
