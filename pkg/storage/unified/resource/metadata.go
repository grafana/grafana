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

// String returns the string representation of the MetaDataKey used as the storage key
func (k MetaDataKey) String() string {
	return fmt.Sprintf("%s/%s/%s/%s/%d~%s~%s", k.Group, k.Resource, k.Namespace, k.Name, k.ResourceVersion, k.Action, k.Folder)
}

// Validate validates that all required fields are present and valid
func (k MetaDataKey) Validate() error {
	if k.Group == "" {
		return fmt.Errorf("group is required")
	}
	if k.Resource == "" {
		return fmt.Errorf("resource is required")
	}
	if k.Namespace == "" {
		return fmt.Errorf("namespace is required")
	}
	if k.Name == "" {
		return fmt.Errorf("name is required")
	}
	if k.ResourceVersion <= 0 {
		return fmt.Errorf("resource version must be positive")
	}
	if k.Action == "" {
		return fmt.Errorf("action is required")
	}

	// Validate naming conventions for all required fields
	if !validNameRegex.MatchString(k.Namespace) {
		return fmt.Errorf("namespace '%s' is invalid: must contain only lowercase alphanumeric characters, '-' or '.', and start and end with an alphanumeric character", k.Namespace)
	}
	if !validNameRegex.MatchString(k.Group) {
		return fmt.Errorf("group '%s' is invalid: must contain only lowercase alphanumeric characters, '-' or '.', and start and end with an alphanumeric character", k.Group)
	}
	if !validNameRegex.MatchString(k.Resource) {
		return fmt.Errorf("resource '%s' is invalid: must contain only lowercase alphanumeric characters, '-' or '.', and start and end with an alphanumeric character", k.Resource)
	}
	if !validNameRegex.MatchString(k.Name) {
		return fmt.Errorf("name '%s' is invalid: must contain only lowercase alphanumeric characters, '-' or '.', and start and end with an alphanumeric character", k.Name)
	}

	// Validate folder field if provided (optional field)
	if k.Folder != "" && !validNameRegex.MatchString(k.Folder) {
		return fmt.Errorf("folder '%s' is invalid: must contain only lowercase alphanumeric characters, '-' or '.', and start and end with an alphanumeric character", k.Folder)
	}

	// Validate action is one of the valid values
	switch k.Action {
	case DataActionCreated, DataActionUpdated, DataActionDeleted:
		return nil
	default:
		return fmt.Errorf("action '%s' is invalid: must be one of 'created', 'updated', or 'deleted'", k.Action)
	}
}

// MetaListRequestKey is used for listing metadata objects
type MetaListRequestKey struct {
	Namespace string
	Group     string
	Resource  string
	Name      string // optional for listing multiple resources
}

// Validate validates the list request key
func (k MetaListRequestKey) Validate() error {
	if k.Group == "" {
		return fmt.Errorf("group is required")
	}
	if k.Resource == "" {
		return fmt.Errorf("resource is required")
	}
	if k.Namespace == "" {
		return fmt.Errorf("namespace is required")
	}

	// Validate naming conventions
	if !validNameRegex.MatchString(k.Namespace) {
		return fmt.Errorf("namespace '%s' is invalid: must contain only lowercase alphanumeric characters, '-' or '.', and start and end with an alphanumeric character", k.Namespace)
	}
	if !validNameRegex.MatchString(k.Group) {
		return fmt.Errorf("group '%s' is invalid: must contain only lowercase alphanumeric characters, '-' or '.', and start and end with an alphanumeric character", k.Group)
	}
	if !validNameRegex.MatchString(k.Resource) {
		return fmt.Errorf("resource '%s' is invalid: must contain only lowercase alphanumeric characters, '-' or '.', and start and end with an alphanumeric character", k.Resource)
	}
	if k.Name != "" && !validNameRegex.MatchString(k.Name) {
		return fmt.Errorf("name '%s' is invalid: must contain only lowercase alphanumeric characters, '-' or '.', and start and end with an alphanumeric character", k.Name)
	}

	return nil
}

// Prefix returns the prefix for listing metadata objects
func (k MetaListRequestKey) Prefix() string {
	if k.Name == "" {
		return fmt.Sprintf("%s/%s/%s/", k.Group, k.Resource, k.Namespace)
	}
	return fmt.Sprintf("%s/%s/%s/%s/", k.Group, k.Resource, k.Namespace, k.Name)
}

