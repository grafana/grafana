package search

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

// --- test backend setup ---
//
// Uses conditionalBucket (fake ETag tracking) by default.
// Set CDK_TEST_BUCKET_URL to run against a real provider:
//
//	CDK_TEST_BUCKET_URL=s3://bucket?region=us-east-1 go test ./pkg/storage/unified/search/... -v
//	CDK_TEST_BUCKET_URL=gs://bucket go test ./pkg/storage/unified/search/... -v
//	CDK_TEST_BUCKET_URL=azblob://container go test ./pkg/storage/unified/search/... -v

func testBackend(t *testing.T, opts ...func(*cdkLockBackendOptions)) *cdkLockBackend {
	t.Helper()
	bucket, backendOpts := testBucketAndOpts(t, opts...)
	return newCDKLockBackend(bucket, backendOpts)
}

// testBucketAndOpts returns a shared bucket and options for test backends.
// Uses a real provider when CDK_TEST_BUCKET_URL is set, otherwise a fake conditionalBucket.
func testBucketAndOpts(t *testing.T, opts ...func(*cdkLockBackendOptions)) (resource.CDKBucket, cdkLockBackendOptions) {
	t.Helper()
	var bucket resource.CDKBucket
	var backendOpts cdkLockBackendOptions

	if bucketURL := os.Getenv("CDK_TEST_BUCKET_URL"); bucketURL != "" {
		ctx := context.Background()
		rb, err := blob.OpenBucket(ctx, bucketURL)
		require.NoError(t, err)
		t.Cleanup(func() { _ = rb.Close() })
		backendOpts, err = cdkLockOptionsFromBucket(rb, bucketURL)
		require.NoError(t, err)
		bucket = rb
	} else {
		cb := newConditionalBucket()
		backendOpts = cdkLockBackendOptions{
			ops: newFakeOps(cb),
		}
		bucket = cb
	}
	for _, fn := range opts {
		fn(&backendOpts)
	}
	return bucket, backendOpts
}

func newFakeBackend(bucket *conditionalBucket) *cdkLockBackend {
	return newCDKLockBackend(bucket, cdkLockBackendOptions{
		ops: newFakeOps(bucket),
	})
}

