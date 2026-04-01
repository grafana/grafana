package lock

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"gocloud.dev/blob"
	"gocloud.dev/gcerrors"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

// ConditionalWriteFunc performs a conditional write using If-Match / ifGenerationMatch
//
// ETag or Generation can be extracted from attrs and used to construct provider-specific options.
//
// When nil, the backend falls back to non-conditional writes.
type ConditionalWriteFunc func(attrs *blob.Attributes) func(asFunc func(any) bool) error

// ConditionalDeleteFunc performs a conditional delete (If-Match / ifGenerationMatch)
// using provider-specific APIs.
//
// ETag or Generation can be extracted from attrs and used to construct provider-specific options.
//
// When nil, the backend falls back to CDKBucket.Delete() (unconditional)
type ConditionalDeleteFunc func(ctx context.Context, key string, attrs *blob.Attributes) error

// CDKLockBackendOptions holds optional configuration for CDKLockBackend.
type CDKLockBackendOptions struct {
	ConditionalWrite  ConditionalWriteFunc
	ConditionalDelete ConditionalDeleteFunc
}

// CDKLockBackend implements LockBackend using gocloud.dev/blob with conditional writes.
// Lock expiry is determined from the object's server-side ModTime + TTL.
type CDKLockBackend struct {
	bucket              resource.CDKBucket
	conditionalWriteFn  ConditionalWriteFunc
	conditionalDeleteFn ConditionalDeleteFunc
	log                 log.Logger
	now                 func() time.Time
}

// NewCDKLockBackend creates a new CDKLockBackend.
func NewCDKLockBackend(bucket resource.CDKBucket, opts CDKLockBackendOptions) *CDKLockBackend {
	return &CDKLockBackend{
		bucket:              bucket,
		conditionalWriteFn:  opts.ConditionalWrite,
		conditionalDeleteFn: opts.ConditionalDelete,
		log:                 log.New("cdk-lock-backend"),
		now:                 time.Now,
	}
}

// Create atomically creates a lock if it does not exist.
// If the lock exists but is expired (mtime + TTL < now), it attempts a conditional
// takeover. Returns ErrLockHeld if the lock is live or if another instance wins the
// takeover race.
func (b *CDKLockBackend) Create(ctx context.Context, key string, info LockInfo) error {
	data, err := json.Marshal(info)
	if err != nil {
		return fmt.Errorf("marshal lock info: %w", err)
	}

	// Attempt atomic create (If-None-Match: * / ifGenerationMatch: 0).
	err = b.bucket.WriteAll(ctx, key, data, &blob.WriterOptions{
		ContentType: "application/json",
		IfNotExist:  true,
	})
	if err == nil {
		return nil
	}
	if gcerrors.Code(err) != gcerrors.FailedPrecondition {
		// Check if the error is actually a "not found" style or a real storage error.
		// FailedPrecondition means the object already exists.
		return fmt.Errorf("create lock: %w", err)
	}

	// Lock object exists — check if it's expired.
	return b.tryTakeover(ctx, key, data)
}

// retryCreate retries an atomic create after the lock object disappeared.
// If another instance recreates the lock before this retry, FailedPrecondition
// is mapped to ErrLockHeld so callers see normal contention, not a storage error.
func (b *CDKLockBackend) retryCreate(ctx context.Context, key string, data []byte) error {
	err := b.bucket.WriteAll(ctx, key, data, &blob.WriterOptions{
		ContentType: "application/json",
		IfNotExist:  true,
	})
	if err != nil && gcerrors.Code(err) == gcerrors.FailedPrecondition {
		return ErrLockHeld
	}
	return err
}

// tryTakeover reads the existing lock and, if expired, attempts a conditional overwrite.
func (b *CDKLockBackend) tryTakeover(ctx context.Context, key string, newData []byte) error {
	attrs, err := b.bucket.Attributes(ctx, key)
	if err != nil {
		if gcerrors.Code(err) == gcerrors.NotFound {
			// Lock was deleted between our create attempt and this read.
			return b.retryCreate(ctx, key, newData)
		}
		return fmt.Errorf("read lock attributes: %w", err)
	}

	existingData, err := b.bucket.ReadAll(ctx, key)
	if err != nil {
		if gcerrors.Code(err) == gcerrors.NotFound {
			return b.retryCreate(ctx, key, newData)
		}
		return fmt.Errorf("read lock data: %w", err)
	}

	var existing LockInfo
	if err := json.Unmarshal(existingData, &existing); err != nil {
		return fmt.Errorf("unmarshal existing lock: %w", err)
	}

	// Expiry: mtime + TTL.
	expiresAt := attrs.ModTime.Add(existing.TTL)
	if b.now().Before(expiresAt) {
		return ErrLockHeld
	}

	// Lock is expired — attempt conditional overwrite.
	b.log.Info("taking over expired lock", "key", key, "previous_owner", existing.Owner)
	return b.conditionalWrite(ctx, key, newData, attrs)
}

