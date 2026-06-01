package search

import (
	"cmp"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math"
	"os"
	"path/filepath"
	"slices"
	"time"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

const (
	openIndexListFileName = "open-indexes.json"

	// openIndexListWriteInterval controls how often we refresh the best-effort startup hint between graceful shutdowns.
	openIndexListWriteInterval = 15 * time.Minute
)

type openIndexListFile struct {
	// WrittenAt is formatted as time.RFC3339Nano.
	WrittenAt string `json:"writtenAt"`
	// Indexes contains one entry for each open index with at least one document.
	Indexes []openIndexListEntry `json:"indexes"`
}

type openIndexListEntry struct {
	Namespace string `json:"namespace"`
	Group     string `json:"group"`
	Resource  string `json:"resource"`
	DocCount  int64  `json:"docCount"`
}

func (b *bleveBackend) LoadOpenIndexStats(now time.Time, maxAge time.Duration) ([]resource.ResourceStats, error) {
	path := filepath.Join(b.opts.Root, openIndexListFileName)
	file, err := os.Open(path)
	if errors.Is(err, os.ErrNotExist) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	defer func() {
		if closeErr := file.Close(); closeErr != nil {
			b.log.Warn("failed to close open index list", "path", path, "err", closeErr)
		}
	}()

	return readOpenIndexList(file, now, maxAge)
}

// readOpenIndexList validates an open index list and returns why it should not be trusted.
func readOpenIndexList(reader io.Reader, now time.Time, maxAge time.Duration) ([]resource.ResourceStats, error) {
	var list openIndexListFile
	if err := json.NewDecoder(reader).Decode(&list); err != nil {
		return nil, fmt.Errorf("invalid open index list JSON: %w", err)
	}
	if err := validateOpenIndexListTimestamp(list.WrittenAt, now, maxAge); err != nil {
		return nil, err
	}
	if len(list.Indexes) == 0 {
		return nil, fmt.Errorf("open index list has no indexes")
	}

	stats := make([]resource.ResourceStats, 0, len(list.Indexes))
	seen := map[resource.NamespacedResource]bool{}
	for i, entry := range list.Indexes {
		stat, ok := openIndexListStat(entry)
		if !ok {
			return nil, fmt.Errorf("invalid index entry at position %d", i)
		}
		if seen[stat.NamespacedResource] {
			return nil, fmt.Errorf("duplicate index entry for %s", stat.NamespacedResource.String())
		}
		seen[stat.NamespacedResource] = true
		stats = append(stats, stat)
	}
	return stats, nil
}

func validateOpenIndexListTimestamp(writtenAtValue string, now time.Time, maxAge time.Duration) error {
	if writtenAtValue == "" {
		return fmt.Errorf("open index list is missing writtenAt")
	}
	writtenAt, err := time.Parse(time.RFC3339Nano, writtenAtValue)
	if err != nil {
		return fmt.Errorf("invalid open index list writtenAt: %w", err)
	}
	if writtenAt.After(now) {
		return fmt.Errorf("open index list writtenAt is in the future")
	}
	if maxAge > 0 && now.Sub(writtenAt) > maxAge {
		return fmt.Errorf("open index list is stale")
	}
	return nil
}

func openIndexListStat(entry openIndexListEntry) (resource.ResourceStats, bool) {
	if entry.Namespace == "" || entry.Group == "" || entry.Resource == "" || entry.DocCount <= 0 {
		return resource.ResourceStats{}, false
	}
	return resource.ResourceStats{
		NamespacedResource: resource.NamespacedResource{
			Namespace: entry.Namespace,
			Group:     entry.Group,
			Resource:  entry.Resource,
		},
		Count: entry.DocCount,
	}, true
}

func (b *bleveBackend) WriteOpenIndexStats(now time.Time) error {
	if err := os.MkdirAll(b.opts.Root, 0o750); err != nil {
		return err
	}

	keys := b.GetOpenIndexes()
	slices.SortFunc(keys, compareNamespacedResource)

	indexes := make([]openIndexListEntry, 0, len(keys))
	for _, key := range keys {
		idx := b.peekCachedIndex(key)
		if idx == nil {
			continue
		}

		docCount, err := idx.index.DocCount()
		if err != nil {
			b.log.Debug("skipping index in open index stats because document count is unavailable", "key", key, "err", err)
			continue
		}

		if docCount == 0 {
			continue
		}
		if docCount > math.MaxInt64 {
			b.log.Debug("skipping index in open index stats because document count is too large", "key", key, "docCount", docCount)
			continue
		}

		indexes = append(indexes, openIndexListEntry{
			Namespace: key.Namespace,
			Group:     key.Group,
			Resource:  key.Resource,
			DocCount:  int64(docCount),
		})
	}

	path := filepath.Join(b.opts.Root, openIndexListFileName)

	// If no currently-open index has documents, remove any previous open index list so startup falls back to storage stats.
	if len(indexes) == 0 {
		if err := os.Remove(path); err != nil && !errors.Is(err, os.ErrNotExist) {
			return err
		}
		return nil
	}

	contents, err := json.Marshal(openIndexListFile{
		WrittenAt: now.UTC().Format(time.RFC3339Nano),
		Indexes:   indexes,
	})
	if err != nil {
		return err
	}
	contents = append(contents, '\n')

	// Disk cleanup only removes resource subdirectories, so root-level open index list files are not candidates.
	tmp, err := os.CreateTemp(b.opts.Root, ".open-indexes-*.tmp")
	if err != nil {
		return err
	}
	tmpName := tmp.Name()
	closed := false
	deleteTmpFile := true
	defer func() {
		if !closed {
			_ = tmp.Close()
		}
		if deleteTmpFile {
			_ = os.Remove(tmpName)
		}
	}()

	if _, err := tmp.Write(contents); err != nil {
		return err
	}
	if err := tmp.Close(); err != nil {
		return err
	}
	closed = true

	if err := os.Rename(tmpName, path); err != nil {
		return err
	}
	deleteTmpFile = false

	return nil
}

func compareNamespacedResource(a, b resource.NamespacedResource) int {
	if c := cmp.Compare(a.Namespace, b.Namespace); c != 0 {
		return c
	}
	if c := cmp.Compare(a.Group, b.Group); c != 0 {
		return c
	}
	return cmp.Compare(a.Resource, b.Resource)
}

func (b *bleveBackend) writeOpenIndexListPeriodically(ctx context.Context) {
	defer b.bgTasksWg.Done()

	ticker := time.NewTicker(openIndexListWriteInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case now := <-ticker.C:
			if err := b.WriteOpenIndexStats(now); err != nil {
				b.log.Warn("failed to write open index stats", "err", err)
			}
		}
	}
}
