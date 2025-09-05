package resource

import (
	"context"
	"fmt"
	"io"
	"iter"
	"math"
	"regexp"
	"strconv"
	"strings"
	"time"

	gocache "github.com/patrickmn/go-cache"
)

const (
	dataSection = "unified/data"
	// cache
	groupResourcesCacheKey = "group-resources"
)

// dataStore is a data store that uses a KV store to store data.
type dataStore struct {
	kv    KV
	cache *gocache.Cache
}

func newDataStore(kv KV) *dataStore {
	return &dataStore{
		kv:    kv,
		cache: gocache.New(time.Hour, 10*time.Minute), // 1 hour expiration, 10 minute cleanup
	}
}

type DataObj struct {
	Key   DataKey
	Value io.ReadCloser
}

type DataKey struct {
	Namespace       string
	Group           string
	Resource        string
	Name            string
	ResourceVersion int64
	Action          DataAction
	Folder          string
}

// GroupResource represents a unique group/resource combination
type GroupResource struct {
	Group    string
	Resource string
}

var (
	// validNameRegex validates that a name contains only lowercase alphanumeric characters, '-' or '.'
	// and starts and ends with an alphanumeric character
	validNameRegex = regexp.MustCompile(`^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$`)
)

func (k DataKey) String() string {
	return fmt.Sprintf("%s/%s/%s/%s/%d~%s~%s", k.Group, k.Resource, k.Namespace, k.Name, k.ResourceVersion, k.Action, k.Folder)
}

func (k DataKey) Equals(other DataKey) bool {
	return k.Group == other.Group && k.Resource == other.Resource && k.Namespace == other.Namespace && k.Name == other.Name && k.ResourceVersion == other.ResourceVersion && k.Action == other.Action && k.Folder == other.Folder
}

