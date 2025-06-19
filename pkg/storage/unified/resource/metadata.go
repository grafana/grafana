package resource

import (
	"context"
	"encoding/json"
	"fmt"
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
	Folder string `json:"folder"`
}

type MetaDataAction string

const (
	MetaDataActionCreated MetaDataAction = "created"
	MetaDataActionUpdated MetaDataAction = "updated"
	MetaDataActionDeleted MetaDataAction = "deleted"
)

type MetaDataKey struct {
	Namespace       string
	Group           string
	Resource        string
	Name            string
	ResourceVersion int64
	Action          MetaDataAction
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
	return fmt.Sprintf("%s/%s/%s/%s/%d~%s", key.Group, key.Resource, key.Namespace, key.Name, key.ResourceVersion, key.Action)
}

func (d *metadataStore) parseKey(key string) (MetaDataKey, error) {
	parts := strings.Split(key, "/")
	if len(parts) < 4 {
		return MetaDataKey{}, fmt.Errorf("invalid key: %s", key)
	}

	rvActionParts := strings.Split(parts[4], "~")
	if len(rvActionParts) != 2 {
		return MetaDataKey{}, fmt.Errorf("invalid key: %s", key)
	}
	rv, err := strconv.ParseInt(rvActionParts[0], 10, 64)
	if err != nil {
		return MetaDataKey{}, fmt.Errorf("invalid key: %s", key)
	}
	return MetaDataKey{
		Namespace:       parts[2],
		Group:           parts[0],
		Resource:        parts[1],
		Name:            parts[3],
		ResourceVersion: rv,
		Action:          MetaDataAction(rvActionParts[1]),
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
	var meta MetaData
	if err := json.Unmarshal(obj.Value, &meta); err != nil {
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

type ListRequestKey struct {
	Namespace string
	Group     string
	Resource  string
	Name      string
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
		var selectedPath string

		// Yield is a helper function to yield a metadata object from a given path.
		// It parses the key and yields the metadata object if it is not deleted.
		yieldPath := func(path string, key MetaDataKey) {
			if key.Action != MetaDataActionDeleted {
				metaObj, err := d.kv.Get(ctx, metaSection, path)
				if err != nil {
					yield(MetaDataObj{}, err)
					return
				}
				var meta MetaData
				if err := json.Unmarshal(metaObj.Value, &meta); err != nil {
					yield(MetaDataObj{}, err)
					return
				}
				yield(MetaDataObj{
					Key:   key,
					Value: meta,
				}, nil)
			}
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

		for k, err := range iter {
			if err != nil {
				yield(MetaDataObj{}, err)
				return
			}

			key, err := d.parseKey(k)
			if err != nil {
				yield(MetaDataObj{}, err)
				return
			}
			if selectedKey == nil && key.ResourceVersion <= rv { // First candidate
				selectedKey = &key
				selectedPath = k
			}

			if selectedKey == nil {
				continue
			}
			// If the current key is not the same as the previous key, or if the rv
			// is greater than the target rv, we need to yield the selected object.
			if !keyMatches(key, *selectedKey) || key.ResourceVersion > rv {
				yieldPath(selectedPath, *selectedKey)
				selectedKey = nil
				selectedPath = ""
			}
			if key.ResourceVersion <= rv {
				selectedKey = &key
				selectedPath = k
			}
		}
		if selectedKey != nil { // Yield the last selected object
			yieldPath(selectedPath, *selectedKey)
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
		StartKey: prefix,
		EndKey:   PrefixRangeEnd(prefix),
	})
	return func(yield func(MetaDataObj, error) bool) {
		for k, err := range iter {
			if err != nil {
				yield(MetaDataObj{}, err)
				return
			}
			metaObj, err := d.kv.Get(ctx, metaSection, k)
			if err != nil {
				yield(MetaDataObj{}, err)
				return
			}
			var meta MetaData
			if err := json.Unmarshal(metaObj.Value, &meta); err != nil {
				yield(MetaDataObj{}, err)
				return
			}
			k, err := d.parseKey(k)
			if err != nil {
				yield(MetaDataObj{}, err)
				return
			}
			yield(MetaDataObj{
				Key:   k,
				Value: meta,
			}, nil)
		}
	}
}

func (d *metadataStore) Save(ctx context.Context, obj MetaDataObj) error {
	valueBytes, err := json.Marshal(obj.Value)
	if err != nil {
		return err
	}
	return d.kv.Save(ctx, metaSection, d.getKey(obj.Key), valueBytes)
}
