package schemaversion

import (
	"context"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
)

// Shared utility functions for datasource migrations across different schema versions.
// These functions handle the common logic for migrating datasource references from
// string names/UIDs to structured reference objects with uid, type, and apiVersion.

// cachedIndexProvider wraps a DataSourceIndexProvider with time-based caching.
type cachedIndexProvider struct {
	*cachedProvider[*DatasourceIndex]
}

// Index returns the cached index if it's still valid (< TTL old), otherwise rebuilds it.
func (p *cachedIndexProvider) Index(ctx context.Context) *DatasourceIndex {
	return p.Get(ctx)
}

// cachedLibraryElementProvider wraps a LibraryElementIndexProvider with time-based caching.
type cachedLibraryElementProvider struct {
	*cachedProvider[[]LibraryElementInfo]
}

func (p *cachedLibraryElementProvider) GetLibraryElementInfo(ctx context.Context) []LibraryElementInfo {
	return p.Get(ctx)
}

// WrapIndexProviderWithCache wraps a DataSourceIndexProvider to cache indexes with a configurable TTL.
func WrapIndexProviderWithCache(provider DataSourceIndexProvider, cacheTTL time.Duration) DataSourceIndexProvider {
	if provider == nil || cacheTTL <= 0 {
		return provider
	}
	return &cachedIndexProvider{
		newCachedProvider[*DatasourceIndex](provider.Index, defaultCacheSize, cacheTTL, log.New("schemaversion.dsindexprovider")),
	}
}

// WrapLibraryElementProviderWithCache wraps a LibraryElementIndexProvider to cache library elements with a configurable TTL.
func WrapLibraryElementProviderWithCache(provider LibraryElementIndexProvider, cacheTTL time.Duration) LibraryElementIndexProvider {
	if provider == nil || cacheTTL <= 0 {
		return provider
	}
	return &cachedLibraryElementProvider{
		newCachedProvider[[]LibraryElementInfo](provider.GetLibraryElementInfo, defaultCacheSize, cacheTTL, log.New("schemaversion.leindexprovider")),
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
