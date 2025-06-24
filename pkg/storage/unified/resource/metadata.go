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

// Metadata store
type MetaData struct {
	// For now empty
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

func (d *metadataStore) getKey(key MetaDataKey) string {
	return fmt.Sprintf("%s/%s/%s/%s/%d~%s~%s", key.Group, key.Resource, key.Namespace, key.Name, key.ResourceVersion, key.Action, key.Folder)
}

func (d *metadataStore) parseKey(key string) (MetaDataKey, error) {
	parts := strings.Split(key, "/")
	if len(parts) < 4 {
		return MetaDataKey{}, fmt.Errorf("invalid key: %s", key)
	}

	rvActionFolderParts := strings.Split(parts[4], "~")
	if len(rvActionFolderParts) != 3 {
		return MetaDataKey{}, fmt.Errorf("invalid key: %s", key)
	}
	rv, err := strconv.ParseInt(rvActionFolderParts[0], 10, 64)
	if err != nil {
		return MetaDataKey{}, fmt.Errorf("invalid key: %s", key)
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
	return d.GetAt(ctx, key, 0)
}

func (d *metadataStore) GetAt(ctx context.Context, key ListRequestKey, rv int64) (MetaDataObj, error) {
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
	iter := d.ListAt(ctx, key, rv)
	for obj, err := range iter {
		if err != nil {
			return MetaDataObj{}, err
		}
		return obj, nil
	}
	return MetaDataObj{}, ErrNotFound
}

func (d *metadataStore) ListLatest(ctx context.Context, key ListRequestKey) iter.Seq2[MetaDataObj, error] {
	return d.ListAt(ctx, key, math.MaxInt64)
}

// ListAt lists all metadata objects for a given resource key and resource version.
func (d *metadataStore) ListAt(ctx context.Context, key ListRequestKey, rv int64) iter.Seq2[MetaDataObj, error] {
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
	iter := d.kv.Keys(ctx, metaSection, ListOptions{
		StartKey: prefix,
		EndKey:   PrefixRangeEnd(prefix),
	})

	return func(yield func(MetaDataObj, error) bool) {
		var selectedKey *MetaDataKey // The current key we are iterating over

		// Yield is a helper function to yield a metadata object from a given object.
		// It yields the metadata object if it is not deleted.
		yieldObj := func(obj KVObject, key MetaDataKey) bool {
			if key.Action != DataActionDeleted {
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
			return true
		}

		// keyMatches checks if the keys are the same
		keyMatches := func(current, selection MetaDataKey) bool {
			// If the keys are different, we need to yield the selected object
			if current.Namespace != selection.Namespace {
				return false
			}
			if current.Group != selection.Group {
				return false
			}
			if current.Resource != selection.Resource {
				return false
			}
			if current.Name != selection.Name {
				return false
			}
			return true
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
			if selectedKey == nil && metaKey.ResourceVersion <= rv { // First candidate
				selectedKey = &metaKey
			}

			if selectedKey == nil {
				continue
			}
			// If the current key is not the same as the previous key, or if the rv
			// is greater than the target rv, we need to yield the selected object.
			if !keyMatches(metaKey, *selectedKey) || metaKey.ResourceVersion > rv {
				obj, err := d.kv.Get(ctx, metaSection, key)
				if err != nil {
					yield(MetaDataObj{}, err)
					return
				}
				if !yieldObj(obj, *selectedKey) {
					return
				}
				selectedKey = nil
			}
			if metaKey.ResourceVersion <= rv {
				selectedKey = &metaKey
			}
		}
		if selectedKey != nil { // Yield the last selected object
			obj, err := d.kv.Get(ctx, metaSection, d.getKey(*selectedKey))
			if err != nil {
				yield(MetaDataObj{}, err)
				return
			}
			if !yieldObj(obj, *selectedKey) {
				return
			}
		}
	}
}

// ListAll lists all metadata objects for a given resource key.
func (d *metadataStore) ListAll(ctx context.Context, key ListRequestKey) iter.Seq2[MetaDataObj, error] {
	prefix, err := d.getPrefix(key)
	if err != nil {
		return func(yield func(MetaDataObj, error) bool) {
			yield(MetaDataObj{}, err)
		}
	}
	iter := d.kv.Keys(ctx, metaSection, ListOptions{
		Sort:     SortOrderAsc,
		StartKey: prefix,
		EndKey:   PrefixRangeEnd(prefix),
	})
	return func(yield func(MetaDataObj, error) bool) {
		for key, err := range iter {
			if err != nil {
				yield(MetaDataObj{}, err)
				return
			}
			var meta MetaData
			obj, err := d.kv.Get(ctx, metaSection, key)
			if err != nil {
				yield(MetaDataObj{}, err)
				return
			}
			value, err := io.ReadAll(obj.Value)
			if err != nil {
				yield(MetaDataObj{}, err)
				return
			}
			if err := json.Unmarshal(value, &meta); err != nil {
				yield(MetaDataObj{}, err)
				return
			}
			parsedKey, err := d.parseKey(key)
			if err != nil {
				yield(MetaDataObj{}, err)
				return
			}
			if !yield(MetaDataObj{
				Key:   parsedKey,
				Value: meta,
			}, nil) {
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
