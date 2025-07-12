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
		return fmt.Errorf("namespace '%s' is invalid", k.Namespace)
	}
	if !validNameRegex.MatchString(k.Group) {
		return fmt.Errorf("group '%s' is invalid", k.Group)
	}
	if !validNameRegex.MatchString(k.Resource) {
		return fmt.Errorf("resource '%s' is invalid", k.Resource)
	}
	if !validNameRegex.MatchString(k.Name) {
		return fmt.Errorf("name '%s' is invalid", k.Name)
	}

	// Validate folder field if provided (optional field)
	if k.Folder != "" && !validNameRegex.MatchString(k.Folder) {
		return fmt.Errorf("folder '%s' is invalid", k.Folder)
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

	// If namespace is empty, name must also be empty
	if k.Namespace == "" && k.Name != "" {
		return fmt.Errorf("name must be empty when namespace is empty")
	}

	// Validate naming conventions
	if k.Namespace != "" && !validNameRegex.MatchString(k.Namespace) {
		return fmt.Errorf("namespace '%s' is invalid", k.Namespace)
	}
	if !validNameRegex.MatchString(k.Group) {
		return fmt.Errorf("group '%s' is invalid", k.Group)
	}
	if !validNameRegex.MatchString(k.Resource) {
		return fmt.Errorf("resource '%s' is invalid", k.Resource)
	}
	if k.Name != "" && !validNameRegex.MatchString(k.Name) {
		return fmt.Errorf("name '%s' is invalid", k.Name)
	}

	return nil
}

