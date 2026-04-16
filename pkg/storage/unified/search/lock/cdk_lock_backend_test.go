package lock

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"strings"
	"sync"
	"testing"
	"time"

	smithyhttp "github.com/aws/smithy-go/transport/http"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gocloud.dev/blob"
	_ "gocloud.dev/blob/azureblob"
	_ "gocloud.dev/blob/gcsblob"
	"gocloud.dev/blob/memblob"
	_ "gocloud.dev/blob/s3blob"
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
			_ = c.CDKBucket.WriteAll(ctx, key+"__etag_check", []byte("x"), nil)
			err := c.CDKBucket.WriteAll(ctx, key+"__etag_check", []byte("x"), &blob.WriterOptions{IfNotExist: true})
			_ = c.CDKBucket.Delete(ctx, key+"__etag_check")
			if err != nil {
				return err
			}
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
			return bucket.CDKBucket.Delete(ctx, key)
		}
		if currentETag != attrs.ETag {
			_ = bucket.CDKBucket.WriteAll(ctx, key+"__del_check", []byte("x"), nil)
			err := bucket.CDKBucket.WriteAll(ctx, key+"__del_check", []byte("x"), &blob.WriterOptions{IfNotExist: true})
			_ = bucket.CDKBucket.Delete(ctx, key+"__del_check")
			return err
		}
		return bucket.Delete(ctx, key)
	}
}

// --- test backend setup ---
//
// Uses conditionalBucket (fake ETag tracking) by default.
// Set CDK_TEST_BUCKET_URL to run against a real provider:
//
//	CDK_TEST_BUCKET_URL=s3://bucket?region=us-east-1 go test ./pkg/storage/unified/search/lock/... -v
//	CDK_TEST_BUCKET_URL=gs://bucket go test ./pkg/storage/unified/search/lock/... -v
//	CDK_TEST_BUCKET_URL=azblob://container go test ./pkg/storage/unified/search/lock/... -v

func testBackend(t *testing.T, opts ...func(*CDKLockBackendOptions)) *CDKLockBackend {
	t.Helper()
	var bucket resource.CDKBucket
	var backendOpts CDKLockBackendOptions

	if bucketURL := os.Getenv("CDK_TEST_BUCKET_URL"); bucketURL != "" {
		ctx := context.Background()
		rb, err := blob.OpenBucket(ctx, bucketURL)
		require.NoError(t, err)
		t.Cleanup(func() { _ = rb.Close() })
		backendOpts, err = CDKLockOptionsFromBucket(rb, bucketURL)
		require.NoError(t, err)
		bucket = rb
	} else {
		cb := newConditionalBucket()
		backendOpts = CDKLockBackendOptions{
			ConditionalWrite:  fakeConditionalWrite,
			ConditionalDelete: fakeConditionalDeleteFor(cb),
		}
		bucket = cb
	}
	for _, fn := range opts {
		fn(&backendOpts)
	}
	return NewCDKLockBackend(bucket, backendOpts)
}

// testKey returns a unique lock key for the current test, safe for real providers.
func testKey(t *testing.T, suffix ...string) string {
	t.Helper()
	name := strings.ReplaceAll(t.Name(), "/", "-")
	if len(suffix) > 0 {
		name += "-" + suffix[0]
	}
	return "test-locks/" + name
}

func newFakeBackend(bucket *conditionalBucket) *CDKLockBackend {
	return NewCDKLockBackend(bucket, CDKLockBackendOptions{
		ConditionalWrite:  fakeConditionalWrite,
		ConditionalDelete: fakeConditionalDeleteFor(bucket),
	})
}

func lockInfo(owner string, ttl time.Duration) LockInfo {
	return LockInfo{Owner: owner, TTL: ttl, Heartbeat: time.Now()}
}

// --- CDKLockBackend tests ---
// Tests use testBackend(t) so they run against either the fake conditionalBucket
// or a real cloud provider depending on CDK_TEST_BUCKET_URL.

