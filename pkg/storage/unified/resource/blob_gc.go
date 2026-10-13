package resource

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/storage/unified/resource/kv"
)

// BlobGarbageCollector tracks orphan observations without changing the deployed KV contract.
// A restart resets the grace period rather than risking collection of an in-flight upload.
// Collect must be called serially.
type BlobGarbageCollector struct {
	store     kv.KV
	orphans   map[string]time.Time
	batchSize int
	batchWait time.Duration
}

func NewBlobGarbageCollector(store kv.KV, batchSize int, batchWait time.Duration) *BlobGarbageCollector {
	if batchSize <= 0 {
		batchSize = 100
	}
	return &BlobGarbageCollector{store: store, orphans: make(map[string]time.Time), batchSize: batchSize, batchWait: batchWait}
}

// Collect preserves blobs referenced by any retained revision, including trash.
// referenced must fail closed on storage or decoding errors. Grace must be positive.
func (g *BlobGarbageCollector) Collect(ctx context.Context, now time.Time, grace time.Duration, dryRun bool, referenced func(context.Context, kv.BlobKey) (bool, error)) (int, error) {
	if grace <= 0 {
		return 0, fmt.Errorf("blob GC grace period must be positive")
	}
	seen := make(map[string]struct{})
	count := 0
	processed := 0
	var errs []error
	for key, err := range g.store.Keys(ctx, kv.BlobDataSection, kv.ListOptions{}) {
		if err != nil {
			return count, errors.Join(append(errs, err)...)
		}
		if err := ctx.Err(); err != nil {
			return count, err
		}
		if processed > 0 && processed%g.batchSize == 0 && g.batchWait > 0 {
			timer := time.NewTimer(g.batchWait)
			select {
			case <-ctx.Done():
				timer.Stop()
				return count, ctx.Err()
			case <-timer.C:
			}
		}
		processed++
		seen[key] = struct{}{}
		bk, err := kv.ParseBlobKey(key)
		if err != nil {
			errs = append(errs, err)
			continue
		}
		live, err := referenced(ctx, bk)
		if err != nil {
			delete(g.orphans, key)
			errs = append(errs, err)
			continue
		}
		if live {
			delete(g.orphans, key)
			continue
		}
		first, ok := g.orphans[key]
		if !ok {
			g.orphans[key] = now
			continue
		}
		if now.Sub(first) < grace {
			continue
		}
		if !dryRun {
			if err := g.store.Delete(ctx, kv.BlobDataSection, key); err != nil {
				errs = append(errs, err)
				continue
			}
			delete(g.orphans, key)
		}
		count++
	}
	for key := range g.orphans {
		if _, ok := seen[key]; !ok {
			delete(g.orphans, key)
		}
	}
	return count, errors.Join(errs...)
}

// ResourceReferencesBlob understands both blob reference representations served by GetBlob.
func ResourceReferencesBlob(value []byte, uid string) (bool, error) {
	var obj struct {
		Metadata struct {
			Annotations map[string]string `json:"annotations"`
		} `json:"metadata"`
		Blobs map[string]BlobReference `json:"blobs"`
	}
	if err := json.Unmarshal(value, &obj); err != nil {
		return false, err
	}
	for _, ref := range obj.Blobs {
		if ref.UID == uid {
			return true, nil
		}
	}
	info := utils.ParseBlobInfo(obj.Metadata.Annotations[utils.AnnoKeyBlob])
	return info != nil && info.UID == uid, nil
}

func (b *kvStorageBackend) blobReferenced(ctx context.Context, blob kv.BlobKey) (bool, error) {
	key := ListRequestKey{Group: blob.Group, Resource: blob.Resource, Namespace: blob.Namespace, Name: blob.Name}
	for dk, err := range b.dataStore.Keys(ctx, key, SortOrderAsc) {
		if err != nil {
			return false, err
		}
		reader, err := b.dataStore.Get(ctx, dk)
		if err != nil {
			return false, err
		}
		value, err := readAndClose(reader)
		if err != nil {
			return false, err
		}
		live, err := ResourceReferencesBlob(value, blob.UID)
		if err != nil || live {
			return live, err
		}
	}
	return false, nil
}
