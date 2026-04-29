package resource

import (
	"context"
	"embed"
	"errors"
	"fmt"
	"io"
	"iter"
	"math"
	"strings"
	"text/template"
	"time"

	"github.com/go-sql-driver/mysql"
	"github.com/grafana/dskit/backoff"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"

	"github.com/grafana/grafana/pkg/apimachinery/validation"
	kvpkg "github.com/grafana/grafana/pkg/storage/unified/resource/kv"
	"github.com/grafana/grafana/pkg/storage/unified/sql/db"
	"github.com/grafana/grafana/pkg/storage/unified/sql/dbutil"
	"github.com/grafana/grafana/pkg/storage/unified/sql/rvmanager"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/lib/pq"
	gocache "github.com/patrickmn/go-cache"

	"github.com/grafana/grafana/pkg/util/sqlite"
)

// Templates setup for backward-compatibility queries
var (
	//go:embed data/*.sql
	sqlTemplatesFS embed.FS

	sqlTemplates = template.Must(template.New("sql").ParseFS(sqlTemplatesFS, `data/*.sql`))
)

func mustTemplate(filename string) *template.Template {
	if t := sqlTemplates.Lookup(filename); t != nil {
		return t
	}
	panic(fmt.Sprintf("template file not found: %s", filename))
}

const (
	dataSection = kvpkg.DataSection
	// cache
	groupResourcesCacheKey = "group-resources"
	// batch operations
	dataBatchSize = 50 // default batch size for BatchGet operations
)

// dataStore is a data store that uses a KV store to store data.
type dataStore struct {
	kv            KV
	cache         *gocache.Cache
	legacyDialect sqltemplate.Dialect // TODO: remove when backwards compatibility is no longer needed.
	metrics       *kvBackendMetrics
}

type dataImportBatchWriter interface {
	InsertDataImportBatch(ctx context.Context, rows []kvpkg.DataImportRow) error
}

func newDataStore(kv KV, metrics *kvBackendMetrics) *dataStore {
	ds := &dataStore{
		kv:      kv,
		cache:   gocache.New(time.Hour, 10*time.Minute), // 1 hour expiration, 10 minute cleanup
		metrics: metrics,
	}

	if sqlkv, ok := kv.(*kvpkg.SqlKV); ok {
		ds.legacyDialect = sqltemplate.DialectForDriver(sqlkv.DriverName)
	}

	return ds
}

type DataObj struct {
	Key   DataKey
	Value io.ReadCloser
}

// TODO: pull DataKey from kv/sqlkv into here once we don't need sql/backend backwards compatibility
type DataKey = kvpkg.DataKey

// GroupResource represents a unique group/resource combination
type GroupResource struct {
	Group    string
	Resource string
}

// TODO transform this into Validate() method on DataKey once we pull that struct back here
func validateDataKey(dataKey DataKey) error {
	if dataKey.ResourceVersion <= 0 {
		return NewValidationError("resourceVersion", fmt.Sprintf("%d", dataKey.ResourceVersion), ErrResourceVersionInvalid)
	}
	if dataKey.Action == "" {
		return NewValidationError("action", string(dataKey.Action), ErrActionRequired)
	}

	// Validate naming conventions for all required fields
	if dataKey.Namespace != "" {
		if err := validation.IsValidNamespace(dataKey.Namespace); err != nil {
			return NewValidationError("namespace", dataKey.Namespace, err[0])
		}
	}
	if err := validation.IsValidGroup(dataKey.Group); err != nil {
		return NewValidationError("group", dataKey.Group, err[0])
	}
	if err := validation.IsValidResource(dataKey.Resource); err != nil {
		return NewValidationError("resource", dataKey.Resource, err[0])
	}
	if err := validation.IsValidGrafanaName(dataKey.Name); err != nil {
		return NewValidationError("name", dataKey.Name, err[0])
	}

	// Validate folder field if provided (optional field)
	if dataKey.Folder != "" {
		if err := validation.IsValidGrafanaName(dataKey.Folder); err != nil {
			return NewValidationError("folder", dataKey.Folder, err[0])
		}
	}

	// Validate action is one of the valid values
	switch dataKey.Action {
	case DataActionCreated, DataActionUpdated, DataActionDeleted:
		return nil
	default:
		return fmt.Errorf("action '%s' is invalid: must be one of 'created', 'updated', or 'deleted'", dataKey.Action)
	}
}