// expiryTestTimings returns timing values appropriate for the current backend.
// Providers have second-level ModTime precisions. Fake backends have no such constraints.
func expiryTestTimings() (ttl, clockSkew, waitForExpiry time.Duration) {
	if os.Getenv("CDK_TEST_BUCKET_URL") != "" {
		return 3 * time.Second, 1 * time.Second, 6 * time.Second
	}
	return 200 * time.Millisecond, 100 * time.Millisecond, 400 * time.Millisecond
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

// --- cdkLockBackend tests ---
// Tests use testBackend(t) so they run against either the fake conditionalBucket
// or a real cloud provider depending on CDK_TEST_BUCKET_URL.

// Verify cdkLockBackend implements lockBackend.
var _ lockBackend = (*cdkLockBackend)(nil)

func TestCDKLockBackend_Create(t *testing.T) {
	t.Run("succeeds create and returns errLockHeld", func(t *testing.T) {
		backend := testBackend(t)
		ctx := context.Background()
		key := testKey(t)
		createLockForTest(t, backend, key, "owner-1", time.Minute)

		info, err := backend.Read(ctx, key)
		require.NoError(t, err)
		assert.Equal(t, "owner-1", info.Owner)

		require.ErrorIs(t, backend.Create(ctx, key, newLockInfo("owner-2", time.Minute)), errLockHeld)
		require.ErrorIs(t, backend.Create(ctx, key, newLockInfo("owner-1", time.Minute)), errLockHeld)
	})

	// --- tests below need fake bucket for internal manipulation ---

	t.Run("takes over expired lock", func(t *testing.T) {
		backend, _ := expiredFakeLock(t, "lock-1", "owner-1")
		ctx := context.Background()

		require.NoError(t, backend.Create(ctx, "lock-1", newLockInfo("owner-2", time.Minute)))

		info, err := backend.Read(ctx, "lock-1")
		require.NoError(t, err)
		assert.Equal(t, "owner-2", info.Owner)
	})

	t.Run("takeover race: conditional write fails", func(t *testing.T) {
		backend, bucket := expiredFakeLock(t, "lock-1", "owner-1")
		ctx := context.Background()

		injectETagMismatch(backend, bucket, "lock-1")

		err := backend.Create(ctx, "lock-1", newLockInfo("owner-2", time.Minute))
		require.ErrorIs(t, err, errLockHeld)
	})

	t.Run("retries create when lock deleted before attrs read", func(t *testing.T) {
		bucket := newConditionalBucket()
		backend := newFakeBackend(bucket)
		ctx := context.Background()

		// Seed a live lock so the initial IfNotExist write fails with "exists".
		require.NoError(t, backend.Create(ctx, "lock-1", newLockInfo("owner-1", time.Minute)))

		// Simulate: lock object deleted between the IfNotExist-exists signal and
		// the Attributes read. fetchAttrsAndData returns errLockNotFound, so Create
		// retries with a fresh IfNotExist write.
		backend.bucket = &notFoundOnAttributesBucket{CDKBucket: bucket}

		err := backend.Create(ctx, "lock-1", newLockInfo("owner-2", time.Minute))
		require.NoError(t, err)

		backend.bucket = bucket
		info, err := backend.Read(ctx, "lock-1")
		require.NoError(t, err)
		assert.Equal(t, "owner-2", info.Owner)
	})

	t.Run("takeover retries create when lock deleted during conditional write", func(t *testing.T) {
		backend, bucket := expiredFakeLock(t, "lock-1", "owner-1")
		ctx := context.Background()

		// Simulate: lock object deleted between ReadAll and WriteAll.
		// Replace bucket with one that returns NotFound on the conditional write.
		origBucket := bucket.CDKBucket
		backend.bucket = &notFoundOnWriteBucket{CDKBucket: origBucket}

		err := backend.Create(ctx, "lock-1", newLockInfo("owner-2", time.Minute))
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
		createLockForTest(t, backend, key, "owner-1", time.Minute)

		err := backend.Update(ctx, key, newLockInfo("owner-1", 2*time.Minute))
		require.NoError(t, err)

		info, err := backend.Read(ctx, key)
		require.NoError(t, err)
		assert.Equal(t, 2*time.Minute, info.TTL)
	})

	t.Run("fails for different owner", func(t *testing.T) {
		backend := testBackend(t)
		ctx := context.Background()
		key := testKey(t)
		createLockForTest(t, backend, key, "owner-1", time.Minute)

		err := backend.Update(ctx, key, newLockInfo("owner-2", time.Minute))
		require.ErrorIs(t, err, errLockHeld)
	})

	t.Run("returns errLockNotFound for missing key", func(t *testing.T) {
		backend := testBackend(t)
		ctx := context.Background()
		key := testKey(t)

		err := backend.Update(ctx, key, newLockInfo("owner-1", time.Minute))
		require.ErrorIs(t, err, errLockNotFound)
	})

	// --- tests below need fake bucket for internal manipulation ---

	t.Run("fails on etag mismatch", func(t *testing.T) {
		bucket := newConditionalBucket()
		backend := newFakeBackend(bucket)
		ctx := context.Background()

		require.NoError(t, backend.Create(ctx, "lock-1", newLockInfo("owner-1", time.Minute)))
		injectETagMismatch(backend, bucket, "lock-1")

		err := backend.Update(ctx, "lock-1", newLockInfo("owner-1", 2*time.Minute))
		require.ErrorIs(t, err, errLockHeld)
	})

	t.Run("rejects renewal of expired lease", func(t *testing.T) {
		backend, _ := expiredFakeLock(t, "lock-1", "owner-1")
		ctx := context.Background()

		err := backend.Update(ctx, "lock-1", newLockInfo("owner-1", time.Minute))
		require.ErrorIs(t, err, errLeaseExpired)
	})

	t.Run("rejects renewal at exact expiry boundary", func(t *testing.T) {
		bucket := newConditionalBucket()
		backend := newFakeBackend(bucket)
		backend.clockSkewAllowance = 0
		ctx := context.Background()

		require.NoError(t, backend.Create(ctx, "lock-1", newLockInfo("owner-1", time.Minute)))
		backend.now = func() time.Time { return time.Now().Add(time.Minute) }

		err := backend.Update(ctx, "lock-1", newLockInfo("owner-1", time.Minute))
		require.ErrorIs(t, err, errLeaseExpired)
	})

	t.Run("succeeds within TTL", func(t *testing.T) {
		bucket := newConditionalBucket()
		backend := newFakeBackend(bucket)
		backend.clockSkewAllowance = 0
		ctx := context.Background()

		require.NoError(t, backend.Create(ctx, "lock-1", newLockInfo("owner-1", time.Minute)))
		backend.now = func() time.Time { return time.Now().Add(59 * time.Second) }

		err := backend.Update(ctx, "lock-1", newLockInfo("owner-1", time.Minute))
		require.NoError(t, err)
	})

	t.Run("returns errLockNotFound when lock deleted during conditional write", func(t *testing.T) {
		bucket := newConditionalBucket()
		backend := newFakeBackend(bucket)
		ctx := context.Background()

		require.NoError(t, backend.Create(ctx, "lock-1", newLockInfo("owner-1", time.Minute)))

		// Swap bucket so conditional write returns NotFound (lock deleted mid-operation).
		origBucket := bucket.CDKBucket
		backend.bucket = &notFoundOnWriteBucket{CDKBucket: origBucket}

		err := backend.Update(ctx, "lock-1", newLockInfo("owner-1", 2*time.Minute))
		require.ErrorIs(t, err, errLockNotFound)
	})
}

func TestCDKLockBackend_Delete(t *testing.T) {
	t.Run("succeeds for correct owner", func(t *testing.T) {
		backend := testBackend(t)
		ctx := context.Background()
		key := testKey(t)

		require.NoError(t, backend.Create(ctx, key, newLockInfo("owner-1", time.Minute)))
		require.NoError(t, backend.Delete(ctx, key, "owner-1"))

		_, err := backend.Read(ctx, key)
		require.ErrorIs(t, err, errLockNotFound)
	})

	t.Run("fails for wrong owner", func(t *testing.T) {
		backend := testBackend(t)
		ctx := context.Background()
		key := testKey(t)
		createLockForTest(t, backend, key, "owner-1", time.Minute)

		err := backend.Delete(ctx, key, "owner-2")
		require.ErrorIs(t, err, errLockHeld)
	})

	t.Run("returns errLockNotFound for missing key", func(t *testing.T) {
		backend := testBackend(t)
		ctx := context.Background()
		key := testKey(t)

		err := backend.Delete(ctx, key, "owner-1")
		require.ErrorIs(t, err, errLockNotFound)
	})

	// --- fake bucket: ETag injection ---

	t.Run("conditional delete fails on etag mismatch", func(t *testing.T) {
		bucket := newConditionalBucket()
		backend := newFakeBackend(bucket)
		ctx := context.Background()

		require.NoError(t, backend.Create(ctx, "lock-1", newLockInfo("owner-1", time.Minute)))
		injectETagMismatch(backend, bucket, "lock-1")

		err := backend.Delete(ctx, "lock-1", "owner-1")
		require.Error(t, err)
		assert.Contains(t, err.Error(), "lock was modified during delete")
	})
}

func TestCDKLockBackend_Read(t *testing.T) {
	t.Run("returns errLockNotFound for missing key", func(t *testing.T) {
		backend := testBackend(t)
		ctx := context.Background()
		key := testKey(t)

		_, err := backend.Read(ctx, key)
		require.ErrorIs(t, err, errLockNotFound)
	})

	t.Run("returns correct lockInfo", func(t *testing.T) {
		backend := testBackend(t)
		ctx := context.Background()
		key := testKey(t)
		createLockForTest(t, backend, key, "owner-1", 5*time.Minute)

		info, err := backend.Read(ctx, key)
		require.NoError(t, err)
		assert.Equal(t, "owner-1", info.Owner)
		assert.Equal(t, 5*time.Minute, info.TTL)
	})
}

func TestCDKLockBackend_ExpiredTakeover(t *testing.T) {
	ttl, clockSkew, wait := expiryTestTimings()
	backend := testBackend(t, func(opts *cdkLockBackendOptions) {
		opts.clockSkewAllowance = clockSkew
	})
	ctx := context.Background()
	key := testKey(t)

	t.Cleanup(func() {
		_ = backend.Delete(ctx, key, "new-owner")
		_ = backend.Delete(ctx, key, "old-owner")
	})

	info := lockInfo{Owner: "old-owner", TTL: ttl, Heartbeat: time.Now()}
	require.NoError(t, backend.Create(ctx, key, info))

	// Wait for mtime + TTL + clockSkewAllowance to pass.
	time.Sleep(wait)

	info2 := lockInfo{Owner: "new-owner", TTL: 30 * time.Second, Heartbeat: time.Now()}
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
	info := lockInfo{Owner: "owner-1", TTL: time.Minute, Heartbeat: now}
	require.NoError(t, backend.Create(ctx, key, info))

	got, err := backend.Read(ctx, key)
	require.NoError(t, err)
	assert.Equal(t, now.UTC(), got.Heartbeat.UTC())
}

// --- tests that always use fake bucket (need internal manipulation) ---

func TestCDKLockBackend_CorruptData(t *testing.T) {
	tests := []struct {
		name string
		op   func(ctx context.Context, backend *cdkLockBackend) error
	}{
		{"read", func(ctx context.Context, b *cdkLockBackend) error {
			_, err := b.Read(ctx, "lock-1")
			return err
		}},
		{"update", func(ctx context.Context, b *cdkLockBackend) error {
			return b.Update(ctx, "lock-1", newLockInfo("owner-1", time.Minute))
		}},
		{"delete", func(ctx context.Context, b *cdkLockBackend) error {
			return b.Delete(ctx, "lock-1", "owner-1")
		}},
		{"takeover", func(ctx context.Context, b *cdkLockBackend) error {
			b.clockSkewAllowance = 0
			b.now = func() time.Time { return time.Now().Add(10 * time.Minute) }
			return b.Create(ctx, "lock-1", newLockInfo("owner-2", time.Minute))
		}},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			bucket := newConditionalBucket()
			backend := newFakeBackend(bucket)
			ctx := context.Background()

			require.NoError(t, bucket.CDKBucket.WriteAll(ctx, "lock-1", []byte("not json"), nil))
			bucket.mu.Lock()
			bucket.etags["lock-1"] = "1"
			bucket.mu.Unlock()

			err := tc.op(ctx, backend)
			require.Error(t, err)
			assert.Contains(t, err.Error(), "unmarshal")
		})
	}
}

