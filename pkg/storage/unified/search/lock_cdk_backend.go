package search

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

// cdkLockBackend implements LockBackend using gocloud.dev/blob with conditional writes.
// Lock expiry is determined from the object's server-side ModTime + TTL + clock skew allowance.
type cdkLockBackend struct {
	bucket             resource.CDKBucket
	ops                conditionalOps
	clockSkewAllowance time.Duration
	log                log.Logger
	now                func() time.Time
}

// newCDKLockBackend creates a new cdkLockBackend.
func newCDKLockBackend(bucket resource.CDKBucket, opts cdkLockBackendOptions) *cdkLockBackend {
	clockSkew := opts.clockSkewAllowance
	if clockSkew == 0 {
		clockSkew = 30 * time.Second
	}
	return &cdkLockBackend{
		bucket:             bucket,
		ops:                opts.ops,
		clockSkewAllowance: clockSkew,
		log:                log.New("cdk-lock-backend"),
		now:                time.Now,
	}
}

// Create atomically creates a lock if it does not exist.
// If the lock exists but is expired (mtime + TTL + clockSkewAllowance < now), it attempts a conditional
// takeover. Returns errLockHeld if the lock is live or if another instance wins the
// takeover race.
func (b *cdkLockBackend) Create(ctx context.Context, key string, info lockInfo) error {
	data, err := marshalLockInfo(info)
	if err != nil {
		return err
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

	createIfNotExists := func() error {
		err := b.bucket.WriteAll(ctx, key, data, &blob.WriterOptions{
			ContentType: "application/json",
			IfNotExist:  true,
		})
		if err != nil && isObjectExistsErr(err) {
			return errLockHeld
		}
		return err
	}

	// Lock object exists — check if it's expired and attempt takeover.
	attrs, existing, err := b.fetchAttrsAndData(ctx, key)
	if errors.Is(err, errLockNotFound) {
		return createIfNotExists()
	}
	if err != nil {
		return err
	}

	expiresAt := attrs.ModTime.Add(existing.TTL + b.clockSkewAllowance)
	if b.now().Before(expiresAt) {
		return errLockHeld
	}

	// The local expiry check is a best-effort optimization: attrs and existing
	// may be from different generations if the object was replaced between the
	// two reads. Correctness is enforced by IfMatch=attrs.ETag on the conditional
	// write below — a generation mismatch will be rejected as errLockHeld.
	b.log.Info("taking over expired lock", "key", key, "previous_owner", existing.Owner)
	err = b.conditionalWrite(ctx, key, data, attrs)
	if errors.Is(err, errLockNotFound) {
		return createIfNotExists()
	}
	return err
}

// conditionalWrite writes with If-Match semantics via the provider's ops.
func (b *cdkLockBackend) conditionalWrite(ctx context.Context, key string, data []byte, attrs *blob.Attributes) error {
	opts := &blob.WriterOptions{
		ContentType: "application/json",
		BeforeWrite: b.ops.BeforeWrite(attrs),
	}
	err := b.bucket.WriteAll(ctx, key, data, opts)
	if err != nil {
		if isObjectExistsErr(err) {
			// Another instance modified the lock between our read and write.
			return errLockHeld
		}
		if gcerrors.Code(err) == gcerrors.NotFound {
			// Lock object was deleted between Attributes/ReadAll and this write.
			return errLockNotFound
		}
	}
	return err
}

// Update atomically updates an existing lock, verifying ownership via conditional write.
func (b *cdkLockBackend) Update(ctx context.Context, key string, info lockInfo) error {
	attrs, existing, err := b.fetchAttrsAndData(ctx, key)
	if err != nil {
		return err
	}
	if existing.Owner != info.Owner {
		return errLockHeld
	}

	// No clockSkewAllowance: holder should detect expiry before a takeover node does.
	if !b.now().Before(attrs.ModTime.Add(existing.TTL)) {
		return errLeaseExpired
	}

	data, err := marshalLockInfo(info)
	if err != nil {
		return err
	}

	return b.conditionalWrite(ctx, key, data, attrs)
}

// Delete atomically deletes a lock, verifying ownership.
func (b *cdkLockBackend) Delete(ctx context.Context, key string, owner string) error {
	attrs, existing, err := b.fetchAttrsAndData(ctx, key)
	if err != nil {
		return err
	}
	if existing.Owner != owner {
		return errLockHeld
	}

	if err := b.ops.Delete(ctx, key, attrs); err != nil {
		if errors.Is(err, errPreconditionFailed) || gcerrors.Code(err) == gcerrors.FailedPrecondition {
			return fmt.Errorf("lock was modified during delete: %w", errLockHeld)
		}
		return err
	}
	return nil
}

// Read returns the current lock info, or errLockNotFound if no lock exists.
func (b *cdkLockBackend) Read(ctx context.Context, key string) (*lockInfo, error) {
	info, err := readLockData(ctx, b.bucket, key)
	if err != nil {
		if gcerrors.Code(err) == gcerrors.NotFound {
			return nil, errLockNotFound
		}
		return nil, err
	}
	return &info, nil
}

// validObjectKey is a restrictive subset of CDK's safe character set for lock keys.
// See https://github.com/google/go-cloud/blob/v0.45.0/internal/escape/escape.go
var validObjectKey = regexp.MustCompile(`^[a-zA-Z0-9_./-]+$`)

func validatePrefix(prefix string) error {
	if prefix == "" {
		return nil
	}
	if prefix[len(prefix)-1] != '/' {
		return fmt.Errorf("%w: prefix must end with '/'", errInvalidLockKey)
	}
	return validateObjectKey(prefix + "probe")
}

func validateObjectKey(key string) error {
	if len(key) == 0 || !validObjectKey.MatchString(key) || strings.Contains(key, "..") || key[0] == '/' || key[len(key)-1] == '/' {
		return fmt.Errorf("%w: %q", errInvalidLockKey, key)
	}
	return nil
}

// fetchAttrsAndData reads the lock object's attributes and deserialized contents.
// Returns errLockNotFound if the object is missing at either step.
func (b *cdkLockBackend) fetchAttrsAndData(ctx context.Context, key string) (*blob.Attributes, lockInfo, error) {
	attrs, err := b.bucket.Attributes(ctx, key)
	if err != nil {
		if gcerrors.Code(err) == gcerrors.NotFound {
			return nil, lockInfo{}, errLockNotFound
		}
		return nil, lockInfo{}, fmt.Errorf("read lock attributes: %w", err)
	}
	info, err := readLockData(ctx, b.bucket, key)
	if err != nil {
		if gcerrors.Code(err) == gcerrors.NotFound {
			return nil, lockInfo{}, errLockNotFound
		}
		return nil, lockInfo{}, err
	}
	return attrs, info, nil
}

// maxLockDataSize is the maximum serialized size of a lock object.
const maxLockDataSize = 4096

// marshalLockInfo serializes lockInfo to JSON, enforcing the maxLockDataSize cap.
func marshalLockInfo(info lockInfo) ([]byte, error) {
	data, err := json.Marshal(info)
	if err != nil {
		return nil, fmt.Errorf("marshal lock info: %w", err)
	}
	if len(data) > maxLockDataSize {
		return nil, fmt.Errorf("lock data too large: %d bytes (max %d)", len(data), maxLockDataSize)
	}
	return data, nil
}

// readLockData downloads and unmarshals the lock object with maxLockDataSize size limit
func readLockData(ctx context.Context, bucket resource.CDKBucket, key string) (lockInfo, error) {
	var buf bytes.Buffer
	lw := &resource.LimitedWriter{W: &buf, N: maxLockDataSize}
	if err := bucket.Download(ctx, key, lw, nil); err != nil {
		if errors.Is(err, resource.ErrWriteLimitExceeded) {
			return lockInfo{}, fmt.Errorf("lock data exceeds %d bytes", maxLockDataSize)
		}
		return lockInfo{}, err
	}
	var info lockInfo
	if err := json.Unmarshal(buf.Bytes(), &info); err != nil {
		return lockInfo{}, fmt.Errorf("unmarshal lock info: %w", err)
	}
	return info, nil
}
