package lock

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"regexp"
	"strings"
	"time"

	"gocloud.dev/blob"
	"gocloud.dev/gcerrors"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

var errPreconditionFailed = errors.New("precondition failed")

// maxLockDataSize is the maximum serialized size of a lock object.
// Enforced on both writes (Create/Update) and reads (readLockData).
const maxLockDataSize = 4096

// readLockData downloads and unmarshals the lock object with a size limit,
// preventing oversized objects from consuming excessive memory.
func readLockData(ctx context.Context, bucket resource.CDKBucket, key string) (LockInfo, error) {
	var buf bytes.Buffer
	lw := &resource.LimitedWriter{W: &buf, N: maxLockDataSize}
	if err := bucket.Download(ctx, key, lw, nil); err != nil {
		if errors.Is(err, resource.ErrWriteLimitExceeded) {
			return LockInfo{}, fmt.Errorf("lock data exceeds %d bytes", maxLockDataSize)
		}
		return LockInfo{}, err
	}
	var info LockInfo
	if err := json.Unmarshal(buf.Bytes(), &info); err != nil {
		return LockInfo{}, fmt.Errorf("unmarshal lock info: %w", err)
	}
	return info, nil
}

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
// Implementations must wrap errPreconditionFailed to signal concurrent modification.
//
// When nil, the backend falls back to CDKBucket.Delete() (unconditional)
type ConditionalDeleteFunc func(ctx context.Context, key string, attrs *blob.Attributes) error

// CDKLockBackendOptions holds optional configuration for CDKLockBackend.
type CDKLockBackendOptions struct {
	ConditionalWrite  ConditionalWriteFunc
	ConditionalDelete ConditionalDeleteFunc
	// ClockSkewAllowance is added to TTL when checking lock expiry, accounting for
	// clock skew between the storage service (which sets ModTime) and the local clock.
	// Default: 30s. Larger values make recovery slower but tolerate more skew.
	ClockSkewAllowance time.Duration
}

// CDKLockBackend implements LockBackend using gocloud.dev/blob with conditional writes.
// Lock expiry is determined from the object's server-side ModTime + TTL + clock skew allowance.
type CDKLockBackend struct {
	bucket              resource.CDKBucket
	conditionalWriteFn  ConditionalWriteFunc
	conditionalDeleteFn ConditionalDeleteFunc
	clockSkewAllowance  time.Duration
	log                 log.Logger
	now                 func() time.Time
}

// NewCDKLockBackend creates a new CDKLockBackend.
func NewCDKLockBackend(bucket resource.CDKBucket, opts CDKLockBackendOptions) *CDKLockBackend {
	clockSkew := opts.ClockSkewAllowance
	if clockSkew == 0 {
		clockSkew = 30 * time.Second
	}
	return &CDKLockBackend{
		bucket:              bucket,
		conditionalWriteFn:  opts.ConditionalWrite,
		conditionalDeleteFn: opts.ConditionalDelete,
		clockSkewAllowance:  clockSkew,
		log:                 log.New("cdk-lock-backend"),
		now:                 time.Now,
	}
}

// validObjectKey is a restrictive subset of CDK's safe character set for lock keys.
// See https://github.com/google/go-cloud/blob/v0.45.0/internal/escape/escape.go
var validObjectKey = regexp.MustCompile(`^[a-zA-Z0-9_./-]+$`)

func validateObjectKey(key string) error {
	if !validObjectKey.MatchString(key) || strings.Contains(key, "..") || key[0] == '/' || key[len(key)-1] == '/' {
		return fmt.Errorf("%w: %q", ErrInvalidLockKey, key)
	}
	return nil
}

func (b *CDKLockBackend) validateKey(key string) error {
	return validateObjectKey(key)
}

// Create atomically creates a lock if it does not exist.
// If the lock exists but is expired (mtime + TTL + clockSkewAllowance < now), it attempts a conditional
// takeover. Returns ErrLockHeld if the lock is live or if another instance wins the
// takeover race.
func (b *CDKLockBackend) Create(ctx context.Context, key string, info LockInfo) error {
	if err := b.validateKey(key); err != nil {
		return err
	}
	data, err := json.Marshal(info)
	if err != nil {
		return fmt.Errorf("marshal lock info: %w", err)
	}
	if len(data) > maxLockDataSize {
		return fmt.Errorf("lock data too large: %d bytes (max %d)", len(data), maxLockDataSize)
	}

	// Attempt atomic create (If-None-Match: * / ifGenerationMatch: 0).
	err = b.bucket.WriteAll(ctx, key, data, &blob.WriterOptions{
		ContentType: "application/json",
		IfNotExist:  true,
	})
	if err == nil {
		return nil
	}
	if !isObjectExistsErr(err) {
		return fmt.Errorf("create lock: %w", err)
	}

	// Lock object exists — check if it's expired.
	return b.tryTakeover(ctx, key, data)
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

	existing, err := readLockData(ctx, b.bucket, key)
	if err != nil {
		if gcerrors.Code(err) == gcerrors.NotFound {
			return b.retryCreate(ctx, key, newData)
		}
		return err
	}

	expiresAt := attrs.ModTime.Add(existing.TTL + b.clockSkewAllowance)
	if b.now().Before(expiresAt) {
		return ErrLockHeld
	}

	// Lock is expired — attempt conditional overwrite.
	b.log.Info("taking over expired lock", "key", key, "previous_owner", existing.Owner)
	err = b.conditionalWrite(ctx, key, newData, attrs)
	if errors.Is(err, ErrLockNotFound) {
		// Lock was deleted between our read and conditional write — retry create.
		return b.retryCreate(ctx, key, newData)
	}
	return err
}