func TestCDKLockBackend_IfNotExistError(t *testing.T) {
	bucket := newConditionalBucket()
	backend := newFakeBackend(bucket)
	ctx := context.Background()

	require.NoError(t, backend.Create(ctx, "lock-1", newLockInfo("owner-1", time.Minute)))

	err := backend.Create(ctx, "lock-1", newLockInfo("owner-2", time.Minute))
	require.ErrorIs(t, err, errLockHeld)

	writeErr := bucket.CDKBucket.WriteAll(ctx, "lock-1", []byte("x"), &blob.WriterOptions{IfNotExist: true})
	require.Error(t, writeErr)
	assert.Equal(t, gcerrors.FailedPrecondition, gcerrors.Code(writeErr))
}

func TestCDKLockBackend_S3ConflictError(t *testing.T) {
	bucket := newConditionalBucket()
	backend := newFakeBackend(bucket)
	ctx := context.Background()

	require.NoError(t, backend.Create(ctx, "lock-1", newLockInfo("owner-1", time.Minute)))

	origBucket := bucket.CDKBucket
	bucket.CDKBucket = &s3ConflictBucket{CDKBucket: origBucket}

	err := backend.Create(ctx, "lock-1", newLockInfo("owner-2", time.Minute))
	require.ErrorIs(t, err, errLockHeld)
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

// notFoundOnAttributesBucket simulates a lock object deleted between our
// initial IfNotExist-exists signal and the subsequent Attributes read.
// The first Attributes call deletes the key and delegates, producing
// gcerrors.NotFound; subsequent calls delegate normally.
type notFoundOnAttributesBucket struct {
	resource.CDKBucket
	mu      sync.Mutex
	tripped bool
}

func (b *notFoundOnAttributesBucket) Attributes(ctx context.Context, key string) (*blob.Attributes, error) {
	b.mu.Lock()
	alreadyTripped := b.tripped
	if !alreadyTripped {
		b.tripped = true
		b.mu.Unlock()
		// Delete the object so the retry's IfNotExist write succeeds, then
		// delegate to produce a real gcerrors.NotFound from the now-missing key.
		_ = b.Delete(ctx, key)
		return b.CDKBucket.Attributes(ctx, key)
	}
	b.mu.Unlock()
	return b.CDKBucket.Attributes(ctx, key)
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
		_ = b.Delete(ctx, key)
		// Produce a real gcerrors.NotFound by reading a non-existent key.
		_, err := b.ReadAll(ctx, "__nonexistent__")
		return err
	}
	b.mu.Unlock()
	return b.CDKBucket.WriteAll(ctx, key, data, opts)
}

