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

	skippedWithoutAge int // blobs of the last Collect with no usable age
}

type BlobGCStore interface {
	Keys(context.Context, string, kv.ListOptions) iter.Seq2[string, error]
	Delete(context.Context, string, string) error
}

type blobGCAges interface {
	FirstUnused(context.Context, string, time.Time) (time.Time, error)
}

type blobGCAgeStore interface {
	BlobGCStore
	blobGCAges
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

// SkippedWithoutAge reports how many unreferenced blobs the last Collect left
// alone because no upload time could be determined for them (legacy UIDs on
// stores without their own age tracking).
func (g *BlobGarbageCollector) SkippedWithoutAge() int { return g.skippedWithoutAge }

// Collect preserves blobs referenced by any retained revision, including trash.
// referenced must fail closed on storage or decoding errors. Grace must be positive.
func (g *BlobGarbageCollector) Collect(ctx context.Context, now time.Time, grace time.Duration, dryRun bool, referenced func(context.Context, kv.BlobKey) (bool, error)) (int, error) {
	if grace <= 0 {
		return 0, fmt.Errorf("blob GC grace period must be positive")
	}
	// SQL and bucket stores use upload time; any other KV (e.g. remote) uses the
	// UUIDv7 embedded in the blob UID.
	var ages blobGCAges = blobUIDAges{}
	if store, ok := g.store.(blobGCAgeStore); ok {
		ages = store
	}
	g.skippedWithoutAge = 0
	keys := g.store.Keys(ctx, kv.BlobDataSection, kv.ListOptions{})
	if store, ok := g.store.(interface {
		BlobGCKeys(context.Context, int) iter.Seq2[string, error]
	}); ok {
		keys = store.BlobGCKeys(ctx, g.batchSize)
	}
	count := 0
	processed := 0
	var errs []error
	for key, err := range keys {
		if err != nil {
			return count, errors.Join(append(errs, err)...)
		}
		if err := ctx.Err(); err != nil {
			return count, errors.Join(append(errs, err)...)
		}
		if processed > 0 && processed%g.batchSize == 0 && g.batchWait > 0 {
			timer := time.NewTimer(g.batchWait)
			select {
			case <-ctx.Done():
				timer.Stop()
				return count, errors.Join(append(errs, ctx.Err())...)
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
			continue
		}
		first, err := ages.FirstUnused(ctx, key, now)
		if err != nil {
			errs = append(errs, err)
			continue
		}
		if first.IsZero() {
			g.skippedWithoutAge++
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
		value, err := kv.ReadAllAndClose(reader)
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