// retryCreate retries an atomic create after the lock object disappeared.
// If another instance recreates the lock before this retry, FailedPrecondition
// is mapped to ErrLockHeld so callers see normal contention, not a storage error.
func (b *CDKLockBackend) retryCreate(ctx context.Context, key string, data []byte) error {
	err := b.bucket.WriteAll(ctx, key, data, &blob.WriterOptions{
		ContentType: "application/json",
		IfNotExist:  true,
	})
	if err != nil && isObjectExistsErr(err) {
		return ErrLockHeld
	}
	return err
}

// conditionalWrite performs a write with optional conditional (If-Match) semantics.
func (b *CDKLockBackend) conditionalWrite(ctx context.Context, key string, data []byte, attrs *blob.Attributes) error {
	opts := &blob.WriterOptions{ContentType: "application/json"}
	if b.conditionalWriteFn != nil && attrs != nil {
		opts.BeforeWrite = b.conditionalWriteFn(attrs)
	}
	err := b.bucket.WriteAll(ctx, key, data, opts)
	if err != nil {
		if isObjectExistsErr(err) {
			// Another instance modified the lock between our read and write.
			return ErrLockHeld
		}
		if gcerrors.Code(err) == gcerrors.NotFound {
			// Lock object was deleted between Attributes/ReadAll and this write.
			return ErrLockNotFound
		}
	}
	return err
}

// Update atomically updates an existing lock, verifying ownership via conditional write.
func (b *CDKLockBackend) Update(ctx context.Context, key string, info LockInfo) error {
	if err := b.validateKey(key); err != nil {
		return err
	}
	attrs, err := b.bucket.Attributes(ctx, key)
	if err != nil {
		if gcerrors.Code(err) == gcerrors.NotFound {
			return ErrLockNotFound
		}
		return fmt.Errorf("read lock attributes: %w", err)
	}

	existing, err := readLockData(ctx, b.bucket, key)
	if err != nil {
		if gcerrors.Code(err) == gcerrors.NotFound {
			return ErrLockNotFound
		}
		return err
	}
	if existing.Owner != info.Owner {
		return ErrLockHeld
	}

	// No clockSkewAllowance: holder should detect expiry before a takeover node does.
	if b.now().After(attrs.ModTime.Add(existing.TTL)) {
		return ErrLeaseExpired
	}

	data, err := json.Marshal(info)
	if err != nil {
		return fmt.Errorf("marshal lock info: %w", err)
	}
	if len(data) > maxLockDataSize {
		return fmt.Errorf("lock data too large: %d bytes (max %d)", len(data), maxLockDataSize)
	}

	return b.conditionalWrite(ctx, key, data, attrs)
}

// Delete atomically deletes a lock, verifying ownership.
func (b *CDKLockBackend) Delete(ctx context.Context, key string, owner string) error {
	if err := b.validateKey(key); err != nil {
		return err
	}
	attrs, err := b.bucket.Attributes(ctx, key)
	if err != nil {
		if gcerrors.Code(err) == gcerrors.NotFound {
			return ErrLockNotFound
		}
		return fmt.Errorf("read lock attributes: %w", err)
	}

	existing, err := readLockData(ctx, b.bucket, key)
	if err != nil {
		if gcerrors.Code(err) == gcerrors.NotFound {
			return ErrLockNotFound
		}
		return err
	}
	if existing.Owner != owner {
		return ErrLockHeld
	}

	if b.conditionalDeleteFn != nil {
		err = b.conditionalDeleteFn(ctx, key, attrs)
	} else {
		err = b.bucket.Delete(ctx, key)
		if err != nil && gcerrors.Code(err) == gcerrors.NotFound {
			return ErrLockNotFound
		}
	}
	if err != nil {
		if errors.Is(err, errPreconditionFailed) || gcerrors.Code(err) == gcerrors.FailedPrecondition {
			return fmt.Errorf("lock was modified during delete: %w", ErrLockHeld)
		}
		return err
	}
	return nil
}

// Read returns the current lock info, or ErrLockNotFound if no lock exists.
func (b *CDKLockBackend) Read(ctx context.Context, key string) (*LockInfo, error) {
	if err := b.validateKey(key); err != nil {
		return nil, err
	}
	info, err := readLockData(ctx, b.bucket, key)
	if err != nil {
		if gcerrors.Code(err) == gcerrors.NotFound {
			return nil, ErrLockNotFound
		}
		return nil, err
	}
	return &info, nil
}
