package resource

import (
	"context"
	"encoding/json"
	"fmt"
	"iter"
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
	iter := d.ListLatest(ctx, key)
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

// TODO: replace the key with to not use the resourcepb.ResourceKey
func (d *metadataStore) ListLatest(ctx context.Context, key ListRequestKey) iter.Seq2[MetaDataObj, error] {
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
			if selectedKey == nil { // First iteration
				selectedKey = &key
				selectedPath = k
			}

			// If the current key is not the same as the previous key, we need to yield the selected object
			if selectedKey.Namespace != key.Namespace || selectedKey.Group != key.Group || selectedKey.Resource != key.Resource || selectedKey.Name != key.Name {
				if selectedKey.Action != MetaDataActionDeleted {
					metaObj, err := d.kv.Get(ctx, selectedPath)
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
						Key:   *selectedKey,
						Value: meta,
					}, nil)
				}
				selectedKey = &key // Update the current key to the new key
				selectedPath = k
			} else {
				// We are still iterating over the same key, so we need to update the latest path and uid
				selectedPath = k
				selectedKey = &key
			}
		}
		if selectedPath != "" {
			// TODO: this is dupplicated code. Refactor it
			// Process the last key
			if selectedKey.Action != MetaDataActionDeleted {
				metaObj, err := d.kv.Get(ctx, selectedPath)
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
					Key:   *selectedKey,
					Value: meta,
				}, nil)
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