// Verify CDKLockBackend implements LockBackend.
var _ LockBackend = (*CDKLockBackend)(nil)

func TestCDKLockBackend_Create(t *testing.T) {
	t.Run("succeeds on empty bucket", func(t *testing.T) {
		backend := testBackend(t)
		ctx := context.Background()
		key := testKey(t)
		t.Cleanup(func() { _ = backend.Delete(ctx, key, "owner-1") })

		err := backend.Create(ctx, key, lockInfo("owner-1", time.Minute))
		require.NoError(t, err)

		info, err := backend.Read(ctx, key)
		require.NoError(t, err)
		assert.Equal(t, "owner-1", info.Owner)
	})

	t.Run("returns ErrLockHeld for live lock", func(t *testing.T) {
		backend := testBackend(t)
		ctx := context.Background()
		key := testKey(t)
		t.Cleanup(func() { _ = backend.Delete(ctx, key, "owner-1") })

		require.NoError(t, backend.Create(ctx, key, lockInfo("owner-1", time.Minute)))

		err := backend.Create(ctx, key, lockInfo("owner-2", time.Minute))
		require.ErrorIs(t, err, ErrLockHeld)
	})

	// --- tests below need fake bucket for internal manipulation ---

	t.Run("takes over expired lock", func(t *testing.T) {
		bucket := newConditionalBucket()
		backend := newFakeBackend(bucket)
		backend.clockSkewAllowance = 0
		ctx := context.Background()

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
		backend := newFakeBackend(bucket)
		backend.clockSkewAllowance = 0
		ctx := context.Background()

		require.NoError(t, backend.Create(ctx, "lock-1", lockInfo("owner-1", 100*time.Millisecond)))
		backend.now = func() time.Time { return time.Now().Add(200 * time.Millisecond) }

		origWrite := backend.conditionalWriteFn
		backend.conditionalWriteFn = func(attrs *blob.Attributes) func(asFunc func(any) bool) error {
			bucket.mu.Lock()
			bucket.etags["lock-1"] = "raced-etag"
			bucket.mu.Unlock()
			return origWrite(attrs)
		}

		err := backend.Create(ctx, "lock-1", lockInfo("owner-2", time.Minute))
		require.ErrorIs(t, err, ErrLockHeld)
	})

	t.Run("takeover retries create when lock deleted during conditional write", func(t *testing.T) {
		bucket := newConditionalBucket()
		backend := newFakeBackend(bucket)
		backend.clockSkewAllowance = 0
		ctx := context.Background()

		require.NoError(t, backend.Create(ctx, "lock-1", lockInfo("owner-1", 100*time.Millisecond)))
		backend.now = func() time.Time { return time.Now().Add(200 * time.Millisecond) }

		// Simulate: lock object deleted between ReadAll and WriteAll.
		// Replace bucket with one that returns NotFound on the conditional write.
		origBucket := bucket.CDKBucket
		backend.bucket = &notFoundOnWriteBucket{CDKBucket: origBucket}

		err := backend.Create(ctx, "lock-1", lockInfo("owner-2", time.Minute))
		require.NoError(t, err)

		// Restore bucket for read.
		backend.bucket = bucket
		info, err := backend.Read(ctx, "lock-1")
		require.NoError(t, err)
		assert.Equal(t, "owner-2", info.Owner)
	})
}

