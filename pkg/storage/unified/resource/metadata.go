package resource

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"iter"
	"math"
	"strconv"
	"strings"
)

const (
	metaSection = "unified/meta"
)

// Metadata store stores search documents for resources in unified storage.
// The store keeps track of the latest versions of each resource.
type MetaData struct {
	IndexableDocument
}

type MetaDataKey struct {
	Namespace       string
	Group           string
	Resource        string
	Name            string
	ResourceVersion int64
	Folder          string
	Action          DataAction
}

type MetaDataObj struct {
	Key   MetaDataKey
	Value MetaData
}

type metadataStore struct {
	kv KV
}

func newMetadataStore(kv KV) *metadataStore {
	return &metadataStore{
		kv: kv,
	}
}

func (d *metadataStore) Get(ctx context.Context, key MetaDataKey) (MetaData, error) {
	obj, err := d.kv.Get(ctx, metaSection, d.getKey(key))
	if err != nil {
		return MetaData{}, err
	}
	value, err := io.ReadAll(obj.Value)
	if err != nil {
		return MetaData{}, err
	}
	var meta MetaData
	if err := json.Unmarshal(value, &meta); err != nil {
		return meta, err
	}
	return meta, nil
}

func (d *metadataStore) GetLatest(ctx context.Context, key ListRequestKey) (MetaDataObj, error) {
	return d.GetAtRevision(ctx, key, 0)
}

func (d *metadataStore) GetAtRevision(ctx context.Context, key ListRequestKey, rv int64) (MetaDataObj, error) {
	if rv == 0 {
		rv = math.MaxInt64
	}
	if key.Namespace == "" {
		return MetaDataObj{}, fmt.Errorf("namespace is required")
	}
	if key.Group == "" {
		return MetaDataObj{}, fmt.Errorf("group is required")
	}
	if key.Resource == "" {
		return MetaDataObj{}, fmt.Errorf("resource is required")
	}
	if key.Name == "" {
		return MetaDataObj{}, fmt.Errorf("name is required")
	}
	iter := d.ListAtRevision(ctx, key, rv)
	for obj, err := range iter {
		if err != nil {
			return MetaDataObj{}, err
		}
		return obj, nil
	}
	return MetaDataObj{}, ErrNotFound
}

func (d *metadataStore) ListLatest(ctx context.Context, key ListRequestKey) iter.Seq2[MetaDataObj, error] {
	return d.ListAtRevision(ctx, key, 0)
}

// ListAtRevision lists all metadata objects for a given resource key and resource version.
func (d *metadataStore) ListAtRevision(ctx context.Context, key ListRequestKey, rv int64) iter.Seq2[MetaDataObj, error] {
	if rv == 0 {
		rv = math.MaxInt64
	}
	if key.Group == "" {
		return func(yield func(MetaDataObj, error) bool) {
			yield(MetaDataObj{}, fmt.Errorf("group is required"))
		}
	}
	if key.Resource == "" {
		return func(yield func(MetaDataObj, error) bool) {
			yield(MetaDataObj{}, fmt.Errorf("resource is required"))
		}
	}
	prefix, err := d.getPrefix(key)
	if err != nil {
		return func(yield func(MetaDataObj, error) bool) {
			yield(MetaDataObj{}, err)
		}
	}
	// List all keys in the prefix.
	iter := d.kv.Keys(ctx, metaSection, ListOptions{
		StartKey: prefix,
		EndKey:   PrefixRangeEnd(prefix),
		Sort:     SortOrderAsc,
	})

	return func(yield func(MetaDataObj, error) bool) {
		var candidateKey *MetaDataKey // The current candidate key we are iterating over

		// yieldCandidate is a helper function to yield results.
		// Won't yield if the resource was last deleted.
		yieldCandidate := func(key MetaDataKey) bool {
			if key.Action == DataActionDeleted {
				// Skip because the resource was last deleted.
				return true
			}
			obj, err := d.kv.Get(ctx, metaSection, d.getKey(key))
			if err != nil {
				yield(MetaDataObj{}, err)
				return false
			}
			var meta MetaData
			value, err := io.ReadAll(obj.Value)
			if err != nil {
				yield(MetaDataObj{}, err)
				return false
			}
			if err := json.Unmarshal(value, &meta); err != nil {
				yield(MetaDataObj{}, err)
				return false
			}
			return yield(MetaDataObj{
				Key:   key,
				Value: meta,
			}, nil)
		}

		for key, err := range iter {
			if err != nil {
				yield(MetaDataObj{}, err)
				return
			}

			metaKey, err := d.parseKey(key)
			if err != nil {
				yield(MetaDataObj{}, err)
				return
			}

			if candidateKey == nil {
				// Skip until we have our first candidate
				if metaKey.ResourceVersion <= rv {
					// New candidate found.
					candidateKey = &metaKey
				}
				continue

			}
			// Should yield if either:
			// - We reached the next key.
			// - We reached a resource version greater than the target RV.
			if !keyMatches(metaKey, *candidateKey) || metaKey.ResourceVersion > rv {
				if !yieldCandidate(*candidateKey) {
					return
				}
				// If we moved to a different resource and the current key is valid, make it the new candidate
				if !keyMatches(metaKey, *candidateKey) && metaKey.ResourceVersion <= rv {
					candidateKey = &metaKey
				} else {
					candidateKey = nil
				}
			} else {
				// Update candidate to the current key (same resource, valid version)
				candidateKey = &metaKey
			}
		}
		if candidateKey != nil {
			// Yield the last selected object
			if !yieldCandidate(*candidateKey) {
				return
			}
		}
	}
}