func TestCDKLockBackend_ClockSkewAllowance(t *testing.T) {
	tests := []struct {
		name           string
		clockSkew      time.Duration // 0 = use default (30s)
		timeAdvance    time.Duration
		expectTakeover bool
	}{
		{"within default allowance", 0, 61 * time.Second, false},
		{"past default TTL+allowance", 0, 91 * time.Second, true},
		{"within custom allowance", 10 * time.Second, 65 * time.Second, false},
		{"past custom TTL+allowance", 10 * time.Second, 71 * time.Second, true},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			bucket := newConditionalBucket()
			opts := cdkLockBackendOptions{
				ops: newFakeOps(bucket),
			}
			if tc.clockSkew > 0 {
				opts.clockSkewAllowance = tc.clockSkew
			}
			backend := newCDKLockBackend(bucket, opts)
			ctx := context.Background()

			require.NoError(t, backend.Create(ctx, "lock-1", newLockInfo("owner-1", time.Minute)))
			backend.now = func() time.Time { return time.Now().Add(tc.timeAdvance) }

			err := backend.Create(ctx, "lock-1", newLockInfo("owner-2", time.Minute))
			if tc.expectTakeover {
				require.NoError(t, err)
			} else {
				require.ErrorIs(t, err, errLockHeld)
			}
		})
	}
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
			require.ErrorIs(t, err, errInvalidLockKey)
		})
	}
}