// Prefix returns the prefix for listing metadata objects
func (k MetaListRequestKey) Prefix() string {
	if k.Name == "" {
		if k.Namespace == "" {
			return fmt.Sprintf("%s/%s/", k.Group, k.Resource)
		}
		return fmt.Sprintf("%s/%s/%s/", k.Group, k.Resource, k.Namespace)
	}
	if k.Namespace == "" {
		return fmt.Sprintf("%s/%s/%s/", k.Group, k.Resource, k.Name)
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
		return fmt.Errorf("namespace '%s' is invalid", k.Namespace)
	}
	if !validNameRegex.MatchString(k.Group) {
		return fmt.Errorf("group '%s' is invalid", k.Group)
	}
	if !validNameRegex.MatchString(k.Resource) {
		return fmt.Errorf("resource '%s' is invalid", k.Resource)
	}
	if !validNameRegex.MatchString(k.Name) {
		return fmt.Errorf("name '%s' is invalid", k.Name)
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

// newMetadataStore creates a new metadata store instance with the given key-value store backend.
func newMetadataStore(kv KV) *metadataStore {
	return &metadataStore{
		kv: kv,
	}
}

// Get retrieves the metadata for a specific metadata key.
// It validates the key and returns the raw metadata content.
func (d *metadataStore) Get(ctx context.Context, key MetaDataKey) (MetaData, error) {
	if err := key.Validate(); err != nil {
		return MetaData{}, fmt.Errorf("invalid metadata key: %w", err)
	}

	reader, err := d.kv.Get(ctx, metaSection, key.String())
	if err != nil {
		return MetaData{}, err
	}
	defer func() {
		_ = reader.Close()
	}()
	var meta MetaData
	err = json.NewDecoder(reader).Decode(&meta)
	return meta, err
}

// GetLatestResourceKey retrieves the metadata key for the latest version of a resource.
// Returns the key with the highest resource version that is not deleted.
func (d *metadataStore) GetLatestResourceKey(ctx context.Context, key MetaGetRequestKey) (MetaDataKey, error) {
	return d.GetResourceKeyAtRevision(ctx, key, 0)
}

// GetResourceKeyAtRevision retrieves the metadata key for a resource at a specific revision.
// If rv is 0, it returns the latest version. Returns the highest version <= rv that is not deleted.
func (d *metadataStore) GetResourceKeyAtRevision(ctx context.Context, key MetaGetRequestKey, rv int64) (MetaDataKey, error) {
	if err := key.Validate(); err != nil {
		return MetaDataKey{}, fmt.Errorf("invalid get request key: %w", err)
	}

	if rv == 0 {
		rv = math.MaxInt64
	}

	listKey := MetaListRequestKey(key)

	iter := d.ListResourceKeysAtRevision(ctx, listKey, rv)
	for metaKey, err := range iter {
		if err != nil {
			return MetaDataKey{}, err
		}
		return metaKey, nil
	}
	return MetaDataKey{}, ErrNotFound
}

// ListLatestResourceKeys returns an iterator over the metadata keys for the latest versions of resources.
// Only returns keys for resources that are not deleted.
func (d *metadataStore) ListLatestResourceKeys(ctx context.Context, key MetaListRequestKey) iter.Seq2[MetaDataKey, error] {
	return d.ListResourceKeysAtRevision(ctx, key, 0)
}

// ListResourceKeysAtRevision returns an iterator over metadata keys for resources at a specific revision.
// If rv is 0, it returns the latest versions. Only returns keys for resources that are not deleted at the given revision.
func (d *metadataStore) ListResourceKeysAtRevision(ctx context.Context, key MetaListRequestKey, rv int64) iter.Seq2[MetaDataKey, error] {
	if err := key.Validate(); err != nil {
		return func(yield func(MetaDataKey, error) bool) {
			yield(MetaDataKey{}, fmt.Errorf("invalid list request key: %w", err))
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

	return func(yield func(MetaDataKey, error) bool) {
		var candidateKey *MetaDataKey // The current candidate key we are iterating over

		// yieldCandidate is a helper function to yield results.
		// Won't yield if the resource was last deleted.
		yieldCandidate := func() bool {
			if candidateKey.Action == DataActionDeleted {
				// Skip because the resource was last deleted.
				return true
			}
			return yield(*candidateKey, nil)
		}

		for key, err := range iter {
			if err != nil {
				yield(MetaDataKey{}, err)
				return
			}

			metaKey, err := parseMetaDataKey(key)
			if err != nil {
				yield(MetaDataKey{}, err)
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
			// - We reached the next resource.
			// - We reached a resource version greater than the target resource version.
			if !metaKey.SameResource(*candidateKey) || metaKey.ResourceVersion > rv {
				if !yieldCandidate() {
					return
				}
				// If we moved to a different resource and the resource version matches, make it the new candidate
				if !metaKey.SameResource(*candidateKey) && metaKey.ResourceVersion <= rv {
					candidateKey = &metaKey
				} else {
					// If we moved to a different resource and the resource version does not match, reset the candidate
					candidateKey = nil
				}
			} else {
				// Update candidate to the current key (same resource, valid version)
				candidateKey = &metaKey
			}
		}
		if candidateKey != nil {
			// Yield the last selected object
			if !yieldCandidate() {
				return
			}
		}
	}
}

// Save stores a metadata object in the store.
func (d *metadataStore) Save(ctx context.Context, obj MetaDataObj) error {
	if err := obj.Key.Validate(); err != nil {
		return fmt.Errorf("invalid metadata key: %w", err)
	}

	writer, err := d.kv.Save(ctx, metaSection, obj.Key.String())
	if err != nil {
		return err
	}
	encoder := json.NewEncoder(writer)
	if err := encoder.Encode(obj.Value); err != nil {
		_ = writer.Close()
		return err
	}

	return writer.Close()
}

// parseMetaDataKey parses a string key into a MetaDataKey struct
func parseMetaDataKey(key string) (MetaDataKey, error) {
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

// SameResource checks if this key represents the same resource as another key.
// It compares the identifying fields: Namespace, Group, Resource, and Name.
// ResourceVersion, Action, and Folder are ignored as they don't identify the resource itself.
func (k MetaDataKey) SameResource(other MetaDataKey) bool {
	return k.Namespace == other.Namespace &&
		k.Group == other.Group &&
		k.Resource == other.Resource &&
		k.Name == other.Name
}
