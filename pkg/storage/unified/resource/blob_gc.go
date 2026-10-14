package resource

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"iter"
	"time"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/storage/unified/resource/kv"
)

// BlobGarbageCollector scans blobs without retaining the keys of referenced blobs.
// Collect must be called serially.
type BlobGarbageCollector struct {
	store     BlobGCStore
	batchSize int
	batchWait time.Duration
}

type BlobGCStore interface {
	Keys(context.Context, string, kv.ListOptions) iter.Seq2[string, error]
	Delete(context.Context, string, string) error
}

type blobGCAgeStore interface {
	BlobGCStore
	FirstUnused(context.Context, string, time.Time) (time.Time, error)
	ClearUnused(context.Context, string) error
}

var (
	_ blobGCAgeStore = (*CDKBlobGCStore)(nil)
	_ blobGCAgeStore = (*kv.SqlKV)(nil)
)

func NewBlobGarbageCollector(store BlobGCStore, batchSize int, batchWait time.Duration) *BlobGarbageCollector {
	if batchSize <= 0 {
		batchSize = 100
	}
	return &BlobGarbageCollector{store: store, batchSize: batchSize, batchWait: batchWait}
}

// Collect preserves blobs referenced by any retained revision, including trash.
// referenced must fail closed on storage or decoding errors. Grace must be positive.
func (g *BlobGarbageCollector) Collect(ctx context.Context, now time.Time, grace time.Duration, dryRun bool, referenced func(context.Context, kv.BlobKey) (bool, error)) (int, error) {
	if grace <= 0 {
		return 0, fmt.Errorf("blob GC grace period must be positive")
	}
	// SQL and bucket stores use upload time; Badger persists the first unused observation.
	ages, ok := g.store.(blobGCAgeStore)
	if !ok {
		return 0, fmt.Errorf("blob GC store does not support durable age tracking")
	}
	keys := g.store.Keys(ctx, kv.BlobDataSection, kv.ListOptions{})
	if store, ok := g.store.(kv.KV); ok {
		keys = pagedKeys(ctx, store, kv.BlobDataSection, kv.ListOptions{}, g.batchSize)
	}
	count := 0
	processed := 0
	var errs []error
	for key, err := range keys {
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
		bk, err := kv.ParseBlobKey(key)
		if err != nil {
			errs = append(errs, err)
			continue
		}
		// Provisioning preview images are referenced by PR comment URLs, not by
		// resource revisions. Their lifetime cannot be inferred from history.
		// TODO: Replace this exemption with durable URL-reference tracking and a
		// retention plan for previews already published in PR comments.
		if bk.Group == "provisioning.grafana.app" && bk.Resource == "repositories" {
			continue
		}
		live, err := referenced(ctx, bk)
		if err != nil {
			errs = append(errs, err)
			continue
		}
		if live {
			if err := ages.ClearUnused(ctx, key); err != nil {
				errs = append(errs, err)
			}
			continue
		}
		first, err := ages.FirstUnused(ctx, key, now)
		if err != nil {
			errs = append(errs, err)
			continue
		}
		if first.IsZero() || now.Sub(first) < grace {
			continue
		}
		if !dryRun {
			if err := g.store.Delete(ctx, kv.BlobDataSection, key); err != nil {
				errs = append(errs, err)
				continue
			}
			if err := ages.ClearUnused(ctx, key); err != nil {
				errs = append(errs, err)
			}
		}
		count++
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