func TestCDKLockOptionsFromBucket_RejectsUnsupportedProvider(t *testing.T) {
	bucket := memblob.OpenBucket(nil)
	defer func() { _ = bucket.Close() }()

	_, err := cdkLockOptionsFromBucket(bucket, "mem://test-bucket")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "unsupported blob provider")
}

func TestValidateObjectKey_RejectsUnsafePrefix(t *testing.T) {
	err := validateObjectKey("bad#prefix/probe")
	require.ErrorIs(t, err, errInvalidLockKey)
}

func TestBucketTargetFromURL(t *testing.T) {
	tests := []struct {
		url    string
		name   string
		prefix string
	}{
		{"s3://my-bucket", "my-bucket", ""},
		{"s3://my-bucket?prefix=locks/", "my-bucket", "locks/"},
		{"gs://my-bucket?prefix=a/b/", "my-bucket", "a/b/"},
		{"azblob://my-container", "my-container", ""},
	}
	for _, tc := range tests {
		t.Run(tc.url, func(t *testing.T) {
			target, err := bucketTargetFromURL(tc.url)
			require.NoError(t, err)
			assert.Equal(t, tc.name, target.name)
			assert.Equal(t, tc.prefix, target.prefix)
		})
	}
}

func TestBucketTarget_ObjectKey(t *testing.T) {
	assert.Equal(t, "lock-1", bucketTarget{name: "b", prefix: ""}.objectKey("lock-1"))
	assert.Equal(t, "locks/lock-1", bucketTarget{name: "b", prefix: "locks/"}.objectKey("lock-1"))
}