// MetaGetRequestKey is used for getting a specific metadata object by latest version
type MetaGetRequestKey struct {
	Namespace string
	Group     string
	Resource  string
	Name      string
}

// Validate validates the get request key
func (k MetaGetRequestKey) Validate() error {
	if k.Group == "" {
		return fmt.Errorf("group is required")
	}
	if k.Resource == "" {
		return fmt.Errorf("resource is required")
	}
	if k.Namespace == "" {
		return fmt.Errorf("namespace is required")
	}
	if k.Name == "" {
		return fmt.Errorf("name is required")
	}

	// Validate naming conventions
	if !validNameRegex.MatchString(k.Namespace) {
		return fmt.Errorf("namespace '%s' is invalid: must contain only lowercase alphanumeric characters, '-' or '.', and start and end with an alphanumeric character", k.Namespace)
	}
	if !validNameRegex.MatchString(k.Group) {
		return fmt.Errorf("group '%s' is invalid: must contain only lowercase alphanumeric characters, '-' or '.', and start and end with an alphanumeric character", k.Group)
	}
	if !validNameRegex.MatchString(k.Resource) {
		return fmt.Errorf("resource '%s' is invalid: must contain only lowercase alphanumeric characters, '-' or '.', and start and end with an alphanumeric character", k.Resource)
	}
	if !validNameRegex.MatchString(k.Name) {
		return fmt.Errorf("name '%s' is invalid: must contain only lowercase alphanumeric characters, '-' or '.', and start and end with an alphanumeric character", k.Name)
	}

	return nil
}

// Prefix returns the prefix for getting a specific metadata object
func (k MetaGetRequestKey) Prefix() string {
	return fmt.Sprintf("%s/%s/%s/%s/", k.Group, k.Resource, k.Namespace, k.Name)
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
	if err := key.Validate(); err != nil {
		return MetaData{}, fmt.Errorf("invalid metadata key: %w", err)
	}

	obj, err := d.kv.Get(ctx, metaSection, key.String())
	if err != nil {
		return MetaData{}, err
	}
	defer obj.Value.Close()
	var meta MetaData
	err = json.NewDecoder(obj.Value).Decode(&meta)
	return meta, err
}

func (d *metadataStore) GetLatest(ctx context.Context, key MetaGetRequestKey) (MetaDataObj, error) {
	return d.GetAtRevision(ctx, key, 0)
}

func (d *metadataStore) GetAtRevision(ctx context.Context, key MetaGetRequestKey, rv int64) (MetaDataObj, error) {
	if err := key.Validate(); err != nil {
		return MetaDataObj{}, fmt.Errorf("invalid get request key: %w", err)
	}

	if rv == 0 {
		rv = math.MaxInt64
	}

	listKey := MetaListRequestKey{
		Namespace: key.Namespace,
		Group:     key.Group,
		Resource:  key.Resource,
		Name:      key.Name,
	}

	iter := d.ListAtRevision(ctx, listKey, rv)
	for obj, err := range iter {
		if err != nil {
			return MetaDataObj{}, err
		}
		return obj, nil
	}
	return MetaDataObj{}, ErrNotFound
}

func (d *metadataStore) ListLatest(ctx context.Context, key MetaListRequestKey) iter.Seq2[MetaDataObj, error] {
	return d.ListAtRevision(ctx, key, 0)
}

// ListAtRevision lists all metadata objects for a given resource key and resource version.
func (d *metadataStore) ListAtRevision(ctx context.Context, key MetaListRequestKey, rv int64) iter.Seq2[MetaDataObj, error] {
	if err := key.Validate(); err != nil {
		return func(yield func(MetaDataObj, error) bool) {
			yield(MetaDataObj{}, fmt.Errorf("invalid list request key: %w", err))
		}
	}

	if rv == 0 {
		rv = math.MaxInt64
	}

	prefix := key.Prefix()
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
			obj, err := d.kv.Get(ctx, metaSection, key.String())
			if err != nil {
				yield(MetaDataObj{}, err)
				return false
			}
			defer obj.Value.Close()
			var meta MetaData
			err = json.NewDecoder(obj.Value).Decode(&meta)
			if err != nil {
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
	if err := obj.Key.Validate(); err != nil {
		return fmt.Errorf("invalid metadata key: %w", err)
	}

	valueBytes, err := json.Marshal(obj.Value)
	if err != nil {
		return err
	}
	return d.kv.Save(ctx, metaSection, obj.Key.String(), io.NopCloser(bytes.NewReader(valueBytes)))
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
