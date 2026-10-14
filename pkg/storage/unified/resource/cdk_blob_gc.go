package resource

import (
	"context"
	"errors"
	"fmt"
	"io"
	"iter"
	"strings"
	"time"

	"gocloud.dev/blob"

	"github.com/grafana/grafana/pkg/storage/unified/resource/kv"
)

// CDKBlobGCStore enumerates the objects written by cdkBlobSupport.
type CDKBlobGCStore struct {
	bucket  CDKBucket
	root    string
	key     string
	path    string
	modTime time.Time
}

func NewCDKBlobGCStore(bucket CDKBucket, root string) *CDKBlobGCStore {
	return &CDKBlobGCStore{bucket: bucket, root: root}
}

func (s *CDKBlobGCStore) Keys(ctx context.Context, section string, _ kv.ListOptions) iter.Seq2[string, error] {
	return func(yield func(string, error) bool) {
		if section != kv.BlobDataSection {
			yield("", fmt.Errorf("unsupported blob GC section %q", section))
			return
		}
		it := s.bucket.List(&blob.ListOptions{Prefix: s.root})
		for {
			obj, err := it.Next(ctx)
			if err != nil {
				if !errors.Is(err, io.EOF) {
					yield("", err)
				}
				return
			}
			if obj.IsDir || !strings.HasPrefix(obj.Key, s.root) {
				continue
			}
			path := strings.TrimPrefix(obj.Key, s.root)
			parts := strings.Split(path, "/")
			if len(parts) != 5 && len(parts) != 4 {
				continue
			}
			uid := parts[len(parts)-1]
			if dot := strings.IndexByte(uid, '.'); dot >= 0 {
				uid = uid[:dot]
			}
			if len(parts) == 5 {
				parts = []string{parts[1], parts[2], parts[0], parts[3], uid}
			} else {
				parts = []string{parts[0], parts[1], "", parts[2], uid}
			}
			key := strings.Join(parts, "/")
			if _, err := kv.ParseBlobKey(key); err != nil {
				continue
			}
			s.key, s.path, s.modTime = key, obj.Key, obj.ModTime
			if !yield(key, nil) {
				return
			}
		}
	}
}

func (s *CDKBlobGCStore) Delete(ctx context.Context, section, key string) error {
	if section != kv.BlobDataSection {
		return fmt.Errorf("unsupported blob GC section %q", section)
	}
	if key != s.key {
		return fmt.Errorf("blob GC path not found for %q", key)
	}
	return s.bucket.Delete(ctx, s.path)
}

func (s *CDKBlobGCStore) FirstUnused(_ context.Context, key string, _ time.Time) (time.Time, error) {
	if key != s.key {
		return time.Time{}, fmt.Errorf("blob GC path not found for %q", key)
	}
	return s.modTime, nil
}

func (s *CDKBlobGCStore) ClearUnused(context.Context, string) error { return nil }
