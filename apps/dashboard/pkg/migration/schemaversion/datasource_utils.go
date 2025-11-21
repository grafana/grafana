package schemaversion

import (
	"context"
	"sync"
	"time"
)

// Shared utility functions for datasource migrations across different schema versions.
// These functions handle the common logic for migrating datasource references from
// string names/UIDs to structured reference objects with uid, type, and apiVersion.

// cachedIndexProvider wraps a DataSourceIndexProvider with time-based caching.
// This prevents multiple DB queries and index builds during operations that may call
// provider.Index() multiple times (e.g., dashboard conversions with many datasource lookups).
// The cache expires after 10 seconds, allowing it to be used as a long-lived singleton
// while still refreshing periodically.
//
// Thread-safe: Uses sync.RWMutex to guarantee safe concurrent access.
type cachedIndexProvider struct {
	provider DataSourceIndexProvider
	mu       sync.RWMutex
	index    *DatasourceIndex
	cachedAt time.Time
	cacheTTL time.Duration
}

// Index returns the cached index if it's still valid (< 10s old), otherwise rebuilds it.
// Uses RWMutex for efficient concurrent reads when cache is valid.
func (p *cachedIndexProvider) Index(ctx context.Context) *DatasourceIndex {
	// Fast path: check if cache is still valid using read lock
	p.mu.RLock()
	if p.index != nil && time.Since(p.cachedAt) < p.cacheTTL {
		idx := p.index
		p.mu.RUnlock()
		return idx
	}
	p.mu.RUnlock()

	// Slow path: cache expired or not yet built, acquire write lock
	p.mu.Lock()
	defer p.mu.Unlock()

	// Double-check: another goroutine might have refreshed the cache
	// while we were waiting for the write lock
	if p.index != nil && time.Since(p.cachedAt) < p.cacheTTL {
		return p.index
	}

	// Rebuild the cache
	p.index = p.provider.Index(ctx)
	p.cachedAt = time.Now()
	return p.index
}

// WrapIndexProviderWithCache wraps a provider to cache the index with a 10-second TTL.
// Useful for conversions or migrations that may call provider.Index() multiple times.
// The cache expires after 10 seconds, making it suitable for use as a long-lived singleton
// at the top level of dependency injection while still refreshing periodically.
//
// Example usage in dashboard conversion:
//
//	cachedDsIndexProvider := schemaversion.WrapIndexProviderWithCache(dsIndexProvider)
//	// Now all calls to cachedDsIndexProvider.Index(ctx) return the same cached index
//	// for up to 10 seconds before refreshing
func WrapIndexProviderWithCache(provider DataSourceIndexProvider) DataSourceIndexProvider {
	if provider == nil {
		return nil
	}
	return &cachedIndexProvider{
		provider: provider,
		cacheTTL: 10 * time.Second,
	}
}

// DatasourceIndex provides O(1) lookup of datasources by name or UID.
type DatasourceIndex struct {
	ByName    map[string]*DataSourceInfo
	ByUID     map[string]*DataSourceInfo
	DefaultDS *DataSourceInfo
}

// NewDatasourceIndex creates an index from a list of datasources.
// Iterates once through the list to build name and UID maps for O(1) lookups.
func NewDatasourceIndex(datasources []DataSourceInfo) *DatasourceIndex {
	idx := &DatasourceIndex{
		ByName: make(map[string]*DataSourceInfo, len(datasources)),
		ByUID:  make(map[string]*DataSourceInfo, len(datasources)),
	}

	for i := range datasources {
		ds := &datasources[i]

		// Index by name if present
		if ds.Name != "" {
			idx.ByName[ds.Name] = ds
		}

		// Index by UID if present
		if ds.UID != "" {
			idx.ByUID[ds.UID] = ds
		}

		// Track default datasource
		if ds.Default {
			idx.DefaultDS = ds
		}
	}

	return idx
}

// Lookup finds a datasource by name or UID string.
// Returns the datasource info if found, nil otherwise.
func (idx *DatasourceIndex) Lookup(nameOrUID string) *DataSourceInfo {
	// Try name first (most common in legacy dashboards)
	if ds := idx.ByName[nameOrUID]; ds != nil {
		return ds
	}
	// Try UID second
	return idx.ByUID[nameOrUID]
}

func (idx *DatasourceIndex) LookupByUID(uid string) *DataSourceInfo {
	return idx.ByUID[uid]
}

func (idx *DatasourceIndex) LookupByName(name string) *DataSourceInfo {
	return idx.ByName[name]
}

// GetDefault returns the default datasource, if one exists.
func (idx *DatasourceIndex) GetDefault() *DataSourceInfo {
	return idx.DefaultDS
}

