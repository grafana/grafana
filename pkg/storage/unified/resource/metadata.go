package resource

import (
	"context"
	"encoding/json"
	"fmt"
	"iter"
	"math"
	"strings"

	"github.com/google/uuid"
)

const (
	prefixMeta = "/unified/meta"
)

// Metadata store
type MetaData struct {
	Folder string `json:"folder,omitempty"`
}

type MetaDataAction string

const (
	MetaDataActionCreated MetaDataAction = "created"
	MetaDataActionUpdated MetaDataAction = "updated"
	MetaDataActionDeleted MetaDataAction = "deleted"
)

type MetaDataKey struct {
	Namespace string
	Group     string
	Resource  string
	Name      string
	UID       uuid.UUID
	Action    MetaDataAction
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
	return fmt.Sprintf("%s/%s/%s/%s/%s/%s~%s", prefixMeta, key.Group, key.Resource, key.Namespace, key.Name, key.UID.String(), key.Action)
}

func (d *metadataStore) parseKey(key string) (MetaDataKey, error) {
	if !strings.HasPrefix(key, prefixMeta+"/") {
		return MetaDataKey{}, fmt.Errorf("invalid key: %s", key)
	}
	key = strings.TrimPrefix(key, prefixMeta+"/")

	parts := strings.Split(key, "/")
	if len(parts) < 4 {
		return MetaDataKey{}, fmt.Errorf("invalid key: %s", key)
	}

	uidActionParts := strings.Split(parts[4], "~")
	if len(uidActionParts) != 2 {
		return MetaDataKey{}, fmt.Errorf("invalid key: %s", key)
	}
	uid, err := uuid.Parse(uidActionParts[0])
	if err != nil {
		return MetaDataKey{}, fmt.Errorf("invalid uuid: %s", uid)
	}
	return MetaDataKey{
		Namespace: parts[2],
		Group:     parts[0],
		Resource:  parts[1],
		Name:      parts[3],
		UID:       uid,
		Action:    MetaDataAction(uidActionParts[1]),
	}, nil
}

func (d *metadataStore) getPrefix(key ListRequestKey) (string, error) {
	if key.Namespace == "" || key.Group == "" || key.Resource == "" {
		return "", fmt.Errorf("namespace, group, and resource are required")
	}
	if key.Name == "" {
		return fmt.Sprintf("%s/%s/%s/%s/", prefixMeta, key.Group, key.Resource, key.Namespace), nil
	}
	return fmt.Sprintf("%s/%s/%s/%s/%s/", prefixMeta, key.Group, key.Resource, key.Namespace, key.Name), nil
}

func (d *metadataStore) Get(ctx context.Context, key MetaDataKey) (MetaData, error) {
	obj, err := d.kv.Get(ctx, d.getKey(key))
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
	iter := d.kv.List(ctx, ListOptions{
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
				metaObj, err := d.kv.Get(ctx, path)
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

		// rvMatches checks if the rv from the uid is lower than the target rv
		rvMatches := func(uid uuid.UUID) bool {
			// The key is the same, we pick the one with the higher RV
			uidRV, err := rvFromUID(uid)
			if err != nil {
				return false // TODO: handle error
			}

			return uidRV <= rv
		}

		for k, err := range iter {
			if err != nil {
				yield(MetaDataObj{}, err)
				return
			}
			// Parse the key to get the resource key and uid
			key, err := d.parseKey(k)
			if err != nil {
				yield(MetaDataObj{}, err)
				return
			}
			if selectedKey == nil && rvMatches(key.UID) { // First candidate
				selectedKey = &key
				selectedPath = k
			}

			if selectedKey == nil {
				continue
			}
			// If the current key is not the same as the previous key, or if the rv
			// is greater than the target rv, we need to yield the selected object.
			if !keyMatches(key, *selectedKey) || !rvMatches(key.UID) {
				yieldPath(selectedPath, *selectedKey)
				selectedKey = nil
				selectedPath = ""
			}
			if rvMatches(key.UID) {
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
	iter := d.kv.List(ctx, ListOptions{
		StartKey: prefix,
		EndKey:   PrefixRangeEnd(prefix),
	})
	return func(yield func(MetaDataObj, error) bool) {
		for k, err := range iter {
			if err != nil {
				yield(MetaDataObj{}, err)
				return
			}
			metaObj, err := d.kv.Get(ctx, k)
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
	return d.kv.Save(ctx, d.getKey(obj.Key), valueBytes, SaveOptions{})
}