// --- concurrent tests ---
// These prove that conditional writes provide mutual exclusion on real providers.

// testBackendPair returns two cdkLockBackend instances sharing the same underlying bucket.
func testBackendPair(t *testing.T, opts ...func(*cdkLockBackendOptions)) (*cdkLockBackend, *cdkLockBackend) {
	t.Helper()
	bucket, backendOpts := testBucketAndOpts(t, opts...)
	return newCDKLockBackend(bucket, backendOpts), newCDKLockBackend(bucket, backendOpts)
}

// Against real providers (CDK_TEST_BUCKET_URL), this test exercises true
// concurrent conditional-write atomicity. Against the fake conditionalBucket,
// writes are serialised under a mutex, so it only verifies the error-handling
// paths (exactly one errLockHeld, one success) rather than actual race behavior.
func TestCDKLockBackend_ConcurrentTakeover(t *testing.T) {
	ttl, clockSkew, wait := expiryTestTimings()
	backendA, backendB := testBackendPair(t, func(opts *cdkLockBackendOptions) {
		opts.clockSkewAllowance = clockSkew
	})
	ctx := context.Background()
	key := testKey(t)

	t.Cleanup(func() {
		_ = backendA.Delete(ctx, key, "owner-a")
		_ = backendB.Delete(ctx, key, "owner-b")
	})

	// Create an expired lock.
	info := lockInfo{Owner: "old-owner", TTL: ttl, Heartbeat: time.Now()}
	require.NoError(t, backendA.Create(ctx, key, info))

	// Wait for expiry (mtime + TTL + clockSkewAllowance).
	time.Sleep(wait)

	// Race two takeovers. Exactly one should win.
	errCh := make(chan error, 2)
	go func() { errCh <- backendA.Create(ctx, key, newLockInfo("owner-a", 30*time.Second)) }()
	go func() { errCh <- backendB.Create(ctx, key, newLockInfo("owner-b", 30*time.Second)) }()

	err1 := <-errCh
	err2 := <-errCh

	wins := 0
	for _, err := range []error{err1, err2} {
		if err == nil {
			wins++
		} else {
			require.ErrorIs(t, err, errLockHeld, "loser should get errLockHeld, got: %v", err)
		}
	}
	assert.Equal(t, 1, wins, "exactly one takeover should succeed")
}

func TestCDKLockBackend_UpdateAfterTTLExpires(t *testing.T) {
	ttl, clockSkew, wait := expiryTestTimings()
	backend := testBackend(t, func(opts *cdkLockBackendOptions) {
		opts.clockSkewAllowance = clockSkew
	})
	ctx := context.Background()
	key := testKey(t)

	createLockForTest(t, backend, key, "owner-1", ttl)

	// Wait for the lease to expire (mtime + TTL).
	// Use the full wait duration which accounts for provider timestamp precision.
	time.Sleep(wait)

	// Update from the same owner should be rejected — lease has expired.
	err := backend.Update(ctx, key, newLockInfo("owner-1", 30*time.Second))
	require.ErrorIs(t, err, errLeaseExpired)
}

func newLockInfo(owner string, ttl time.Duration) lockInfo {
	return lockInfo{Owner: owner, TTL: ttl, Heartbeat: time.Now()}
}

// createLockForTest creates a lock and registers cleanup to delete it on test exit.
func createLockForTest(t *testing.T, backend *cdkLockBackend, key, owner string, ttl time.Duration) {
	t.Helper()
	ctx := context.Background()
	require.NoError(t, backend.Create(ctx, key, newLockInfo(owner, ttl)))
	t.Cleanup(func() { _ = backend.Delete(context.Background(), key, owner) })
}