func (k DataKey) Validate() error {
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

type ListRequestKey struct {
	Group     string
	Resource  string
	Namespace string
	Name      string // optional for listing multiple resources
	Sort      SortOrder
}

func (k ListRequestKey) Validate() error {
	if k.Group == "" {
		return fmt.Errorf("group is required")
	}
	if k.Resource == "" {
		return fmt.Errorf("resource is required")
	}
	if k.Namespace == "" && k.Name != "" {
		return fmt.Errorf("name must be empty when namespace is empty")
	}
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

func (k ListRequestKey) Prefix() string {
	if k.Namespace == "" {
		return fmt.Sprintf("%s/%s/", k.Group, k.Resource)
	}
	if k.Name == "" {
		return fmt.Sprintf("%s/%s/%s/", k.Group, k.Resource, k.Namespace)
	}
	return fmt.Sprintf("%s/%s/%s/%s/", k.Group, k.Resource, k.Namespace, k.Name)
}

// GetRequestKey is used for getting a specific data object by latest version
type GetRequestKey struct {
	Group     string
	Resource  string
	Namespace string
	Name      string
}

// Validate validates the get request key
func (k GetRequestKey) Validate() error {
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

// Prefix returns the prefix for getting a specific data object
func (k GetRequestKey) Prefix() string {
	return fmt.Sprintf("%s/%s/%s/%s/", k.Group, k.Resource, k.Namespace, k.Name)
}

type DataAction string

const (
	DataActionCreated DataAction = "created"
	DataActionUpdated DataAction = "updated"
	DataActionDeleted DataAction = "deleted"
)

// Keys returns all keys for a given key by iterating through the KV store
func (d *dataStore) Keys(ctx context.Context, key ListRequestKey) iter.Seq2[DataKey, error] {
	if err := key.Validate(); err != nil {
		return func(yield func(DataKey, error) bool) {
			yield(DataKey{}, err)
		}
	}
	prefix := key.Prefix()
	return func(yield func(DataKey, error) bool) {
		for k, err := range d.kv.Keys(ctx, dataSection, ListOptions{
			StartKey: prefix,
			EndKey:   PrefixRangeEnd(prefix),
			Sort:     key.Sort,
		}) {
			if err != nil {
				yield(DataKey{}, err)
				return
			}
			key, err := ParseKey(k)
			if err != nil {
				yield(DataKey{}, err)
				return
			}
			if !yield(key, nil) {
				return
			}
		}
	}
}

// LastResourceVersion returns the last key for a given resource
func (d *dataStore) LastResourceVersion(ctx context.Context, key ListRequestKey) (DataKey, error) {
	if err := key.Validate(); err != nil {
		return DataKey{}, fmt.Errorf("invalid data key: %w", err)
	}
	if key.Group == "" || key.Resource == "" || key.Namespace == "" || key.Name == "" {
		return DataKey{}, fmt.Errorf("group, resource, namespace or name is empty")
	}
	prefix := key.Prefix()
	for key, err := range d.kv.Keys(ctx, dataSection, ListOptions{
		StartKey: prefix,
		EndKey:   PrefixRangeEnd(prefix),
		Limit:    1,
		Sort:     SortOrderDesc,
	}) {
		if err != nil {
			return DataKey{}, err
		}
		return ParseKey(key)
	}
	return DataKey{}, ErrNotFound
}

// GetLatestResourceKey retrieves the data key for the latest version of a resource.
// Returns the key with the highest resource version that is not deleted.
func (d *dataStore) GetLatestResourceKey(ctx context.Context, key GetRequestKey) (DataKey, error) {
	return d.GetResourceKeyAtRevision(ctx, key, 0)
}

// GetResourceKeyAtRevision retrieves the data key for a resource at a specific revision.
// If rv is 0, it returns the latest version. Returns the highest version <= rv that is not deleted.
func (d *dataStore) GetResourceKeyAtRevision(ctx context.Context, key GetRequestKey, rv int64) (DataKey, error) {
	if err := key.Validate(); err != nil {
		return DataKey{}, fmt.Errorf("invalid get request key: %w", err)
	}

	if rv == 0 {
		rv = math.MaxInt64
	}

	listKey := ListRequestKey(key)

	iter := d.ListResourceKeysAtRevision(ctx, listKey, rv)
	for dataKey, err := range iter {
		if err != nil {
			return DataKey{}, err
		}
		return dataKey, nil
	}
	return DataKey{}, ErrNotFound
}

// ListLatestResourceKeys returns an iterator over the data keys for the latest versions of resources.
// Only returns keys for resources that are not deleted.
func (d *dataStore) ListLatestResourceKeys(ctx context.Context, key ListRequestKey) iter.Seq2[DataKey, error] {
	return d.ListResourceKeysAtRevision(ctx, key, 0)
}

// ListResourceKeysAtRevision returns an iterator over data keys for resources at a specific revision.
// If rv is 0, it returns the latest versions. Only returns keys for resources that are not deleted at the given revision.
func (d *dataStore) ListResourceKeysAtRevision(ctx context.Context, key ListRequestKey, rv int64) iter.Seq2[DataKey, error] {
	if err := key.Validate(); err != nil {
		return func(yield func(DataKey, error) bool) {
			yield(DataKey{}, fmt.Errorf("invalid list request key: %w", err))
		}
	}

	if rv == 0 {
		rv = math.MaxInt64
	}

	prefix := key.Prefix()
	// List all keys in the prefix.
	iter := d.kv.Keys(ctx, dataSection, ListOptions{
		StartKey: prefix,
		EndKey:   PrefixRangeEnd(prefix),
		Sort:     SortOrderAsc,
	})

	return func(yield func(DataKey, error) bool) {
		var candidateKey *DataKey // The current candidate key we are iterating over

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
				yield(DataKey{}, err)
				return
			}

			dataKey, err := ParseKey(key)
			if err != nil {
				yield(DataKey{}, err)
				return
			}

			if candidateKey == nil {
				// Skip until we have our first candidate
				if dataKey.ResourceVersion <= rv {
					// New candidate found.
					candidateKey = &dataKey
				}
				continue
			}
			// Should yield if either:
			// - We reached the next resource.
			// - We reached a resource version greater than the target resource version.
			if !dataKey.SameResource(*candidateKey) || dataKey.ResourceVersion > rv {
				if !yieldCandidate() {
					return
				}
				// If we moved to a different resource and the resource version matches, make it the new candidate
				if !dataKey.SameResource(*candidateKey) && dataKey.ResourceVersion <= rv {
					candidateKey = &dataKey
				} else {
					// If we moved to a different resource and the resource version does not match, reset the candidate
					candidateKey = nil
				}
			} else {
				// Update candidate to the current key (same resource, valid version)
				candidateKey = &dataKey
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

func (d *dataStore) Get(ctx context.Context, key DataKey) (io.ReadCloser, error) {
	if err := key.Validate(); err != nil {
		return nil, fmt.Errorf("invalid data key: %w", err)
	}

	return d.kv.Get(ctx, dataSection, key.String())
}

func (d *dataStore) Save(ctx context.Context, key DataKey, value io.Reader) error {
	if err := key.Validate(); err != nil {
		return fmt.Errorf("invalid data key: %w", err)
	}

	writer, err := d.kv.Save(ctx, dataSection, key.String())
	if err != nil {
		return err
	}
	_, err = io.Copy(writer, value)
	if err != nil {
		_ = writer.Close()
		return err
	}

	return writer.Close()
}

func (d *dataStore) Delete(ctx context.Context, key DataKey) error {
	if err := key.Validate(); err != nil {
		return fmt.Errorf("invalid data key: %w", err)
	}

	return d.kv.Delete(ctx, dataSection, key.String())
}

// ParseKey parses a string key into a DataKey struct
func ParseKey(key string) (DataKey, error) {
	parts := strings.Split(key, "/")
	if len(parts) != 5 {
		return DataKey{}, fmt.Errorf("invalid key: %s", key)
	}
	rvActionFolderParts := strings.Split(parts[4], "~")
	if len(rvActionFolderParts) != 3 {
		return DataKey{}, fmt.Errorf("invalid key: %s", key)
	}
	rv, err := strconv.ParseInt(rvActionFolderParts[0], 10, 64)
	if err != nil {
		return DataKey{}, fmt.Errorf("invalid resource version '%s' in key %s: %w", rvActionFolderParts[0], key, err)
	}
	return DataKey{
		Group:           parts[0],
		Resource:        parts[1],
		Namespace:       parts[2],
		Name:            parts[3],
		ResourceVersion: rv,
		Action:          DataAction(rvActionFolderParts[1]),
		Folder:          rvActionFolderParts[2],
	}, nil
}

// SameResource checks if this key represents the same resource as another key.
// It compares the identifying fields: Group, Resource, Namespace, and Name.
// ResourceVersion, Action, and Folder are ignored as they don't identify the resource itself.
func (k DataKey) SameResource(other DataKey) bool {
	return k.Group == other.Group &&
		k.Resource == other.Resource &&
		k.Namespace == other.Namespace &&
		k.Name == other.Name
}

// GetResourceStats returns resource stats within the data store by first discovering
// all group/resource combinations, then issuing targeted list operations for each one.
// If namespace is provided, only keys matching that namespace are considered.
func (d *dataStore) GetResourceStats(ctx context.Context, namespace string, minCount int) ([]ResourceStats, error) {
	// First, get all unique group/resource combinations in the store
	groupResources, err := d.getGroupResources(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get group resources: %w", err)
	}

	var stats []ResourceStats

	// Process each group/resource combination
	for _, groupResource := range groupResources {
		groupStats, err := d.processGroupResourceStats(ctx, groupResource, namespace, minCount)
		if err != nil {
			return nil, fmt.Errorf("failed to process stats for %s/%s: %w", groupResource.Group, groupResource.Resource, err)
		}
		stats = append(stats, groupStats...)
	}

	return stats, nil
}

// processGroupResourceStats processes stats for a specific group/resource combination
func (d *dataStore) processGroupResourceStats(ctx context.Context, groupResource GroupResource, namespace string, minCount int) ([]ResourceStats, error) {
	// Use ListRequestKey to construct the appropriate prefix
	listKey := ListRequestKey{
		Group:     groupResource.Group,
		Resource:  groupResource.Resource,
		Namespace: namespace, // Empty string if not specified, which will list all namespaces
	}

	// Maps to track counts per namespace for this group/resource
	namespaceCounts := make(map[string]map[string]bool) // namespace -> resource name -> exists (not deleted)
	namespaceVersions := make(map[string]int64)         // namespace -> latest resource version

	// Track current resource being processed
	var currentResourceKey string
	var lastDataKey *DataKey

	// Helper function to process the last seen resource
	processLastResource := func() {
		if lastDataKey != nil {
			// Initialize maps if needed
			if _, exists := namespaceCounts[lastDataKey.Namespace]; !exists {
				namespaceCounts[lastDataKey.Namespace] = make(map[string]bool)
				namespaceVersions[lastDataKey.Namespace] = 0
			}

			// Track whether this resource name exists (not deleted)
			namespaceCounts[lastDataKey.Namespace][lastDataKey.Name] = lastDataKey.Action != DataActionDeleted

			// Update to latest resource version seen
			if lastDataKey.ResourceVersion > namespaceVersions[lastDataKey.Namespace] {
				namespaceVersions[lastDataKey.Namespace] = lastDataKey.ResourceVersion
			}
		}
	}

	// List all keys using the existing Keys method
	for dataKey, err := range d.Keys(ctx, listKey) {
		if err != nil {
			return nil, err
		}

		// Create unique resource identifier (namespace/group/resource/name)
		resourceKey := fmt.Sprintf("%s/%s/%s/%s", dataKey.Namespace, dataKey.Group, dataKey.Resource, dataKey.Name)

		// If we've moved to a different resource, process the previous one
		if currentResourceKey != "" && resourceKey != currentResourceKey {
			processLastResource()
		}

		// Update tracking variables for the current resource
		currentResourceKey = resourceKey
		lastDataKey = &dataKey
	}

	// Process the final resource
	processLastResource()

	// Convert namespace counts to ResourceStats
	var stats []ResourceStats
	for ns, names := range namespaceCounts {
		// Count how many names actually exist (not deleted)
		count := int64(0)
		for _, exists := range names {
			if exists {
				count++
			}
		}

		// Skip if count is below or equal to minimum
		if count <= int64(minCount) {
			continue
		}

		stats = append(stats, ResourceStats{
			NamespacedResource: NamespacedResource{
				Namespace: ns,
				Group:     groupResource.Group,
				Resource:  groupResource.Resource,
			},
			Count:           count,
			ResourceVersion: namespaceVersions[ns],
		})
	}

	return stats, nil
}

// getGroupResources returns all unique group/resource combinations in the data store.
// It efficiently discovers these by using the key ordering and PrefixRangeEnd to jump
// between different group/resource prefixes without iterating through all keys.
// Results are cached to improve performance.
func (d *dataStore) getGroupResources(ctx context.Context) ([]GroupResource, error) {
	// Check cache first
	if cached, found := d.cache.Get(groupResourcesCacheKey); found {
		if results, ok := cached.([]GroupResource); ok {
			return results, nil
		}
	}

	// Cache miss or invalid data, compute the results
	var results []GroupResource
	seenGroupResources := make(map[string]bool) // "group/resource" -> seen

	startKey := ""

	for {
		// List with limit 1 to get the next key
		var foundKey string
		var foundAny bool

		for key, err := range d.kv.Keys(ctx, dataSection, ListOptions{
			StartKey: startKey,
			Limit:    1,
			Sort:     SortOrderAsc,
		}) {
			if err != nil {
				return nil, err
			}
			foundKey = key
			foundAny = true
			break // Only process the first (and only) key
		}

		// If no key found, we're done
		if !foundAny {
			break
		}

		// Parse the key to extract group and resource
		dataKey, err := ParseKey(foundKey)
		if err != nil {
			return nil, fmt.Errorf("failed to parse key %s: %w", foundKey, err)
		}

		// Create the group/resource identifier
		groupResourceKey := fmt.Sprintf("%s/%s", dataKey.Group, dataKey.Resource)

		// Add to results if we haven't seen this group/resource combination before
		if !seenGroupResources[groupResourceKey] {
			results = append(results, GroupResource{
				Group:    dataKey.Group,
				Resource: dataKey.Resource,
			})
			seenGroupResources[groupResourceKey] = true
		}

		// Compute the next starting point by finding the end of this group/resource prefix
		groupResourcePrefix := fmt.Sprintf("%s/%s/", dataKey.Group, dataKey.Resource)
		nextStartKey := PrefixRangeEnd(groupResourcePrefix)

		// If we've reached the end of the key space, we're done
		if nextStartKey == "" {
			break
		}

		startKey = nextStartKey
	}

	// Cache the results using the default expiration (1 hour)
	d.cache.Set(groupResourcesCacheKey, results, gocache.DefaultExpiration)

	return results, nil
}