func TestCDKLockBackend_Update(t *testing.T) {
	t.Run("succeeds for same owner", func(t *testing.T) {
		backend := testBackend(t)
		ctx := context.Background()
		key := testKey(t)
		t.Cleanup(func() { _ = backend.Delete(ctx, key, "owner-1") })

		require.NoError(t, backend.Create(ctx, key, lockInfo("owner-1", time.Minute)))

		err := backend.Update(ctx, key, lockInfo("owner-1", 2*time.Minute))
		require.NoError(t, err)

		info, err := backend.Read(ctx, key)
		require.NoError(t, err)
		assert.Equal(t, 2*time.Minute, info.TTL)
	})

	t.Run("fails for different owner", func(t *testing.T) {
		backend := testBackend(t)
		ctx := context.Background()
		key := testKey(t)
		t.Cleanup(func() { _ = backend.Delete(ctx, key, "owner-1") })

		require.NoError(t, backend.Create(ctx, key, lockInfo("owner-1", time.Minute)))

		err := backend.Update(ctx, key, lockInfo("owner-2", time.Minute))
		require.ErrorIs(t, err, ErrLockHeld)
	})

	t.Run("returns ErrLockNotFound for missing key", func(t *testing.T) {
		backend := testBackend(t)
		ctx := context.Background()
		key := testKey(t)

		err := backend.Update(ctx, key, lockInfo("owner-1", time.Minute))
		require.ErrorIs(t, err, ErrLockNotFound)
	})

	// --- tests below need fake bucket for internal manipulation ---

	t.Run("fails on etag mismatch", func(t *testing.T) {
		bucket := newConditionalBucket()
		backend := newFakeBackend(bucket)
		ctx := context.Background()

		require.NoError(t, backend.Create(ctx, "lock-1", lockInfo("owner-1", time.Minute)))

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

	t.Run("rejects renewal of expired lease", func(t *testing.T) {
		bucket := newConditionalBucket()
		backend := newFakeBackend(bucket)
		backend.clockSkewAllowance = 0
		ctx := context.Background()

		require.NoError(t, backend.Create(ctx, "lock-1", lockInfo("owner-1", 100*time.Millisecond)))
		backend.now = func() time.Time { return time.Now().Add(200 * time.Millisecond) }

		err := backend.Update(ctx, "lock-1", lockInfo("owner-1", time.Minute))
		require.ErrorIs(t, err, ErrLeaseExpired)
	})

	t.Run("succeeds within TTL", func(t *testing.T) {
		bucket := newConditionalBucket()
		backend := newFakeBackend(bucket)
		backend.clockSkewAllowance = 0
		ctx := context.Background()

		require.NoError(t, backend.Create(ctx, "lock-1", lockInfo("owner-1", time.Minute)))
		backend.now = func() time.Time { return time.Now().Add(59 * time.Second) }

		err := backend.Update(ctx, "lock-1", lockInfo("owner-1", time.Minute))
		require.NoError(t, err)
	})

	t.Run("returns ErrLockNotFound when lock deleted during conditional write", func(t *testing.T) {
		bucket := newConditionalBucket()
		backend := newFakeBackend(bucket)
		ctx := context.Background()

		require.NoError(t, backend.Create(ctx, "lock-1", lockInfo("owner-1", time.Minute)))

		// Swap bucket so conditional write returns NotFound (lock deleted mid-operation).
		origBucket := bucket.CDKBucket
		backend.bucket = &notFoundOnWriteBucket{CDKBucket: origBucket}

		err := backend.Update(ctx, "lock-1", lockInfo("owner-1", 2*time.Minute))
		require.ErrorIs(t, err, ErrLockNotFound)
	})
}

func TestCDKLockBackend_Delete(t *testing.T) {
	t.Run("succeeds for correct owner", func(t *testing.T) {
		backend := testBackend(t)
		ctx := context.Background()
		key := testKey(t)

		require.NoError(t, backend.Create(ctx, key, lockInfo("owner-1", time.Minute)))
		require.NoError(t, backend.Delete(ctx, key, "owner-1"))

		_, err := backend.Read(ctx, key)
		require.ErrorIs(t, err, ErrLockNotFound)
	})

	t.Run("fails for wrong owner", func(t *testing.T) {
		backend := testBackend(t)
		ctx := context.Background()
		key := testKey(t)
		t.Cleanup(func() { _ = backend.Delete(ctx, key, "owner-1") })

		require.NoError(t, backend.Create(ctx, key, lockInfo("owner-1", time.Minute)))

		err := backend.Delete(ctx, key, "owner-2")
		require.ErrorIs(t, err, ErrLockHeld)
	})

	t.Run("returns ErrLockNotFound for missing key", func(t *testing.T) {
		backend := testBackend(t)
		ctx := context.Background()
		key := testKey(t)

		err := backend.Delete(ctx, key, "owner-1")
		require.ErrorIs(t, err, ErrLockNotFound)
	})

	// --- fake bucket: ETag injection ---

	t.Run("conditional delete fails on etag mismatch", func(t *testing.T) {
		bucket := newConditionalBucket()
		backend := newFakeBackend(bucket)
		ctx := context.Background()

		require.NoError(t, backend.Create(ctx, "lock-1", lockInfo("owner-1", time.Minute)))

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
		backend := testBackend(t)
		ctx := context.Background()
		key := testKey(t)

		_, err := backend.Read(ctx, key)
		require.ErrorIs(t, err, ErrLockNotFound)
	})

	t.Run("returns correct LockInfo", func(t *testing.T) {
		backend := testBackend(t)
		ctx := context.Background()
		key := testKey(t)
		t.Cleanup(func() { _ = backend.Delete(ctx, key, "owner-1") })

		require.NoError(t, backend.Create(ctx, key, lockInfo("owner-1", 5*time.Minute)))

		info, err := backend.Read(ctx, key)
		require.NoError(t, err)
		assert.Equal(t, "owner-1", info.Owner)
		assert.Equal(t, 5*time.Minute, info.TTL)
	})
}

func TestCDKLockBackend_ExpiredTakeover(t *testing.T) {
	ttl, clockSkew, wait := expiryTestTimings()
	backend := testBackend(t, func(opts *CDKLockBackendOptions) {
		opts.ClockSkewAllowance = clockSkew
	})
	ctx := context.Background()
	key := testKey(t)

	t.Cleanup(func() {
		_ = backend.Delete(ctx, key, "new-owner")
		_ = backend.Delete(ctx, key, "old-owner")
	})

	info := LockInfo{Owner: "old-owner", TTL: ttl, Heartbeat: time.Now()}
	require.NoError(t, backend.Create(ctx, key, info))

	// Wait for mtime + TTL + clockSkewAllowance to pass.
	time.Sleep(wait)

	info2 := LockInfo{Owner: "new-owner", TTL: 30 * time.Second, Heartbeat: time.Now()}
	require.NoError(t, backend.Create(ctx, key, info2))

	got, err := backend.Read(ctx, key)
	require.NoError(t, err)
	assert.Equal(t, "new-owner", got.Owner)
}

func TestCDKLockBackend_HeartbeatPreserved(t *testing.T) {
	backend := testBackend(t)
	ctx := context.Background()
	key := testKey(t)
	t.Cleanup(func() { _ = backend.Delete(ctx, key, "owner-1") })

	now := time.Now().Truncate(time.Millisecond)
	info := LockInfo{Owner: "owner-1", TTL: time.Minute, Heartbeat: now}
	require.NoError(t, backend.Create(ctx, key, info))

	got, err := backend.Read(ctx, key)
	require.NoError(t, err)
	assert.Equal(t, now.UTC(), got.Heartbeat.UTC())
}

func TestCDKLockBackend_RejectsInvalidKeys(t *testing.T) {
	backend := testBackend(t)
	ctx := context.Background()

	badKey := "lock#bad"
	err := backend.Create(ctx, badKey, lockInfo("owner", time.Minute))
	require.ErrorIs(t, err, ErrInvalidLockKey)

	err = backend.Update(ctx, badKey, lockInfo("owner", time.Minute))
	require.ErrorIs(t, err, ErrInvalidLockKey)

	err = backend.Delete(ctx, badKey, "owner")
	require.ErrorIs(t, err, ErrInvalidLockKey)

	_, err = backend.Read(ctx, badKey)
	require.ErrorIs(t, err, ErrInvalidLockKey)
}

// --- tests that always use fake bucket (need internal manipulation) ---

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
		backend.clockSkewAllowance = 0

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
		backend := newFakeBackend(bucket)
		ctx := context.Background()

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
		backend := newFakeBackend(bucket)
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
		backend := newFakeBackend(bucket)
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
		backend := newFakeBackend(bucket)
		backend.clockSkewAllowance = 0
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

func TestCDKLockBackend_IfNotExistError(t *testing.T) {
	bucket := newConditionalBucket()
	backend := newFakeBackend(bucket)
	ctx := context.Background()

	require.NoError(t, backend.Create(ctx, "lock-1", lockInfo("owner-1", time.Minute)))

	err := backend.Create(ctx, "lock-1", lockInfo("owner-2", time.Minute))
	require.ErrorIs(t, err, ErrLockHeld)

	writeErr := bucket.CDKBucket.WriteAll(ctx, "lock-1", []byte("x"), &blob.WriterOptions{IfNotExist: true})
	require.Error(t, writeErr)
	assert.Equal(t, gcerrors.FailedPrecondition, gcerrors.Code(writeErr))
}

func TestCDKLockBackend_S3ConflictError(t *testing.T) {
	bucket := newConditionalBucket()
	backend := newFakeBackend(bucket)
	ctx := context.Background()

	require.NoError(t, backend.Create(ctx, "lock-1", lockInfo("owner-1", time.Minute)))

	origBucket := bucket.CDKBucket
	bucket.CDKBucket = &s3ConflictBucket{CDKBucket: origBucket}

	err := backend.Create(ctx, "lock-1", lockInfo("owner-2", time.Minute))
	require.ErrorIs(t, err, ErrLockHeld)
}

// s3ConflictBucket returns a smithy 409 error for IfNotExist writes.
type s3ConflictBucket struct {
	resource.CDKBucket
}

func (b *s3ConflictBucket) WriteAll(ctx context.Context, key string, data []byte, opts *blob.WriterOptions) error {
	if opts != nil && opts.IfNotExist {
		return &smithyhttp.ResponseError{
			Response: &smithyhttp.Response{
				Response: &http.Response{StatusCode: 409},
			},
			Err: fmt.Errorf("ConditionalRequestConflict"),
		}
	}
	return b.CDKBucket.WriteAll(ctx, key, data, opts)
}

// notFoundOnWriteBucket simulates a lock object deleted between read and conditional write.
// The first non-IfNotExist write returns gcerrors.NotFound and deletes the target object;
// subsequent writes (e.g. retryCreate with IfNotExist) delegate normally.
type notFoundOnWriteBucket struct {
	resource.CDKBucket
	mu      sync.Mutex
	tripped bool
}

func (b *notFoundOnWriteBucket) WriteAll(ctx context.Context, key string, data []byte, opts *blob.WriterOptions) error {
	b.mu.Lock()
	alreadyTripped := b.tripped
	if !alreadyTripped && (opts == nil || !opts.IfNotExist) {
		b.tripped = true
		b.mu.Unlock()
		// Delete the object so a subsequent IfNotExist write succeeds.
		_ = b.CDKBucket.Delete(ctx, key)
		// Produce a real gcerrors.NotFound by reading a non-existent key.
		_, err := b.CDKBucket.ReadAll(ctx, "__nonexistent__")
		return err
	}
	b.mu.Unlock()
	return b.CDKBucket.WriteAll(ctx, key, data, opts)
}

func TestCDKLockBackend_ClockSkewAllowance(t *testing.T) {
	t.Run("within allowance does not trigger takeover", func(t *testing.T) {
		bucket := newConditionalBucket()
		backend := newFakeBackend(bucket)
		ctx := context.Background()

		require.NoError(t, backend.Create(ctx, "lock-1", lockInfo("owner-1", time.Minute)))
		backend.now = func() time.Time { return time.Now().Add(61 * time.Second) }

		err := backend.Create(ctx, "lock-1", lockInfo("owner-2", time.Minute))
		require.ErrorIs(t, err, ErrLockHeld)
	})

	t.Run("past TTL+allowance triggers takeover", func(t *testing.T) {
		bucket := newConditionalBucket()
		backend := newFakeBackend(bucket)
		ctx := context.Background()

		require.NoError(t, backend.Create(ctx, "lock-1", lockInfo("owner-1", time.Minute)))
		backend.now = func() time.Time { return time.Now().Add(91 * time.Second) }

		err := backend.Create(ctx, "lock-1", lockInfo("owner-2", time.Minute))
		require.NoError(t, err)
	})

	t.Run("configurable allowance", func(t *testing.T) {
		bucket := newConditionalBucket()
		backend := NewCDKLockBackend(bucket, CDKLockBackendOptions{
			ConditionalWrite:   fakeConditionalWrite,
			ConditionalDelete:  fakeConditionalDeleteFor(bucket),
			ClockSkewAllowance: 10 * time.Second,
		})
		ctx := context.Background()

		require.NoError(t, backend.Create(ctx, "lock-1", lockInfo("owner-1", time.Minute)))
		backend.now = func() time.Time { return time.Now().Add(65 * time.Second) }
		err := backend.Create(ctx, "lock-1", lockInfo("owner-2", time.Minute))
		require.ErrorIs(t, err, ErrLockHeld)

		backend.now = func() time.Time { return time.Now().Add(71 * time.Second) }
		err = backend.Create(ctx, "lock-1", lockInfo("owner-2", time.Minute))
		require.NoError(t, err)
	})
}

// --- key validation (pure, no backend needed) ---

func TestValidateObjectKey(t *testing.T) {
	valid := []string{
		"lock-1",
		"test-locks/crud",
		"my_lock.v2",
		"a/b/c",
		"UPPER-case-123",
	}
	for _, k := range valid {
		t.Run("valid:"+k, func(t *testing.T) {
			require.NoError(t, validateObjectKey(k))
		})
	}

	invalid := []struct {
		key    string
		reason string
	}{
		{"", "empty"},
		{"a#b", "hash"},
		{"a?b", "question mark"},
		{"a\nb", "newline"},
		{"../x", "dot-dot leading"},
		{"a/../b", "dot-dot middle"},
		{"/x", "leading slash"},
		{"x/", "trailing slash"},
		{"a b", "space"},
		{"a\"b", "double quote"},
		{"a\\b", "backslash"},
		{"a\x00b", "null byte"},
		{"a\x7fb", "DEL character"},
	}
	for _, tc := range invalid {
		t.Run("invalid:"+tc.reason, func(t *testing.T) {
			err := validateObjectKey(tc.key)
			require.ErrorIs(t, err, ErrInvalidLockKey)
		})
	}
}

func TestCDKLockOptionsFromBucket_RejectsUnsupportedProvider(t *testing.T) {
	bucket := memblob.OpenBucket(nil)
	defer bucket.Close()

	_, err := CDKLockOptionsFromBucket(bucket, "mem://test-bucket")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "unsupported blob provider")
}

func TestValidateObjectKey_RejectsUnsafePrefix(t *testing.T) {
	err := validateObjectKey("bad#prefix/probe")
	require.ErrorIs(t, err, ErrInvalidLockKey)
}

// expiryTestTimings returns timing values appropriate for the current backend.
// Real providers have second-level ModTime precision and potential clock skew,
// so sub-second TTLs are unreliable. Fake backends have no such constraints.
func expiryTestTimings() (ttl, clockSkew, waitForExpiry time.Duration) {
	if os.Getenv("CDK_TEST_BUCKET_URL") != "" {
		return 3 * time.Second, 1 * time.Second, 6 * time.Second
	}
	return 200 * time.Millisecond, 100 * time.Millisecond, 400 * time.Millisecond
}

// --- concurrent tests ---
// These prove that conditional writes provide mutual exclusion on real providers.

// testBackendPair returns two CDKLockBackend instances sharing the same underlying bucket.
func testBackendPair(t *testing.T, opts ...func(*CDKLockBackendOptions)) (*CDKLockBackend, *CDKLockBackend) {
	t.Helper()
	var bucket resource.CDKBucket
	var backendOpts CDKLockBackendOptions

	if bucketURL := os.Getenv("CDK_TEST_BUCKET_URL"); bucketURL != "" {
		ctx := context.Background()
		rb, err := blob.OpenBucket(ctx, bucketURL)
		require.NoError(t, err)
		t.Cleanup(func() { _ = rb.Close() })
		backendOpts, err = CDKLockOptionsFromBucket(rb, bucketURL)
		require.NoError(t, err)
		bucket = rb
	} else {
		cb := newConditionalBucket()
		backendOpts = CDKLockBackendOptions{
			ConditionalWrite:  fakeConditionalWrite,
			ConditionalDelete: fakeConditionalDeleteFor(cb),
		}
		bucket = cb
	}
	for _, fn := range opts {
		fn(&backendOpts)
	}
	return NewCDKLockBackend(bucket, backendOpts), NewCDKLockBackend(bucket, backendOpts)
}

func TestCDKLockBackend_ConcurrentTakeover(t *testing.T) {
	ttl, clockSkew, wait := expiryTestTimings()
	backendA, backendB := testBackendPair(t, func(opts *CDKLockBackendOptions) {
		opts.ClockSkewAllowance = clockSkew
	})
	ctx := context.Background()
	key := testKey(t)

	t.Cleanup(func() {
		_ = backendA.Delete(ctx, key, "owner-a")
		_ = backendB.Delete(ctx, key, "owner-b")
	})

	// Create an expired lock.
	info := LockInfo{Owner: "old-owner", TTL: ttl, Heartbeat: time.Now()}
	require.NoError(t, backendA.Create(ctx, key, info))

	// Wait for expiry (mtime + TTL + clockSkewAllowance).
	time.Sleep(wait)

	// Race two takeovers. Exactly one should win.
	errCh := make(chan error, 2)
	go func() { errCh <- backendA.Create(ctx, key, lockInfo("owner-a", 30*time.Second)) }()
	go func() { errCh <- backendB.Create(ctx, key, lockInfo("owner-b", 30*time.Second)) }()

	err1 := <-errCh
	err2 := <-errCh

	wins := 0
	for _, err := range []error{err1, err2} {
		if err == nil {
			wins++
		} else {
			require.ErrorIs(t, err, ErrLockHeld, "loser should get ErrLockHeld, got: %v", err)
		}
	}
	assert.Equal(t, 1, wins, "exactly one takeover should succeed")
}

func TestCDKLockBackend_UpdateAfterTTLExpires(t *testing.T) {
	ttl, clockSkew, wait := expiryTestTimings()
	backend := testBackend(t, func(opts *CDKLockBackendOptions) {
		opts.ClockSkewAllowance = clockSkew
	})
	ctx := context.Background()
	key := testKey(t)

	t.Cleanup(func() { _ = backend.Delete(ctx, key, "owner-1") })

	// Create a lock with a short TTL.
	info := LockInfo{Owner: "owner-1", TTL: ttl, Heartbeat: time.Now()}
	require.NoError(t, backend.Create(ctx, key, info))

	// Wait for the lease to expire (mtime + TTL).
	// Use the full wait duration which accounts for provider timestamp precision.
	time.Sleep(wait)

	// Update from the same owner should be rejected — lease has expired.
	err := backend.Update(ctx, key, lockInfo("owner-1", 30*time.Second))
	require.ErrorIs(t, err, ErrLeaseExpired)
}