// conditionalWrite performs a write with optional conditional (If-Match) semantics.
func (b *CDKLockBackend) conditionalWrite(ctx context.Context, key string, data []byte, attrs *blob.Attributes) error {
	opts := &blob.WriterOptions{ContentType: "application/json"}
	if b.conditionalWriteFn != nil && attrs != nil {
		opts.BeforeWrite = b.conditionalWriteFn(attrs)
	}
	err := b.bucket.WriteAll(ctx, key, data, opts)
	if err != nil && gcerrors.Code(err) == gcerrors.FailedPrecondition {
		// Another instance modified the lock between our read and write.
		return ErrLockHeld
	}
	return err
}

// Update atomically updates an existing lock, verifying ownership via conditional write.
func (b *CDKLockBackend) Update(ctx context.Context, key string, info LockInfo) error {
	attrs, err := b.bucket.Attributes(ctx, key)
	if err != nil {
		if gcerrors.Code(err) == gcerrors.NotFound {
			return ErrLockNotFound
		}
		return fmt.Errorf("read lock attributes: %w", err)
	}

	existingData, err := b.bucket.ReadAll(ctx, key)
	if err != nil {
		if gcerrors.Code(err) == gcerrors.NotFound {
			return ErrLockNotFound
		}
		return fmt.Errorf("read lock data: %w", err)
	}

	var existing LockInfo
	if err := json.Unmarshal(existingData, &existing); err != nil {
		return fmt.Errorf("unmarshal existing lock: %w", err)
	}
	if existing.Owner != info.Owner {
		return ErrLockHeld
	}

	data, err := json.Marshal(info)
	if err != nil {
		return fmt.Errorf("marshal lock info: %w", err)
	}

	return b.conditionalWrite(ctx, key, data, attrs)
}

// Delete atomically deletes a lock, verifying ownership.
func (b *CDKLockBackend) Delete(ctx context.Context, key string, owner string) error {
	attrs, err := b.bucket.Attributes(ctx, key)
	if err != nil {
		if gcerrors.Code(err) == gcerrors.NotFound {
			return ErrLockNotFound
		}
		return fmt.Errorf("read lock attributes: %w", err)
	}

	existingData, err := b.bucket.ReadAll(ctx, key)
	if err != nil {
		if gcerrors.Code(err) == gcerrors.NotFound {
			return ErrLockNotFound
		}
		return fmt.Errorf("read lock data: %w", err)
	}

	var existing LockInfo
	if err := json.Unmarshal(existingData, &existing); err != nil {
		return fmt.Errorf("unmarshal existing lock: %w", err)
	}
	if existing.Owner != owner {
		return ErrLockHeld
	}

	if b.conditionalDeleteFn != nil {
		err = b.conditionalDeleteFn(ctx, key, attrs)
	} else {
		err = b.bucket.Delete(ctx, key)
	}
	if err != nil {
		// ConditionalDeleteFunc returns native SDK errors (not gcerrors-wrapped),
		// so check wrapped sentinel errors which providers must set.
		if errors.Is(err, ErrPreconditionFailed) || gcerrors.Code(err) == gcerrors.FailedPrecondition {
			return fmt.Errorf("lock was modified during delete: %w", ErrLockHeld)
		}
		if errors.Is(err, ErrLockNotFound) || gcerrors.Code(err) == gcerrors.NotFound {
			return ErrLockNotFound
		}
		return err
	}
	return nil
}

// Read returns the current lock info, or ErrLockNotFound if no lock exists.
func (b *CDKLockBackend) Read(ctx context.Context, key string) (*LockInfo, error) {
	data, err := b.bucket.ReadAll(ctx, key)
	if err != nil {
		if gcerrors.Code(err) == gcerrors.NotFound {
			return nil, ErrLockNotFound
		}
		return nil, fmt.Errorf("read lock data: %w", err)
	}

	var info LockInfo
	if err := json.Unmarshal(data, &info); err != nil {
		return nil, fmt.Errorf("unmarshal lock info: %w", err)
	}
	return &info, nil
}