type ListRequestKey struct {
	Group     string
	Resource  string
	Namespace string
	Name      string // optional for listing multiple resources
}

func (k ListRequestKey) Validate() error {
	if k.Namespace != "" {
		if err := validation.IsValidNamespace(k.Namespace); err != nil {
			return NewValidationError("namespace", k.Namespace, err[0])
		}
	}
	if err := validation.IsValidGroup(k.Group); err != nil {
		return NewValidationError("group", k.Group, err[0])
	}
	if err := validation.IsValidResource(k.Resource); err != nil {
		return NewValidationError("resource", k.Resource, err[0])
	}

	return nil
}

func (k ListRequestKey) Prefix() string {
	if k.Namespace == "" {
		if k.Name == "" {
			return fmt.Sprintf("%s/%s/", k.Group, k.Resource)
		}
		return fmt.Sprintf("%s/%s/%s/", k.Group, k.Resource, k.Name)
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
	if k.Namespace != "" {
		if err := validation.IsValidNamespace(k.Namespace); err != nil {
			return NewValidationError("namespace", k.Namespace, err[0])
		}
	}
	if err := validation.IsValidGroup(k.Group); err != nil {
		return NewValidationError("group", k.Group, err[0])
	}
	if err := validation.IsValidResource(k.Resource); err != nil {
		return NewValidationError("resource", k.Resource, err[0])
	}
	if err := validation.IsValidGrafanaName(k.Name); err != nil {
		return NewValidationError("name", k.Name, err[0])
	}

	return nil
}

// Prefix returns the prefix for getting a specific data object
func (k GetRequestKey) Prefix() string {
	if k.Namespace == "" {
		return fmt.Sprintf("%s/%s/%s/", k.Group, k.Resource, k.Name)
	}
	return fmt.Sprintf("%s/%s/%s/%s/", k.Group, k.Resource, k.Namespace, k.Name)
}

const (
	DataActionCreated = kvpkg.DataActionCreated
	DataActionUpdated = kvpkg.DataActionUpdated
	DataActionDeleted = kvpkg.DataActionDeleted
)

// Keys returns all keys for a given key by iterating through the KV store
func (d *dataStore) Keys(ctx context.Context, key ListRequestKey, sort SortOrder) iter.Seq2[DataKey, error] {
	if err := key.Validate(); err != nil {
		return func(yield func(DataKey, error) bool) {
			yield(DataKey{}, err)
		}
	}
	ctx, span := tracer.Start(ctx, "resource.dataStore.Keys")
	prefix := key.Prefix()
	return func(yield func(DataKey, error) bool) {
		defer span.End()
		for k, err := range d.kv.Keys(ctx, dataSection, ListOptions{
			StartKey: prefix,
			EndKey:   PrefixRangeEnd(prefix),
			Sort:     sort,
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
	if key.Group == "" || key.Resource == "" || key.Name == "" {
		return DataKey{}, fmt.Errorf("group, resource or name is empty")
	}

	ctx, span := tracer.Start(ctx, "resource.dataStore.LastResourceVersion")
	defer span.End()

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

// GetLatestAndPredecessor returns the latest resource version and its immediate predecessor
// in a single atomic operation. Returns (latest, predecessor, error).
// If there's only one version, predecessor will be an empty DataKey (ResourceVersion == 0).
func (d *dataStore) GetLatestAndPredecessor(ctx context.Context, key ListRequestKey) (DataKey, DataKey, error) {
	if err := key.Validate(); err != nil {
		return DataKey{}, DataKey{}, fmt.Errorf("invalid data key: %w", err)
	}
	if key.Group == "" || key.Resource == "" || key.Name == "" {
		return DataKey{}, DataKey{}, fmt.Errorf("group, resource or name is empty")
	}

	ctx, span := tracer.Start(ctx, "resource.dataStore.GetLatestAndPredecessor")
	defer span.End()

	prefix := key.Prefix()
	var latest, predecessor DataKey
	count := 0
	for k, err := range d.kv.Keys(ctx, dataSection, ListOptions{
		StartKey: prefix,
		EndKey:   PrefixRangeEnd(prefix),
		Limit:    2, // Get latest and predecessor
		Sort:     SortOrderDesc,
	}) {
		if err != nil {
			return DataKey{}, DataKey{}, err
		}
		parsedKey, err := ParseKey(k)
		if err != nil {
			return DataKey{}, DataKey{}, err
		}
		switch count {
		case 0:
			latest = parsedKey
		case 1:
			predecessor = parsedKey
		}
		count++
	}
	if count == 0 {
		return DataKey{}, DataKey{}, ErrNotFound
	}
	if count == 1 {
		return latest, DataKey{}, nil
	}
	return latest, predecessor, nil
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

	ctx, span := tracer.Start(ctx, "resource.dataStore.GetResourceKeyAtRevision", trace.WithAttributes(
		attribute.Int64("resourceVersion", rv),
	))
	defer span.End()

	listKey := ListRequestKey(key)

	iter := d.ListResourceKeysAtRevision(ctx, ListRequestOptions{Key: listKey, ResourceVersion: rv})
	for dataKey, err := range iter {
		if err != nil {
			return DataKey{}, err
		}
		return dataKey, nil
	}
	return DataKey{}, ErrNotFound
}

type ListRequestOptions struct {
	// Key defines the range to query (Group/Resource/Namespace/Name prefix).
	Key ListRequestKey
	// ContinueNamespace is the namespace to continue from.
	// Only used when Key.Namespace is empty (cross-namespace query).
	ContinueNamespace string
	// ContinueName is the name to continue from.
	ContinueName    string
	ResourceVersion int64
}

// Validate checks that the ListRequestOptions are valid.
func (o ListRequestOptions) Validate() error {
	if err := o.Key.Validate(); err != nil {
		return fmt.Errorf("invalid list request key: %w", err)
	}
	// ContinueNamespace is only valid for cross-namespace queries
	if o.ContinueNamespace != "" && o.Key.Namespace != "" {
		return fmt.Errorf("continue namespace %q not allowed when request namespace is set to %q", o.ContinueNamespace, o.Key.Namespace)
	}
	return nil
}

// ListLatestResourceKeys returns an iterator over the data keys for the latest versions of resources.
// Only returns keys for resources that are not deleted.
func (d *dataStore) ListLatestResourceKeys(ctx context.Context, key ListRequestKey) iter.Seq2[DataKey, error] {
	return d.ListResourceKeysAtRevision(ctx, ListRequestOptions{
		Key: key,
	})
}

// ListResourceKeysAtRevision returns an iterator over data keys for resources at a specific revision.
// If rv is 0, it returns the latest versions. Only returns keys for resources that are not deleted at the given revision.
func (d *dataStore) ListResourceKeysAtRevision(ctx context.Context, options ListRequestOptions) iter.Seq2[DataKey, error] {
	if err := options.Validate(); err != nil {
		return func(yield func(DataKey, error) bool) {
			yield(DataKey{}, err)
		}
	}

	rv := options.ResourceVersion
	prefix := options.Key.Prefix()

	startKey := prefix
	if options.ContinueName != "" {
		// Build the start key from the continue position
		continueKey := ListRequestKey{
			Group:     options.Key.Group,
			Resource:  options.Key.Resource,
			Namespace: options.Key.Namespace,
			Name:      options.ContinueName,
		}
		// For cross-namespace queries, use the continue namespace
		if options.Key.Namespace == "" && options.ContinueNamespace != "" {
			continueKey.Namespace = options.ContinueNamespace
		}
		startKey = continueKey.Prefix()
	}

	listOptions := ListOptions{
		StartKey: startKey,
		EndKey:   PrefixRangeEnd(prefix),
		Sort:     SortOrderAsc,
	}

	if rv == 0 {
		rv = math.MaxInt64
	}

	ctx, span := tracer.Start(ctx, "resource.dataStore.ListResourceKeysAtRevision", trace.WithAttributes(
		attribute.Int64("resourceVersion", rv),
	))

	// List all keys in the prefix.
	iter := d.kv.Keys(ctx, dataSection, listOptions)

	return func(yield func(DataKey, error) bool) {
		defer span.End()
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
	if err := validateDataKey(key); err != nil {
		return nil, fmt.Errorf("invalid data key: %w", err)
	}

	ctx, span := tracer.Start(ctx, "resource.dataStore.Get")
	defer span.End()

	bo := backoff.New(ctx, datastoreRetryBackoff)
	for attempt := 1; ; attempt++ {
		raw, err := d.kv.Get(ctx, dataSection, key.String())
		if err == nil {
			return raw, nil
		}
		if errors.Is(err, kvpkg.ErrRetryable) && attempt < maxKvGetRetryAttempts {
			getRetryLogger.Warn("kv Get retrying after retryable error",
				"attempt", attempt,
				"key", key.String(),
				"error", err,
			)
			bo.Wait()
			if boErr := bo.Err(); boErr != nil {
				return nil, boErr
			}
			continue
		}
		if errors.Is(err, kvpkg.ErrRetryable) {
			getRetryLogger.Warn("kv Get retry budget exhausted",
				"attempts", attempt,
				"key", key.String(),
				"error", err,
			)
		}
		return nil, err
	}
}

// BatchGet retrieves multiple data objects in batches.
// It returns an iterator that yields DataObj results for the given keys.
// Keys are processed in batches (default 50).
// Non-existent entries will not appear in the result.
func (d *dataStore) BatchGet(ctx context.Context, keys []DataKey) iter.Seq2[DataObj, error] {
	ctx, span := tracer.Start(ctx, "resource.dataStore.BatchGet", trace.WithAttributes(
		attribute.Int("batchSize", len(keys)),
	))
	return func(yield func(DataObj, error) bool) {
		defer span.End()
		// Validate all keys first
		for _, key := range keys {
			if err := validateDataKey(key); err != nil {
				yield(DataObj{}, fmt.Errorf("invalid data key %s: %w", key.String(), err))
				return
			}
		}

		// Process keys in batches
		for i := 0; i < len(keys); i += dataBatchSize {
			end := i + dataBatchSize
			if end > len(keys) {
				end = len(keys)
			}
			batch := keys[i:end]

			// Convert DataKeys to string keys and create a mapping
			stringKeys := make([]string, len(batch))
			keyMap := make(map[string]DataKey) // map string key back to DataKey
			for j, key := range batch {
				strKey := key.String()
				stringKeys[j] = strKey
				keyMap[strKey] = key
			}

			// Call kv.BatchGet for this batch
			for kv, err := range d.kv.BatchGet(ctx, dataSection, stringKeys) {
				if err != nil {
					yield(DataObj{}, err)
					return
				}

				// Look up the original DataKey
				dataKey, ok := keyMap[kv.Key]
				if !ok {
					yield(DataObj{}, fmt.Errorf("unexpected key in batch response: %s", kv.Key))
					return
				}

				// Yield the DataObj
				if !yield(DataObj{
					Key:   dataKey,
					Value: kv.Value,
				}, nil) {
					return
				}
			}
		}
	}
}

func (d *dataStore) Save(ctx context.Context, key DataKey, value io.Reader) error {
	if err := validateDataKey(key); err != nil {
		return fmt.Errorf("invalid data key: %w", err)
	}

	ctx, span := tracer.Start(ctx, "resource.dataStore.Save", trace.WithAttributes(
		attribute.String("action", string(key.Action)),
	))
	defer span.End()

	var writer io.WriteCloser
	var err error
	if key.GUID != "" {
		writer, err = d.kv.Save(ctx, dataSection, key.StringWithGUID())
	} else {
		writer, err = d.kv.Save(ctx, dataSection, key.String())
	}
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

func (d *dataStore) insertDataImportBatch(ctx context.Context, rows []kvpkg.DataImportRow) (bool, error) {
	ctx, span := tracer.Start(ctx, "resource.dataStore.insertDataImportBatch", trace.WithAttributes(
		attribute.Int("batchSize", len(rows)),
	))
	defer span.End()

	writer, ok := d.kv.(dataImportBatchWriter)
	if !ok {
		return false, nil
	}

	return true, writer.InsertDataImportBatch(ctx, rows)
}

func (d *dataStore) Delete(ctx context.Context, key DataKey) error {
	if err := validateDataKey(key); err != nil {
		return fmt.Errorf("invalid data key: %w", err)
	}

	ctx, span := tracer.Start(ctx, "resource.dataStore.Delete")
	defer span.End()

	return d.kv.Delete(ctx, dataSection, key.String())
}

func (n *dataStore) batchDelete(ctx context.Context, keys []DataKey) error {
	ctx, span := tracer.Start(ctx, "resource.dataStore.batchDelete", trace.WithAttributes(
		attribute.Int("batchSize", len(keys)),
	))
	defer span.End()

	for len(keys) > 0 {
		batch := keys
		if len(batch) > dataBatchSize {
			batch = batch[:dataBatchSize]
		}

		keys = keys[len(batch):]
		stringKeys := make([]string, 0, len(batch))
		for _, dataKey := range batch {
			stringKeys = append(stringKeys, dataKey.String())
		}

		if err := n.kv.BatchDelete(ctx, dataSection, stringKeys); err != nil {
			return err
		}
	}

	return nil
}

// ParseKey parses a string key into a DataKey struct
func ParseKey(key string) (DataKey, error) {
	parts := strings.Split(key, "/")
	dk, _, err := kvpkg.ParseDataKeyParts(parts)
	if err != nil {
		return DataKey{}, fmt.Errorf("invalid key: %s: %w", key, err)
	}
	return dk, nil
}

// GetResourceStats returns resource stats within the data store by first discovering
// all group/resource combinations, then issuing targeted list operations for each one.
// If namespace is provided, only keys matching that namespace are considered.
func (d *dataStore) GetResourceStats(ctx context.Context, nsr NamespacedResource, minCount int) ([]ResourceStats, error) {
	ctx, span := tracer.Start(ctx, "resource.dataStore.GetResourceStats", trace.WithAttributes(
		attribute.Int("minCount", minCount),
	))
	defer span.End()

	// First, get all unique group/resource combinations in the store
	groupResources, err := d.getGroupResources(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get group resources: %w", err)
	}

	var stats []ResourceStats

	// Process each group/resource combination
	for _, groupResource := range groupResources {
		if nsr.Group != "" && groupResource.Group != nsr.Group {
			continue
		}
		if nsr.Resource != "" && groupResource.Resource != nsr.Resource {
			continue
		}
		groupStats, err := d.processGroupResourceStats(ctx, groupResource, nsr.Namespace, minCount)
		if err != nil {
			return nil, fmt.Errorf("failed to process stats for %s/%s: %w", groupResource.Group, groupResource.Resource, err)
		}
		stats = append(stats, groupStats...)
	}

	return stats, nil
}

// processGroupResourceStats processes stats for a specific group/resource combination
func (d *dataStore) processGroupResourceStats(ctx context.Context, groupResource GroupResource, namespace string, minCount int) ([]ResourceStats, error) {
	ctx, span := tracer.Start(ctx, "resource.dataStore.processGroupResourceStats")
	defer span.End()

	// Use ListRequestKey to construct the appropriate prefix
	listKey := ListRequestKey{
		Group:     groupResource.Group,
		Resource:  groupResource.Resource,
		Namespace: namespace, // Empty string if not specified, which will list all namespaces
	}

	// Maps to track counts per namespace for this group/resource
	namespaceCounts := make(map[string]int64)   // namespace -> count of existing resources
	namespaceVersions := make(map[string]int64) // namespace -> latest resource version

	// Track current resource being processed
	var currentResourceKey string
	var lastDataKey *DataKey

	// Helper function to process the last seen resource
	processLastResource := func() {
		if lastDataKey != nil {
			// Initialize namespace version if not exists
			if _, exists := namespaceVersions[lastDataKey.Namespace]; !exists {
				namespaceVersions[lastDataKey.Namespace] = 0
			}

			// If resource exists (not deleted), increment the count for this namespace
			if lastDataKey.Action != DataActionDeleted {
				namespaceCounts[lastDataKey.Namespace]++
			}

			// Update to latest resource version seen
			if lastDataKey.ResourceVersion > namespaceVersions[lastDataKey.Namespace] {
				namespaceVersions[lastDataKey.Namespace] = lastDataKey.ResourceVersion
			}
		}
	}

	// List all keys using the existing Keys method
	for dataKey, err := range d.Keys(ctx, listKey, SortOrderAsc) {
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
	stats := make([]ResourceStats, 0, len(namespaceCounts))
	for ns, count := range namespaceCounts {
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
	ctx, span := tracer.Start(ctx, "resource.dataStore.getGroupResources")
	defer span.End()

	// Check cache first
	if cached, found := d.cache.Get(groupResourcesCacheKey); found {
		if cachedResults, ok := cached.([]GroupResource); ok {
			span.SetAttributes(attribute.Bool("cacheHit", true))
			return cachedResults, nil
		}
	}

	// Cache miss or invalid data, compute the results
	results := make([]GroupResource, 0)
	seenGroupResources := make(map[string]bool) // "group/resource" -> seen

	startKey := ""

	for {
		// List with limit 1 to get the next key
		var foundKey string

		for key, err := range d.kv.Keys(ctx, dataSection, ListOptions{
			StartKey: startKey,
			Limit:    1,
			Sort:     SortOrderAsc,
		}) {
			if err != nil {
				return nil, err
			}
			foundKey = key
			break // Only process the first (and only) key
		}

		// If no key found, we're done
		if foundKey == "" {
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
			seenGroupResources[groupResourceKey] = true
			//nolint:staticcheck // SA4010: wrongly assumes that this result of append is never used
			results = append(results, GroupResource{
				Group:    dataKey.Group,
				Resource: dataKey.Resource,
			})
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

// TODO: remove when backwards compatibility is no longer needed.
var (
	sqlKVUpdateLegacyResourceHistory = mustTemplate("sqlkv_update_legacy_resource_history.sql")
	sqlKVInsertLegacyResource        = mustTemplate("sqlkv_insert_legacy_resource.sql")
	sqlKVUpdateLegacyResource        = mustTemplate("sqlkv_update_legacy_resource.sql")
	sqlKVDeleteLegacyResource        = mustTemplate("sqlkv_delete_legacy_resource.sql")

	// Bulk backwards compatibility templates
	sqlKVDeleteLegacyResourceCollection  = mustTemplate("sqlkv_delete_legacy_resource_collection.sql")
	sqlKVInsertLegacyResourceFromHistory = mustTemplate("sqlkv_insert_legacy_resource_from_history.sql")
)

// TODO: remove when backwards compatibility is no longer needed.
type sqlKVLegacySaveRequest struct {
	sqltemplate.SQLTemplate
	GUID       string
	Group      string
	Resource   string
	Namespace  string
	Name       string
	Action     int64
	Folder     string
	PreviousRV int64
}

func (req sqlKVLegacySaveRequest) Validate() error {
	return nil
}

// TODO: remove when backwards compatibility is no longer needed.
type sqlKVLegacyUpdateHistoryRequest struct {
	sqltemplate.SQLTemplate
	GUID       string
	PreviousRV int64
	Generation int64
}

func (req sqlKVLegacyUpdateHistoryRequest) Validate() error {
	return nil
}

// TODO: remove when backwards compatibility is no longer needed.
type sqlKVLegacyCollectionRequest struct {
	sqltemplate.SQLTemplate
	Namespace string
	Group     string
	Resource  string
}

func (req sqlKVLegacyCollectionRequest) Validate() error {
	return nil
}

// applyBackwardsCompatibleChanges updates the `resource` and `resource_history` tables
// to make sure the sqlkv implementation is backwards-compatible with the existing sql backend.
// Specifically, it will update the `resource_history` table to include the previous resource version
// and generation, which come from the `WriteEvent`, and also make the corresponding change on the
// `resource` table, no longer used in the storage backend.
//
// TODO: remove when backwards compatibility is no longer needed.
func (d *dataStore) applyBackwardsCompatibleChanges(ctx context.Context, tx db.Tx, event WriteEvent, key DataKey) error {
	_, isSQLKV := d.kv.(*kvpkg.SqlKV)
	if !isSQLKV {
		return nil
	}

	ctx, span := tracer.Start(ctx, "resource.dataStore.applyBackwardsCompatibleChanges", trace.WithAttributes(
		attribute.String("action", string(key.Action)),
	))
	defer span.End()

	generation := event.Object.GetGeneration()
	if key.Action == DataActionDeleted {
		generation = 0
	}

	// In compatibility mode, the previous RV, when available, is saved as a microsecond
	// timestamp, as is done in the SQL backend.
	previousRV := event.PreviousRV
	if event.PreviousRV > 0 && IsSnowflake(event.PreviousRV) {
		previousRV = rvmanager.RVFromSnowflake(event.PreviousRV)
	}

	// fill in remaining required fields for backwards compatibility: previous_resource_version and generation
	_, err := dbutil.Exec(ctx, tx, sqlKVUpdateLegacyResourceHistory, sqlKVLegacyUpdateHistoryRequest{
		SQLTemplate: sqltemplate.New(d.legacyDialect),
		GUID:        key.GUID,
		PreviousRV:  previousRV,
		Generation:  generation,
	})

	if err != nil {
		return fmt.Errorf("compatibility layer: failed to update resource_history: %w", err)
	}

	action, err := kvpkg.LegacyActionValue(key.Action)
	if err != nil {
		return err
	}

	switch key.Action {
	case DataActionCreated:
		_, err := dbutil.Exec(ctx, tx, sqlKVInsertLegacyResource, sqlKVLegacySaveRequest{
			SQLTemplate: sqltemplate.New(d.legacyDialect),
			GUID:        key.GUID,
			Group:       key.Group,
			Resource:    key.Resource,
			Namespace:   key.Namespace,
			Name:        key.Name,
			Action:      action,
			Folder:      key.Folder,
			PreviousRV:  previousRV,
		})

		if err != nil {
			if isRowAlreadyExistsError(err) {
				// This can only happen if a concurrent write was attempted: the validation in
				// WriteEvent guarantees that we return early when the resource already exists
				// before entering the transaction.
				d.metrics.recordConflict(event)
				return conflictError(event, "concurrent create attempts detected")
			}
			return fmt.Errorf("compatibility layer: failed to insert to resource: %w", err)
		}
	case DataActionUpdated:
		res, err := dbutil.Exec(ctx, tx, sqlKVUpdateLegacyResource, sqlKVLegacySaveRequest{
			SQLTemplate: sqltemplate.New(d.legacyDialect),
			GUID:        key.GUID,
			Group:       key.Group,
			Resource:    key.Resource,
			Namespace:   key.Namespace,
			Name:        key.Name,
			Action:      action,
			Folder:      key.Folder,
			PreviousRV:  previousRV,
		})

		if err != nil {
			return fmt.Errorf("compatibility layer: failed to update resource: %w", err)
		}
		if isConflict, err := checkLegacyCASConflict(res, event, key); err != nil {
			if isConflict {
				d.metrics.recordConflict(event)
			}
			return err
		}
	case DataActionDeleted:
		res, err := dbutil.Exec(ctx, tx, sqlKVDeleteLegacyResource, sqlKVLegacySaveRequest{
			SQLTemplate: sqltemplate.New(d.legacyDialect),
			Group:       key.Group,
			Resource:    key.Resource,
			Namespace:   key.Namespace,
			Name:        key.Name,
			PreviousRV:  previousRV,
		})

		if err != nil {
			return fmt.Errorf("compatibility layer: failed to delete from resource: %w", err)
		}
		if isConflict, err := checkLegacyCASConflict(res, event, key); err != nil {
			if isConflict {
				d.metrics.recordConflict(event)
			}
			return err
		}
	}

	return nil
}

func checkLegacyCASConflict(res db.Result, event WriteEvent, key DataKey) (bool, error) {
	rows, err := res.RowsAffected()
	if err != nil {
		return false, fmt.Errorf("compatibility layer: failed to verify optimistic lock result: %w", err)
	}
	if rows == 1 {
		return false, nil
	}
	if rows > 1 {
		return false, fmt.Errorf("compatibility layer: unexpected rows affected: %d", rows)
	}

	return true, conflictError(event, "requested RV does not match current RV")
}

func isRowAlreadyExistsError(err error) bool {
	if sqlite.IsUniqueConstraintViolation(err) {
		return true
	}

	var pg *pgconn.PgError
	if errors.As(err, &pg) {
		return pg.Code == "23505"
	}

	var pqerr *pq.Error
	if errors.As(err, &pqerr) {
		return pqerr.Code == "23505"
	}

	var mysqlerr *mysql.MySQLError
	if errors.As(err, &mysqlerr) {
		return mysqlerr.Number == 1062
	}

	return false
}

// deleteLegacyResourceCollection deletes all rows from the `resource` table for a given collection.
// This is used during the delete phase of ProcessBulk to clear legacy resource rows before re-importing.
// TODO: remove when backwards compatibility is no longer needed.
func (d *dataStore) deleteLegacyResourceCollection(ctx context.Context, execer db.ContextExecer, namespace, group, resource string) error {
	_, isSQLKV := d.kv.(*kvpkg.SqlKV)
	if !isSQLKV {
		return nil
	}

	ctx, span := tracer.Start(ctx, "resource.dataStore.deleteLegacyResourceCollection")
	defer span.End()

	_, err := dbutil.Exec(ctx, execer, sqlKVDeleteLegacyResourceCollection, sqlKVLegacyCollectionRequest{
		SQLTemplate: sqltemplate.New(d.legacyDialect),
		Namespace:   namespace,
		Group:       group,
		Resource:    resource,
	})
	if err != nil {
		return fmt.Errorf("compatibility layer: failed to delete legacy resource collection: %w", err)
	}
	return nil
}

// syncLegacyResourceFromHistory populates the `resource` table from `resource_history` for a given collection.
// It selects the latest version of each resource (excluding deletes) and inserts them into the `resource` table.
// TODO: remove when backwards compatibility is no longer needed.
func (d *dataStore) syncLegacyResourceFromHistory(ctx context.Context, execer db.ContextExecer, namespace, group, resource string) error {
	_, isSQLKV := d.kv.(*kvpkg.SqlKV)
	if !isSQLKV {
		return nil
	}

	ctx, span := tracer.Start(ctx, "resource.dataStore.syncLegacyResourceFromHistory")
	defer span.End()

	_, err := dbutil.Exec(ctx, execer, sqlKVInsertLegacyResourceFromHistory, sqlKVLegacyCollectionRequest{
		SQLTemplate: sqltemplate.New(d.legacyDialect),
		Namespace:   namespace,
		Group:       group,
		Resource:    resource,
	})
	if err != nil {
		return fmt.Errorf("compatibility layer: failed to sync legacy resource from history: %w", err)
	}
	return nil
}

// IsSnowflake returns whether the argument passed is a snowflake ID (new) or a microsecond timestamp (old).
// Snowflake IDs always have 19 digits. A 19-digit microsecond timestamp (10^18 µs) would correspond
// to year ~33658, so any number with fewer than 19 digits is unambiguously a legacy microsecond timestamp.
func IsSnowflake(rv int64) bool {
	return rv >= 1e18
}