// GetDataSourceRef creates a datasource reference object with uid, type and optional apiVersion
func GetDataSourceRef(ds *DataSourceInfo) map[string]interface{} {
	if ds == nil {
		return nil
	}
	ref := map[string]interface{}{
		"uid":  ds.UID,
		"type": ds.Type,
	}
	if ds.APIVersion != "" {
		ref["apiVersion"] = ds.APIVersion
	}
	return ref
}

// isDataSourceRef checks if the object is a valid DataSourceRef (has uid or type)
// Matches the frontend isDataSourceRef function in datasource.ts
func isDataSourceRef(ref interface{}) bool {
	dsRef, ok := ref.(map[string]interface{})
	if !ok {
		return false
	}

	hasUID := false
	if uid, exists := dsRef["uid"]; exists {
		if uidStr, ok := uid.(string); ok && uidStr != "" {
			hasUID = true
		}
	}

	hasType := false
	if typ, exists := dsRef["type"]; exists {
		if typStr, ok := typ.(string); ok && typStr != "" {
			hasType = true
		}
	}

	return hasUID || hasType
}

// MigrateDatasourceNameToRef converts a datasource name/uid string to a reference object
// Matches the frontend migrateDatasourceNameToRef function in DashboardMigrator.ts
// Options:
//   - returnDefaultAsNull: if true, returns nil for "default" datasources (used in V33)
//   - returnDefaultAsNull: if false, returns reference for "default" datasources (used in V36)
func MigrateDatasourceNameToRef(nameOrRef interface{}, options map[string]bool, index *DatasourceIndex) map[string]interface{} {
	if options["returnDefaultAsNull"] && (nameOrRef == nil || nameOrRef == "default") {
		return nil
	}

	// Frontend: if (isDataSourceRef(nameOrRef)) { return nameOrRef; }
	if isDataSourceRef(nameOrRef) {
		return nameOrRef.(map[string]interface{})
	}

	// Look up datasource by name/UID
	if nameOrRef == nil || nameOrRef == "default" {
		if ds := index.GetDefault(); ds != nil {
			return GetDataSourceRef(ds)
		}
	}

	// Check if it's a string name/UID
	if str, ok := nameOrRef.(string); ok {
		// Handle empty string case
		if str == "" {
			// Empty string should return {} (frontend behavior)
			return map[string]interface{}{}
		}

		if ds := index.Lookup(str); ds != nil {
			return GetDataSourceRef(ds)
		}

		// Unknown datasource name should be preserved as UID-only reference
		return map[string]interface{}{
			"uid": str,
		}
	}

	return nil
}

// cachedLibraryElementProvider wraps a LibraryElementIndexProvider with time-based caching.
// This prevents multiple DB queries during operations that may call GetLibraryElementInfo()
// multiple times (e.g., dashboard conversions with many library panel lookups).
// The cache expires after 10 seconds, allowing it to be used as a long-lived singleton
// while still refreshing periodically.
//
// Thread-safe: Uses sync.RWMutex to guarantee safe concurrent access.
type cachedLibraryElementProvider struct {
	provider LibraryElementIndexProvider
	mu       sync.RWMutex
	elements []LibraryElementInfo
	cachedAt time.Time
	cacheTTL time.Duration
}

// GetLibraryElementInfo returns the cached library elements if they're still valid (< 10s old), otherwise rebuilds the cache.
// Uses RWMutex for efficient concurrent reads when cache is valid.
func (p *cachedLibraryElementProvider) GetLibraryElementInfo(ctx context.Context) []LibraryElementInfo {
	// Fast path: check if cache is still valid using read lock
	p.mu.RLock()
	if p.elements != nil && time.Since(p.cachedAt) < p.cacheTTL {
		elements := p.elements
		p.mu.RUnlock()
		return elements
	}
	p.mu.RUnlock()

	// Slow path: cache expired or not yet built, acquire write lock
	p.mu.Lock()
	defer p.mu.Unlock()

	// Double-check: another goroutine might have refreshed the cache
	// while we were waiting for the write lock
	if p.elements != nil && time.Since(p.cachedAt) < p.cacheTTL {
		return p.elements
	}

	// Rebuild the cache
	p.elements = p.provider.GetLibraryElementInfo(ctx)
	p.cachedAt = time.Now()
	return p.elements
}

// WrapLibraryElementProviderWithCache wraps a provider to cache library elements with a 10-second TTL.
// Useful for conversions or migrations that may call GetLibraryElementInfo() multiple times.
// The cache expires after 10 seconds, making it suitable for use as a long-lived singleton
// at the top level of dependency injection while still refreshing periodically.
func WrapLibraryElementProviderWithCache(provider LibraryElementIndexProvider) LibraryElementIndexProvider {
	if provider == nil {
		return nil
	}
	return &cachedLibraryElementProvider{
		provider: provider,
		cacheTTL: 10 * time.Second,
	}
}
