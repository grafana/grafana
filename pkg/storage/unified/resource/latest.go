package resource

import (
	"context"
	"errors"
	"fmt"
	"slices"
	"strings"

	kvpkg "github.com/grafana/grafana/pkg/storage/unified/resource/kv"
)

// latestSection holds one row per resource naming its latest version in the
// data section, deletions included. It is only maintained with
// WriteCoordinationLatest.
const latestSection = kvpkg.LatestSection

// latestVersion is a resource's row in latestSection.
//
// Every write compares and swaps the row in the same batch as the data it
// writes (see latestWriteOps), so of two writes that read the same row only
// one commits, however long either takes. That only holds while every path
// that changes a resource's latest version also updates its row.
type latestVersion struct {
	// value is the row as read, nil when the resource has none.
	value []byte
	// key is the data key the row names, zero when value is nil.
	key DataKey
}

// found reports whether the resource has a version, possibly a deletion.
func (l latestVersion) found() bool {
	return l.value != nil
}

// live reports whether the resource exists, that is, its latest version is not
// a deletion.
func (l latestVersion) live() bool {
	return l.found() && l.key.Action != DataActionDeleted
}

func latestKey(key GetRequestKey) string {
	return strings.TrimSuffix(key.Prefix(), "/")
}

func latestKeyOf(key DataKey) string {
	return latestKey(GetRequestKey{Group: key.Group, Resource: key.Resource, Namespace: key.Namespace, Name: key.Name})
}

// encodeLatestVersion returns the row naming key: the part of its data key
// after the resource's prefix.
func encodeLatestVersion(key DataKey) []byte {
	return fmt.Appendf(nil, "%d~%s~%s", key.ResourceVersion, key.Action, key.Folder)
}

// getLatestVersion reads the resource's row in latestSection. Writers must
// read it before anything else that depends on the resource's state, so a
// write committing in between makes theirs fail rather than go unnoticed.
func (d *dataStore) getLatestVersion(ctx context.Context, key GetRequestKey) (latestVersion, error) {
	if err := key.Validate(); err != nil {
		return latestVersion{}, fmt.Errorf("invalid get request key: %w", err)
	}
	ctx, span := tracer.Start(ctx, "resource.dataStore.getLatestVersion")
	defer span.End()

	r, err := d.kv.Get(ctx, latestSection, latestKey(key))
	if errors.Is(err, ErrNotFound) {
		return latestVersion{}, nil
	}
	if err != nil {
		return latestVersion{}, fmt.Errorf("failed to read latest version: %w", err)
	}
	value, err := kvpkg.ReadAllAndClose(r)
	if err != nil {
		return latestVersion{}, fmt.Errorf("failed to read latest version: %w", err)
	}
	dataKey, err := ParseKey(latestKey(key) + "/" + string(value))
	if err != nil {
		return latestVersion{}, fmt.Errorf("invalid latest version %q: %w", value, err)
	}
	return latestVersion{value: value, key: dataKey}, nil
}

// latestWriteOps returns the batch operations that write value at key if the
// resource's latest version is still read: they swap its row for one naming
// key, creating it when none was read. They are returned rather than run so
// the caller decides the batch.
func (d *dataStore) latestWriteOps(key DataKey, read latestVersion, value []byte) ([]kvpkg.BatchOp, error) {
	if err := validateDataKey(key); err != nil {
		return nil, fmt.Errorf("invalid data key: %w", err)
	}
	// On SQLite the conditional operation must come first; see SqlKV.Batch.
	latest := kvpkg.BatchOp{
		Section:  latestSection,
		Mode:     kvpkg.BatchOpCompareAndSwap,
		Key:      latestKeyOf(key),
		Value:    encodeLatestVersion(key),
		Expected: read.value,
	}
	if !read.found() {
		latest.Mode = kvpkg.BatchOpCreate
	}
	data := kvpkg.BatchOp{Section: dataSection, Mode: kvpkg.BatchOpPut, Key: key.String(), Value: value}
	return []kvpkg.BatchOp{latest, data}, nil
}

// isLatestConflict reports whether a batch from latestWriteOps failed because
// another write changed the resource's latest version after it was read.
func isLatestConflict(err error) bool {
	var batchErr *kvpkg.BatchError
	if !errors.As(err, &batchErr) || batchErr.Op.Section != latestSection {
		return false
	}
	return errors.Is(err, kvpkg.ErrCompareAndSwapFailed) ||
		errors.Is(err, kvpkg.ErrKeyAlreadyExists) ||
		errors.Is(err, kvpkg.ErrNotFound)
}

// setLatestVersions makes keys the latest versions of their resources,
// whatever their rows held. Only for paths that own the resources, such as a
// bulk import replacing its collection: a write committing to one of them
// concurrently can be overwritten.
func (d *dataStore) setLatestVersions(ctx context.Context, keys []DataKey) error {
	ctx, span := tracer.Start(ctx, "resource.dataStore.setLatestVersions")
	defer span.End()

	for _, key := range keys {
		w, err := d.kv.Save(ctx, latestSection, latestKeyOf(key))
		if err != nil {
			return fmt.Errorf("failed to save latest version: %w", err)
		}
		if _, err := w.Write(encodeLatestVersion(key)); err != nil {
			_ = w.Close()
			return fmt.Errorf("failed to save latest version: %w", err)
		}
		if err := w.Close(); err != nil {
			return fmt.Errorf("failed to save latest version: %w", err)
		}
	}
	return nil
}

// deleteLatestVersionIf deletes the resource's row if it still names key, so a
// write that made another version latest in the meantime keeps its row.
func (d *dataStore) deleteLatestVersionIf(ctx context.Context, key DataKey) error {
	row := encodeLatestVersion(key)
	// Swapping the row for itself fails, and rolls back the delete, unless it
	// still names key.
	err := d.kv.Batch(ctx, latestSection, []kvpkg.BatchOp{
		{Mode: kvpkg.BatchOpCompareAndSwap, Key: latestKeyOf(key), Expected: row, Value: row},
		{Mode: kvpkg.BatchOpDelete, Key: latestKeyOf(key)},
	})
	if err == nil || errors.Is(err, kvpkg.ErrCompareAndSwapFailed) || errors.Is(err, kvpkg.ErrNotFound) {
		return nil
	}
	return fmt.Errorf("failed to delete latest version: %w", err)
}

// deleteLatestVersions deletes the rows of every resource under key, whatever
// they hold, and returns how many it deleted.
func (d *dataStore) deleteLatestVersions(ctx context.Context, key ListRequestKey) (int, error) {
	ctx, span := tracer.Start(ctx, "resource.dataStore.deleteLatestVersions")
	defer span.End()

	prefix := key.Prefix()
	var keys []string
	for k, err := range pagedKeys(ctx, d.kv, latestSection, ListOptions{
		StartKey: prefix,
		EndKey:   PrefixRangeEnd(prefix),
	}, keyPageSize) {
		if err != nil {
			return 0, fmt.Errorf("failed to list latest versions: %w", err)
		}
		keys = append(keys, k)
	}
	for batch := range slices.Chunk(keys, dataBatchSize) {
		if err := d.kv.BatchDelete(ctx, latestSection, batch); err != nil {
			return 0, fmt.Errorf("failed to delete latest versions: %w", err)
		}
	}
	return len(keys), nil
}
