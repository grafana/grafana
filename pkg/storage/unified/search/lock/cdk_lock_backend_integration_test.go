package lock

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gocloud.dev/blob"
	_ "gocloud.dev/blob/azureblob"
	"gocloud.dev/blob/fileblob"
	_ "gocloud.dev/blob/gcsblob"
	_ "gocloud.dev/blob/s3blob"
)

// Integration tests for CDKLockBackend.
//
// fileblob tests always run (no conditional writes — exercises the unconditional fallback).
//
// Set CDK_LOCK_TEST_BUCKET_URL to also run against a real provider:
//
//	CDK_LOCK_TEST_BUCKET_URL=s3://my-test-bucket?region=us-east-1 go test ./pkg/storage/unified/search/lock/... -run TestIntegration -v
//	CDK_LOCK_TEST_BUCKET_URL=gs://my-test-bucket go test ./pkg/storage/unified/search/lock/... -run TestIntegration -v
//	CDK_LOCK_TEST_BUCKET_URL=azblob://my-test-container go test ./pkg/storage/unified/search/lock/... -run TestIntegration -v

type testBucketSetup struct {
	name    string
	bucket  *blob.Bucket
	opts    CDKLockBackendOptions
	cleanup func()
}

func integrationBuckets(t *testing.T) []testBucketSetup {
	t.Helper()
	var setups []testBucketSetup

	// fileblob — always available, no conditional writes.
	dir := t.TempDir()
	fb, err := fileblob.OpenBucket(dir, nil)
	require.NoError(t, err)
	setups = append(setups, testBucketSetup{
		name:    "fileblob",
		bucket:  fb,
		opts:    CDKLockBackendOptions{}, // no conditional funcs
		cleanup: func() { _ = fb.Close() },
	})

	// Real provider — when CDK_LOCK_TEST_BUCKET_URL is set.
	if bucketURL := os.Getenv("CDK_LOCK_TEST_BUCKET_URL"); bucketURL != "" {
		ctx := context.Background()
		rb, err := blob.OpenBucket(ctx, bucketURL)
		require.NoError(t, err)
		ropts, err := CDKLockOptionsFromBucket(rb, bucketURL)
		require.NoError(t, err)
		setups = append(setups, testBucketSetup{
			name:    "remote:" + bucketURL,
			bucket:  rb,
			opts:    ropts,
			cleanup: func() { _ = rb.Close() },
		})
	}

	return setups
}

func TestIntegrationCDKLockBackend_CreateReadDelete(t *testing.T) {
	for _, setup := range integrationBuckets(t) {
		t.Run(setup.name, func(t *testing.T) {
			t.Cleanup(setup.cleanup)
			backend := NewCDKLockBackend(setup.bucket, setup.opts)
			ctx := context.Background()
			key := "test-locks/crud"

			t.Cleanup(func() { _ = backend.Delete(ctx, key, "test-owner") })

			// Create
			info := LockInfo{Owner: "test-owner", TTL: 30 * time.Second, Heartbeat: time.Now()}
			require.NoError(t, backend.Create(ctx, key, info))

			// Read
			got, err := backend.Read(ctx, key)
			require.NoError(t, err)
			assert.Equal(t, "test-owner", got.Owner)
			assert.Equal(t, 30*time.Second, got.TTL)

			// Create again — should get ErrLockHeld
			info2 := LockInfo{Owner: "other-owner", TTL: 30 * time.Second, Heartbeat: time.Now()}
			err = backend.Create(ctx, key, info2)
			assert.ErrorIs(t, err, ErrLockHeld)

			// Delete
			require.NoError(t, backend.Delete(ctx, key, "test-owner"))

			// Read after delete — should get ErrLockNotFound
			_, err = backend.Read(ctx, key)
			assert.ErrorIs(t, err, ErrLockNotFound)
		})
	}
}

func TestIntegrationCDKLockBackend_Update(t *testing.T) {
	for _, setup := range integrationBuckets(t) {
		t.Run(setup.name, func(t *testing.T) {
			t.Cleanup(setup.cleanup)
			backend := NewCDKLockBackend(setup.bucket, setup.opts)
			ctx := context.Background()
			key := "test-locks/update"

			t.Cleanup(func() { _ = backend.Delete(ctx, key, "test-owner") })

			// Create
			info := LockInfo{Owner: "test-owner", TTL: 30 * time.Second, Heartbeat: time.Now()}
			require.NoError(t, backend.Create(ctx, key, info))

			// Update (heartbeat)
			info.Heartbeat = time.Now()
			require.NoError(t, backend.Update(ctx, key, info))

			// Update from wrong owner — should fail
			wrongInfo := LockInfo{Owner: "wrong-owner", TTL: 30 * time.Second, Heartbeat: time.Now()}
			err := backend.Update(ctx, key, wrongInfo)
			assert.ErrorIs(t, err, ErrLockHeld)

			// Cleanup
			require.NoError(t, backend.Delete(ctx, key, "test-owner"))
		})
	}
}

func TestIntegrationCDKLockBackend_ExpiredTakeover(t *testing.T) {
	for _, setup := range integrationBuckets(t) {
		t.Run(setup.name, func(t *testing.T) {
			t.Cleanup(setup.cleanup)
			backend := NewCDKLockBackend(setup.bucket, setup.opts)
			ctx := context.Background()
			key := "test-locks/takeover"

			t.Cleanup(func() {
				_ = backend.Delete(ctx, key, "new-owner")
				_ = backend.Delete(ctx, key, "old-owner")
			})

			// Create a lock with a very short TTL.
			info := LockInfo{Owner: "old-owner", TTL: 1 * time.Second, Heartbeat: time.Now()}
			require.NoError(t, backend.Create(ctx, key, info))

			// Wait for it to expire (mtime + TTL).
			time.Sleep(2 * time.Second)

			// Another owner should be able to take over.
			info2 := LockInfo{Owner: "new-owner", TTL: 30 * time.Second, Heartbeat: time.Now()}
			require.NoError(t, backend.Create(ctx, key, info2))

			// Verify new owner
			got, err := backend.Read(ctx, key)
			require.NoError(t, err)
			assert.Equal(t, "new-owner", got.Owner)

			// Cleanup
			require.NoError(t, backend.Delete(ctx, key, "new-owner"))
		})
	}
}

func TestIntegrationObjectStorageLock_AcquireHeartbeatRelease(t *testing.T) {
	for _, setup := range integrationBuckets(t) {
		t.Run(setup.name, func(t *testing.T) {
			t.Cleanup(setup.cleanup)
			backend := NewCDKLockBackend(setup.bucket, setup.opts)
			ctx := context.Background()
			key := "test-locks/lifecycle"

			lock := NewObjectStorageLock(ObjectStorageLockConfig{
				Backend:           backend,
				Key:               key,
				Owner:             "integration-test",
				TTL:               30 * time.Second,
				HeartbeatInterval: 2 * time.Second,
			})

			// Acquire
			require.NoError(t, lock.Acquire(ctx))

			// Verify lock exists
			got, err := backend.Read(ctx, key)
			require.NoError(t, err)
			assert.Equal(t, "integration-test", got.Owner)

			// Wait for at least one heartbeat
			time.Sleep(3 * time.Second)

			// Lock should not be lost
			select {
			case <-lock.Lost():
				t.Fatal("lock should not be lost during healthy heartbeat")
			default:
			}

			// Release
			require.NoError(t, lock.Release(ctx))

			// Verify lock is gone
			_, err = backend.Read(ctx, key)
			assert.ErrorIs(t, err, ErrLockNotFound)
		})
	}
}