// injectETagMismatch swaps ETags to an unexpected an unexpected value to
// simulates concurrent modification between the backend's read and write.
func injectETagMismatch(backend *cdkLockBackend, bucket *conditionalBucket, key string) {
	changeETag := func() {
		bucket.mu.Lock()
		bucket.etags[key] = "concurrent-etag"
		bucket.mu.Unlock()
	}
	backend.ops = &interceptOps{
		conditionalOps:   backend.ops,
		beforeWriteHook:  changeETag,
		beforeDeleteHook: func(string) { changeETag() },
	}
}

// --- conditionalBucket: fake ETag tracking for memblob ---

// errPrecondition is a real gcerrors.FailedPrecondition error generated once from memblob.
// gcerrors doesn't expose a public constructor, so we trigger a real one via IfNotExist.
var errPrecondition = func() error {
	b := memblob.OpenBucket(nil)
	defer func() { _ = b.Close() }()
	ctx := context.Background()
	_ = b.WriteAll(ctx, "x", []byte("x"), nil)
	return b.WriteAll(ctx, "x", []byte("x"), &blob.WriterOptions{IfNotExist: true})
}()

// conditionalBucket wraps a CDKBucket (backed by memblob) and adds ETag tracking
// to simulate conditional write semantics for testing cdkLockBackend.
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
	return fmt.Sprintf("etag-%d", c.seq)
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
			return errPrecondition
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

// expiredFakeLock creates a fake backend with an expired lock at the given key.
// Returns the backend and underlying bucket for tests that need ETag manipulation.
func expiredFakeLock(t *testing.T, key, owner string) (*cdkLockBackend, *conditionalBucket) {
	t.Helper()
	bucket := newConditionalBucket()
	backend := newFakeBackend(bucket)
	backend.clockSkewAllowance = 0
	ctx := context.Background()
	require.NoError(t, backend.Create(ctx, key, newLockInfo(owner, 100*time.Millisecond)))
	backend.now = func() time.Time { return time.Now().Add(200 * time.Millisecond) }
	return backend, bucket
}

// --- fake conditionalOps for test infrastructure ---

type fakeIfMatchRequest struct {
	ETag string
}

// fakeOps implements conditionalOps using the fake ETag tracking in conditionalBucket.
type fakeOps struct {
	bucket *conditionalBucket
}

func newFakeOps(bucket *conditionalBucket) *fakeOps {
	return &fakeOps{bucket: bucket}
}

func (f *fakeOps) BeforeWrite(attrs *blob.Attributes) func(asFunc func(any) bool) error {
	return func(asFunc func(any) bool) error {
		var req *fakeIfMatchRequest
		if asFunc(&req) {
			req.ETag = attrs.ETag
		}
		return nil
	}
}

func (f *fakeOps) Delete(ctx context.Context, key string, attrs *blob.Attributes) error {
	f.bucket.mu.Lock()
	currentETag, exists := f.bucket.etags[key]
	f.bucket.mu.Unlock()

	if !exists {
		return f.bucket.CDKBucket.Delete(ctx, key)
	}
	if currentETag != attrs.ETag {
		return errPrecondition
	}
	return f.bucket.Delete(ctx, key)
}

// interceptOps wraps a conditionalOps and runs hooks before write/delete to
// simulate race conditions (e.g. ETag changes between read and write).
type interceptOps struct {
	conditionalOps
	beforeWriteHook  func()
	beforeDeleteHook func(key string)
}

func (i *interceptOps) BeforeWrite(attrs *blob.Attributes) func(asFunc func(any) bool) error {
	if i.beforeWriteHook != nil {
		i.beforeWriteHook()
	}
	return i.conditionalOps.BeforeWrite(attrs)
}

func (i *interceptOps) Delete(ctx context.Context, key string, attrs *blob.Attributes) error {
	if i.beforeDeleteHook != nil {
		i.beforeDeleteHook(key)
	}
	return i.conditionalOps.Delete(ctx, key, attrs)
}