func (d *metadataStore) Save(ctx context.Context, obj MetaDataObj) error {
	valueBytes, err := json.Marshal(obj.Value)
	if err != nil {
		return err
	}
	return d.kv.Save(ctx, metaSection, d.getKey(obj.Key), io.NopCloser(bytes.NewReader(valueBytes)))
}

func (d *metadataStore) getKey(key MetaDataKey) string {
	return fmt.Sprintf("%s/%s/%s/%s/%d~%s~%s", key.Group, key.Resource, key.Namespace, key.Name, key.ResourceVersion, key.Action, key.Folder)
}

func (d *metadataStore) parseKey(key string) (MetaDataKey, error) {
	parts := strings.Split(key, "/")
	if len(parts) != 5 {
		return MetaDataKey{}, fmt.Errorf("invalid key: %s", key)
	}

	rvActionFolderParts := strings.Split(parts[4], "~")
	if len(rvActionFolderParts) != 3 {
		return MetaDataKey{}, fmt.Errorf("invalid key: %s", key)
	}

	rv, err := strconv.ParseInt(rvActionFolderParts[0], 10, 64)
	if err != nil {
		return MetaDataKey{}, fmt.Errorf("invalid resource version '%s' in key %s: %w", rvActionFolderParts[0], key, err)
	}
	return MetaDataKey{
		Namespace:       parts[2],
		Group:           parts[0],
		Resource:        parts[1],
		Name:            parts[3],
		ResourceVersion: rv,
		Action:          DataAction(rvActionFolderParts[1]),
		Folder:          rvActionFolderParts[2],
	}, nil
}

func (d *metadataStore) getPrefix(key ListRequestKey) (string, error) {
	if key.Group == "" || key.Resource == "" {
		return "", fmt.Errorf("group and resource are required")
	}
	if key.Namespace == "" {
		return fmt.Sprintf("%s/%s/", key.Group, key.Resource), nil
	}
	if key.Name == "" {
		return fmt.Sprintf("%s/%s/%s/", key.Group, key.Resource, key.Namespace), nil
	}
	return fmt.Sprintf("%s/%s/%s/%s/", key.Group, key.Resource, key.Namespace, key.Name), nil
}

// keyMatches checks if the keys are the same.
func keyMatches(key1, key2 MetaDataKey) bool {
	if key1.Namespace != key2.Namespace {
		return false
	}
	if key1.Group != key2.Group {
		return false
	}
	if key1.Resource != key2.Resource {
		return false
	}
	if key1.Name != key2.Name {
		return false
	}
	return true
}
