package search

import (
	"context"
	"encoding/binary"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"math"
	"os"
	"path/filepath"
	"slices"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/blevesearch/bleve/v2"
	"github.com/blevesearch/bleve/v2/analysis/analyzer/keyword"
	"github.com/blevesearch/bleve/v2/analysis/analyzer/standard"
	"github.com/blevesearch/bleve/v2/mapping"
	"github.com/blevesearch/bleve/v2/search"
	"github.com/blevesearch/bleve/v2/search/query"
	bleveSearch "github.com/blevesearch/bleve/v2/search/searcher"
	index "github.com/blevesearch/bleve_index_api"
	"github.com/prometheus/client_golang/prometheus"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
	"k8s.io/apimachinery/pkg/selection"

	"github.com/grafana/grafana/pkg/services/dashboards/dashboardaccess"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"

	authlib "github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

const (
	// tracingPrexfixBleve is the prefix used for tracing spans in the Bleve backend
	tracingPrexfixBleve = "unified_search.bleve."

	indexStorageMemory = "memory"
	indexStorageFile   = "file"
)

var _ resource.SearchBackend = &bleveBackend{}
var _ resource.ResourceIndex = &bleveIndex{}

type BleveOptions struct {
	// The root folder where file objects are saved
	Root string

	// The resource count where values switch from memory to file based
	FileThreshold int64

	// How big should a batch get before flushing
	// ?? not totally sure the units
	BatchSize int

	// Index cache TTL for bleve indices. 0 disables expiration for in-memory indexes.
	IndexCacheTTL time.Duration

	Logger *slog.Logger
}

type bleveBackend struct {
	tracer trace.Tracer
	log    *slog.Logger
	opts   BleveOptions

	cacheMx sync.RWMutex
	cache   map[resource.NamespacedResource]*bleveIndex

	features     featuremgmt.FeatureToggles
	indexMetrics *resource.BleveIndexMetrics
}

func NewBleveBackend(opts BleveOptions, tracer trace.Tracer, features featuremgmt.FeatureToggles, indexMetrics *resource.BleveIndexMetrics) (*bleveBackend, error) {
	if opts.Root == "" {
		return nil, fmt.Errorf("bleve backend missing root folder configuration")
	}
	absRoot, err := filepath.Abs(opts.Root)
	if err != nil {
		return nil, fmt.Errorf("error getting absolute path for bleve root folder %w", err)
	}
	opts.Root = absRoot

	root, err := os.Stat(opts.Root)
	if err != nil {
		return nil, fmt.Errorf("error opening bleve root folder %w", err)
	}
	if !root.IsDir() {
		return nil, fmt.Errorf("bleve root is configured against a file (not folder)")
	}

	log := opts.Logger
	if log == nil {
		log = slog.Default().With("logger", "bleve-backend")
	}

	be := &bleveBackend{
		log:          log,
		tracer:       tracer,
		cache:        map[resource.NamespacedResource]*bleveIndex{},
		opts:         opts,
		features:     features,
		indexMetrics: indexMetrics,
	}

	go be.updateIndexSizeMetric(opts.Root)

	return be, nil
}

// GetIndex will return nil if the key does not exist
func (b *bleveBackend) GetIndex(_ context.Context, key resource.NamespacedResource) (resource.ResourceIndex, error) {
	idx := b.getCachedIndex(key)
	// Avoid returning typed nils.
	if idx == nil {
		return nil, nil
	}
	return idx, nil
}

func (b *bleveBackend) getCachedIndex(key resource.NamespacedResource) *bleveIndex {
	// Check index with read-lock first.
	b.cacheMx.RLock()
	val := b.cache[key]
	b.cacheMx.RUnlock()

	if val == nil {
		return nil
	}

	if val.expiration.IsZero() || val.expiration.After(time.Now()) {
		// Not expired yet.
		return val
	}

	// We're dealing with expired index. We need to remove it from the cache and close it.
	b.cacheMx.Lock()
	val = b.cache[key]
	delete(b.cache, key)
	b.cacheMx.Unlock()

	if val == nil {
		return nil
	}

	// Index is no longer in the cache, but we need to close it.
	err := val.stopUpdaterAndCloseIndex()
	if err != nil {
		b.log.Error("failed to close index", "key", key, "err", err)
	}
	b.log.Info("index evicted from cache", "key", key)

	if b.indexMetrics != nil {
		b.indexMetrics.OpenIndexes.WithLabelValues(val.indexStorage).Dec()
	}

	return nil
}

// updateIndexSizeMetric sets the total size of all file-based indices metric.
func (b *bleveBackend) updateIndexSizeMetric(indexPath string) {
	if b.indexMetrics == nil {
		return
	}

	for {
		var totalSize int64

		err := filepath.WalkDir(indexPath, func(path string, info os.DirEntry, err error) error {
			if err != nil {
				return err
			}
			if !info.IsDir() {
				fileInfo, err := info.Info()
				if err != nil {
					return err
				}
				totalSize += fileInfo.Size()
			}
			return nil
		})

		if err == nil {
			b.indexMetrics.IndexSize.Set(float64(totalSize))
		} else {
			b.log.Error("got error while trying to calculate bleve file index size", "error", err)
		}

		time.Sleep(60 * time.Second)
	}
}

// newBleveIndex creates a new bleve index with consistent configuration.
// If path is empty, creates an in-memory index.
// If path is not empty, creates a file-based index at the specified path.
func newBleveIndex(path string, mapper mapping.IndexMapping) (bleve.Index, error) {
	kvstore := bleve.Config.DefaultKVStore
	if path == "" {
		// use in-memory kvstore
		kvstore = bleve.Config.DefaultMemKVStore
	}
	return bleve.NewUsing(path, mapper, bleve.Config.DefaultIndexType, kvstore, nil)
}

// BuildIndex builds an index from scratch or retrieves it from the filesystem.
// If built successfully, the new index replaces the old index in the cache (if there was any).
// An index in the file system is considered to be valid if the requested resourceVersion is smaller than or equal to
// the resourceVersion used to build the index and the number of indexed objects matches the expected size.
// The return value of "builder" should be the RV returned from List. This will be stored as the index RV
//
//nolint:gocyclo
func (b *bleveBackend) BuildIndex(
	ctx context.Context,
	key resource.NamespacedResource,
	size int64,
	resourceVersion int64,
	fields resource.SearchableDocumentFields,
	indexBuildReason string,
	builder resource.BuildFn,
	updater resource.UpdateFn,
	rebuild bool,
	searchAfterWrite bool,
) (resource.ResourceIndex, error) {
	_, span := b.tracer.Start(ctx, tracingPrexfixBleve+"BuildIndex")
	defer span.End()

	span.SetAttributes(
		attribute.String("namespace", key.Namespace),
		attribute.String("group", key.Group),
		attribute.String("resource", key.Resource),
		attribute.Int64("size", size),
		attribute.Int64("rv", resourceVersion),
		attribute.String("reason", indexBuildReason),
	)

	mapper, err := GetBleveMappings(fields)
	if err != nil {
		return nil, err
	}

	// Prepare fields before opening/creating indexes, so that we don't need to deal with closing them in case of errors.
	standardSearchFields := resource.StandardSearchFields()
	allFields, err := getAllFields(standardSearchFields, fields)
	if err != nil {
		return nil, err
	}

	logWithDetails := b.log.With("namespace", key.Namespace, "group", key.Group, "resource", key.Resource, "size", size, "rv", resourceVersion, "reason", indexBuildReason)

	// Close the newly created/opened index by default.
	closeIndex := true
	// This function is added via defer after new index has been created/opened, to make sure we close it properly when needed.
	// Whether index needs closing or not is controlled by closeIndex.
	closeIndexOnExit := func(index bleve.Index, indexDir string) {
		if !closeIndex {
			return
		}

		if closeErr := index.Close(); closeErr != nil {
			logWithDetails.Error("Failed to close index after index build failure", "err", closeErr)
		}
		if indexDir != "" {
			if removeErr := os.RemoveAll(indexDir); removeErr != nil {
				logWithDetails.Error("Failed to remove index directory after index build failure", "err", removeErr)
			}
		}
	}

	resourceDir := b.getResourceDir(key)

	var index bleve.Index
	var indexRV int64
	cachedIndex := b.getCachedIndex(key)
	fileIndexName := "" // Name of the file-based index, or empty for in-memory indexes.
	newIndexType := indexStorageMemory
	build := true

	if size >= b.opts.FileThreshold {
		newIndexType = indexStorageFile

		// We only check for the existing file-based index if we don't already have an open index for this key.
		// This happens on startup, or when memory-based index has expired. (We don't expire file-based indexes)
		// If we do have an unexpired cached index already, we always build a new index from scratch.
		if cachedIndex == nil && resourceVersion > 0 && !rebuild {
			index, fileIndexName, indexRV = b.findPreviousFileBasedIndex(resourceDir, resourceVersion, size, searchAfterWrite)
		}

		if index != nil {
			build = false
			logWithDetails.Debug("Existing index found on filesystem", "indexRV", indexRV, "directory", filepath.Join(resourceDir, fileIndexName))
			defer closeIndexOnExit(index, "") // Close index, but don't delete directory.
		} else {
			// Building index from scratch. Index name has a time component in it to be unique, but if
			// we happen to create non-unique name, we bump the time and try again.

			indexDir := ""
			now := time.Now()
			for index == nil {
				fileIndexName = formatIndexName(now)
				indexDir = filepath.Join(resourceDir, fileIndexName)
				if !isPathWithinRoot(indexDir, b.opts.Root) {
					return nil, fmt.Errorf("invalid path %s", indexDir)
				}

				index, err = newBleveIndex(indexDir, mapper)
				if errors.Is(err, bleve.ErrorIndexPathExists) {
					now = now.Add(time.Second) // Bump time for next try
					index = nil                // Bleve actually returns non-nil value with ErrorIndexPathExists
					continue
				}
				if err != nil {
					return nil, fmt.Errorf("error creating new bleve index: %s %w", indexDir, err)
				}
			}

			logWithDetails.Info("Building index using filesystem", "directory", indexDir)
			defer closeIndexOnExit(index, indexDir) // Close index, and delete new index directory.
		}
	} else {
		index, err = newBleveIndex("", mapper)
		if err != nil {
			return nil, fmt.Errorf("error creating new in-memory bleve index: %w", err)
		}
		logWithDetails.Info("Building index using memory")
		defer closeIndexOnExit(index, "") // Close index, don't cleanup directory.
	}

	// Batch all the changes
	idx := b.newBleveIndex(key, index, newIndexType, fields, allFields, standardSearchFields, updater, b.log.With("namespace", key.Namespace, "group", key.Group, "resource", key.Resource))

	if build {
		if b.indexMetrics != nil {
			b.indexMetrics.IndexBuilds.WithLabelValues(indexBuildReason).Inc()
		}

		start := time.Now()
		listRV, err := builder(idx)
		if err != nil {
			logWithDetails.Error("Failed to build index", "err", err)
			if b.indexMetrics != nil {
				b.indexMetrics.IndexBuildFailures.Inc()
			}
			return nil, fmt.Errorf("failed to build index: %w", err)
		}
		err = idx.updateResourceVersion(listRV)
		if err != nil {
			logWithDetails.Error("Failed to persist RV to index", "err", err, "rv", listRV)
			return nil, fmt.Errorf("failed to persist RV to index: %w", err)
		}

		elapsed := time.Since(start)
		logWithDetails.Info("Finished building index", "elapsed", elapsed, "listRV", listRV)

		if b.indexMetrics != nil {
			b.indexMetrics.IndexCreationTime.WithLabelValues().Observe(elapsed.Seconds())
		}
	} else {
		logWithDetails.Info("Skipping index build, using existing index")

		idx.resourceVersion = indexRV

		if b.indexMetrics != nil {
			b.indexMetrics.IndexBuildSkipped.Inc()
		}
	}

	// Set expiration after building the index. Only expire in-memory indexes.
	if fileIndexName == "" && b.opts.IndexCacheTTL > 0 {
		idx.expiration = time.Now().Add(b.opts.IndexCacheTTL)
	}

	// Store the index in the cache.
	if idx.expiration.IsZero() {
		logWithDetails.Info("Storing index in cache, with no expiration", "key", key)
	} else {
		logWithDetails.Info("Storing index in cache", "key", key, "expiration", idx.expiration)
	}

	// We're storing index in the cache, so we can't close it.
	closeIndex = false

	b.cacheMx.Lock()
	prev := b.cache[key]
	b.cache[key] = idx
	b.cacheMx.Unlock()

	// If there was a previous index in the cache, close it.
	if prev != nil {
		if b.indexMetrics != nil {
			b.indexMetrics.OpenIndexes.WithLabelValues(prev.indexStorage).Dec()
		}

		err := prev.stopUpdaterAndCloseIndex()
		if err != nil {
			logWithDetails.Error("failed to close previous index", "key", key, "err", err)
		}
	}
	if b.indexMetrics != nil {
		b.indexMetrics.OpenIndexes.WithLabelValues(idx.indexStorage).Inc()
	}

	// Clean up the old index directories. If we have built a new file-based index, the new name is ignored.
	// If we have created in-memory index and fileIndexName is empty, all old directories can be removed.
	//
	// We do the cleanup on the same goroutine as the index building. Using background goroutine could
	// cleanup new index directory that is being built by new call to BuildIndex.
	b.cleanOldIndexes(resourceDir, fileIndexName)

	return idx, nil
}

func (b *bleveBackend) getResourceDir(key resource.NamespacedResource) string {
	return filepath.Join(b.opts.Root, cleanFileSegment(key.Namespace), cleanFileSegment(fmt.Sprintf("%s.%s", key.Resource, key.Group)))
}

func cleanFileSegment(input string) string {
	input = strings.ReplaceAll(input, string(filepath.Separator), "_")
	input = strings.ReplaceAll(input, "..", "_")
	return input
}

// cleanOldIndexes deletes all subdirectories inside dir, skipping directory with "skipName".
// "skipName" can be empty.
func (b *bleveBackend) cleanOldIndexes(dir string, skipName string) {
	files, err := os.ReadDir(dir)
	if err != nil {
		if os.IsNotExist(err) {
			return
		}
		b.log.Warn("error cleaning folders from", "directory", dir, "error", err)
		return
	}
	for _, file := range files {
		if file.IsDir() && file.Name() != skipName {
			fpath := filepath.Join(dir, file.Name())
			if !isPathWithinRoot(fpath, b.opts.Root) {
				b.log.Warn("Skipping cleanup of directory", "directory", fpath)
				continue
			}

			err = os.RemoveAll(fpath)
			if err != nil {
				b.log.Error("Unable to remove old index folder", "directory", fpath, "error", err)
			} else {
				b.log.Info("Removed old index folder", "directory", fpath)
			}
		}
	}
}

// isPathWithinRoot verifies that path is within given absoluteRoot.
func isPathWithinRoot(path, absoluteRoot string) bool {
	if path == "" || absoluteRoot == "" {
		return false
	}

	path, err := filepath.Abs(path)
	if err != nil {
		return false
	}
	if !strings.HasPrefix(path, absoluteRoot) {
		return false
	}
	return true
}

// cacheKeys returns list of keys for indexes in the cache (including possibly expired ones).
func (b *bleveBackend) cacheKeys() []resource.NamespacedResource {
	b.cacheMx.RLock()
	defer b.cacheMx.RUnlock()

	keys := make([]resource.NamespacedResource, 0, len(b.cache))
	for k := range b.cache {
		keys = append(keys, k)
	}
	return keys
}

// TotalDocs returns the total number of documents across all indices
func (b *bleveBackend) TotalDocs() int64 {
	var totalDocs int64
	// We iterate over keys and call getCachedIndex for each index individually.
	// We do this to avoid keeping a lock for the entire TotalDocs function, since DocCount may be slow (due to disk access).
	// Calling getCachedIndex also handles index expiration.
	for _, key := range b.cacheKeys() {
		idx := b.getCachedIndex(key)
		if idx == nil {
			continue
		}
		c, err := idx.index.DocCount()
		if err != nil {
			continue
		}
		totalDocs += int64(c)
	}
	return totalDocs
}

func formatIndexName(now time.Time) string {
	return now.Format("20060102-150405")
}

func (b *bleveBackend) findPreviousFileBasedIndex(resourceDir string, resourceVersion int64, size int64, searchAfterWrite bool) (bleve.Index, string, int64) {
	entries, err := os.ReadDir(resourceDir)
	if err != nil {
		return nil, "", 0
	}

	for _, ent := range entries {
		if !ent.IsDir() {
			continue
		}

		indexName := ent.Name()
		indexDir := filepath.Join(resourceDir, indexName)
		idx, err := bleve.Open(indexDir)
		if err != nil {
			b.log.Debug("error opening index", "indexDir", indexDir, "err", err)
			continue
		}

		cnt, err := idx.DocCount()
		if err != nil {
			b.log.Debug("error getting count from index", "indexDir", indexDir, "err", err)
			_ = idx.Close()
			continue
		}

		if uint64(size) != cnt {
			b.log.Debug("index count mismatch. ignoring index", "indexDir", indexDir, "size", size, "cnt", cnt)
			_ = idx.Close()
			continue
		}

		indexRV, err := getRV(idx)
		if err != nil {
			b.log.Error("error getting rv from index", "indexDir", indexDir, "err", err)
			if !errors.Is(err, bleve.ErrorIndexClosed) {
				_ = idx.Close()
			}
			continue
		}

		// if searchAfterWrite is enabled, we don't need to re-build the index, as it will be updated at request time
		if !searchAfterWrite && indexRV < resourceVersion {
			b.log.Debug("indexRV is less than requested resourceVersion. ignoring index", "indexDir", indexDir, "rv", indexRV, "resourceVersion", resourceVersion)
			_ = idx.Close()
			continue
		}

		return idx, indexName, indexRV
	}

	return nil, "", 0
}

func (b *bleveBackend) CloseAllIndexes() {
	b.cacheMx.Lock()
	defer b.cacheMx.Unlock()

	for key, idx := range b.cache {
		if err := idx.stopUpdaterAndCloseIndex(); err != nil {
			b.log.Error("Failed to close index", "err", err)
		}
		delete(b.cache, key)

		if b.indexMetrics != nil {
			b.indexMetrics.OpenIndexes.WithLabelValues(idx.indexStorage).Dec()
		}
	}
}

type updateRequest struct {
	reason   string
	callback chan updateResult
}

type updateResult struct {
	rv  int64
	err error
}

type bleveIndex struct {
	key   resource.NamespacedResource
	index bleve.Index

	// RV returned by last List/ListModifiedSince operation. Updated when updating index.
	resourceVersion int64

	standard resource.SearchableDocumentFields
	fields   resource.SearchableDocumentFields

	indexStorage string // memory or file, used when updating metrics

	// When to expire and close the index. Zero value = no expiration.
	// We only expire in-memory indexes.
	expiration time.Time

	// The values returned with all
	allFields []*resourcepb.ResourceTableColumnDefinition
	features  featuremgmt.FeatureToggles
	tracing   trace.Tracer
	logger    *slog.Logger

	updaterFn resource.UpdateFn

	updaterMu       sync.Mutex
	updaterCond     *sync.Cond         // Used to signal the updater goroutine that there is work to do, or updater is no longer enabled and should stop. Also used by updater itself to stop early if there's no work to be done.
	updaterShutdown bool               // When set to true, index is getting closed and updater is no longer going to update index.
	updaterQueue    []updateRequest    // Queue of requests for next updater iteration.
	updaterCancel   context.CancelFunc // If not nil, the updater goroutine is running with context associated with this cancel function.
	updaterWg       sync.WaitGroup

	updateLatency    prometheus.Histogram
	updatedDocuments prometheus.Summary
}

func (b *bleveBackend) newBleveIndex(
	key resource.NamespacedResource,
	index bleve.Index,
	newIndexType string,
	fields resource.SearchableDocumentFields,
	allFields []*resourcepb.ResourceTableColumnDefinition,
	standardSearchFields resource.SearchableDocumentFields,
	updaterFn resource.UpdateFn,
	logger *slog.Logger,
) *bleveIndex {
	bi := &bleveIndex{
		key:          key,
		index:        index,
		indexStorage: newIndexType,
		fields:       fields,
		allFields:    allFields,
		standard:     standardSearchFields,
		features:     b.features,
		tracing:      b.tracer,
		logger:       logger,
		updaterFn:    updaterFn,
	}
	bi.updaterCond = sync.NewCond(&bi.updaterMu)
	if b.indexMetrics != nil {
		bi.updateLatency = b.indexMetrics.UpdateLatency
		bi.updatedDocuments = b.indexMetrics.UpdatedDocuments
	}
	return bi
}

// BulkIndex implements resource.ResourceIndex.
func (b *bleveIndex) BulkIndex(req *resource.BulkIndexRequest) error {
	if len(req.Items) == 0 {
		return nil
	}

	batch := b.index.NewBatch()
	for _, item := range req.Items {
		switch item.Action {
		case resource.ActionIndex:
			if item.Doc == nil {
				return fmt.Errorf("missing document")
			}
			doc := item.Doc.UpdateCopyFields()

			err := batch.Index(resource.SearchID(doc.Key), doc)
			if err != nil {
				return err
			}
		case resource.ActionDelete:
			batch.Delete(resource.SearchID(item.Key))
		}
	}

	return b.index.Batch(batch)
}

var internalRVKey = []byte("rv")

func (b *bleveIndex) updateResourceVersion(rv int64) error {
	if rv == 0 {
		return nil
	}

	if err := setRV(b.index, rv); err != nil {
		return err
	}

	b.resourceVersion = rv

	return nil
}

func setRV(index bleve.Index, rv int64) error {
	buf := make([]byte, 8)
	binary.BigEndian.PutUint64(buf, uint64(rv))

	return index.SetInternal(internalRVKey, buf)
}

// getRV will call index.GetInternal to retrieve the RV saved in the index. If index is closed, it will return a
// bleve.ErrorIndexClosed error. If there's no RV saved in the index, or it's invalid format, it will return 0
func getRV(index bleve.Index) (int64, error) {
	raw, err := index.GetInternal(internalRVKey)
	if err != nil {
		return 0, err
	}

	if len(raw) < 8 {
		return 0, nil
	}

	return int64(binary.BigEndian.Uint64(raw)), nil
}

func (b *bleveIndex) ListManagedObjects(ctx context.Context, req *resourcepb.ListManagedObjectsRequest) (*resourcepb.ListManagedObjectsResponse, error) {
	if req.NextPageToken != "" {
		return nil, fmt.Errorf("next page not implemented yet")
	}
	if req.Kind == "" {
		return &resourcepb.ListManagedObjectsResponse{
			Error: resource.NewBadRequestError("empty manager kind"),
		}, nil
	}
	if req.Id == "" {
		return &resourcepb.ListManagedObjectsResponse{
			Error: resource.NewBadRequestError("empty manager id"),
		}, nil
	}

	q := bleve.NewBooleanQuery()
	q.AddMust(&query.TermQuery{
		Term:     req.Kind,
		FieldVal: resource.SEARCH_FIELD_MANAGER_KIND,
	})
	q.AddMust(&query.TermQuery{
		Term:     req.Id,
		FieldVal: resource.SEARCH_FIELD_MANAGER_ID,
	})

	found, err := b.index.SearchInContext(ctx, &bleve.SearchRequest{
		Query: q,
		Fields: []string{
			resource.SEARCH_FIELD_TITLE,
			resource.SEARCH_FIELD_FOLDER,
			resource.SEARCH_FIELD_MANAGER_KIND,
			resource.SEARCH_FIELD_MANAGER_ID,
			resource.SEARCH_FIELD_SOURCE_PATH,
			resource.SEARCH_FIELD_SOURCE_CHECKSUM,
			resource.SEARCH_FIELD_SOURCE_TIME,
		},
		Sort: search.SortOrder{
			&search.SortField{
				Field: resource.SEARCH_FIELD_SOURCE_PATH,
				Type:  search.SortFieldAsString,
				Desc:  false,
			},
		},
		Size: 1000000000, // big number
		From: 0,          // next page token not yet supported
	})
	if err != nil {
		return nil, err
	}

	asString := func(v any) string {
		if v == nil {
			return ""
		}
		str, ok := v.(string)
		if ok {
			return str
		}
		return fmt.Sprintf("%v", v)
	}

	asTime := func(v any) int64 {
		if v == nil {
			return 0
		}
		intV, ok := v.(int64)
		if ok {
			return intV
		}
		floatV, ok := v.(float64)
		if ok {
			return int64(floatV)
		}
		str, ok := v.(string)
		if ok {
			t, _ := time.Parse(time.RFC3339, str)
			return t.UnixMilli()
		}
		return 0
	}

	rsp := &resourcepb.ListManagedObjectsResponse{}
	for _, hit := range found.Hits {
		item := &resourcepb.ListManagedObjectsResponse_Item{
			Object: &resourcepb.ResourceKey{},
			Hash:   asString(hit.Fields[resource.SEARCH_FIELD_SOURCE_CHECKSUM]),
			Path:   asString(hit.Fields[resource.SEARCH_FIELD_SOURCE_PATH]),
			Time:   asTime(hit.Fields[resource.SEARCH_FIELD_SOURCE_TIME]),
			Title:  asString(hit.Fields[resource.SEARCH_FIELD_TITLE]),
			Folder: asString(hit.Fields[resource.SEARCH_FIELD_FOLDER]),
		}
		err := resource.ReadSearchID(item.Object, hit.ID)
		if err != nil {
			return nil, err
		}
		rsp.Items = append(rsp.Items, item)
	}
	return rsp, nil
}

func (b *bleveIndex) CountManagedObjects(ctx context.Context) ([]*resourcepb.CountManagedObjectsResponse_ResourceCount, error) {
	found, err := b.index.SearchInContext(ctx, &bleve.SearchRequest{
		Query: bleve.NewMatchAllQuery(),
		Size:  0,
		Facets: bleve.FacetsRequest{
			"count": bleve.NewFacetRequest(resource.SEARCH_FIELD_MANAGED_BY, 1000), // typically less then 5
		},
	})
	if err != nil {
		return nil, err
	}
	vals := make([]*resourcepb.CountManagedObjectsResponse_ResourceCount, 0)
	f, ok := found.Facets["count"]
	if ok && f.Terms != nil {
		for _, v := range f.Terms.Terms() {
			val := v.Term
			idx := strings.Index(val, ":")
			if idx > 0 {
				vals = append(vals, &resourcepb.CountManagedObjectsResponse_ResourceCount{
					Kind:     val[0:idx],
					Id:       val[idx+1:],
					Group:    b.key.Group,
					Resource: b.key.Resource,
					Count:    int64(v.Count),
				})
			}
		}
	}
	return vals, nil
}

// Search implements resource.DocumentIndex.
func (b *bleveIndex) Search(
	ctx context.Context,
	access authlib.AccessClient,
	req *resourcepb.ResourceSearchRequest,
	federate []resource.ResourceIndex, // For federated queries, these will match the values in req.federate
) (*resourcepb.ResourceSearchResponse, error) {
	ctx, span := b.tracing.Start(ctx, tracingPrexfixBleve+"Search")
	defer span.End()

	if req.Options == nil || req.Options.Key == nil {
		return &resourcepb.ResourceSearchResponse{
			Error: resource.NewBadRequestError("missing query key"),
		}, nil
	}

	response := &resourcepb.ResourceSearchResponse{
		Error: b.verifyKey(req.Options.Key),
	}
	if response.Error != nil {
		return response, nil
	}

	// Verifies the index federation
	index, err := b.getIndex(ctx, req, federate)
	if err != nil {
		return nil, err
	}

	// convert protobuf request to bleve request
	searchrequest, e := b.toBleveSearchRequest(ctx, req, access)
	if e != nil {
		response.Error = e
		return response, nil
	}

	// Show all fields when nothing is selected
	if len(searchrequest.Fields) < 1 && req.Limit > 0 {
		f, err := b.index.Fields()
		if err != nil {
			return nil, err
		}
		if len(f) > 0 {
			searchrequest.Fields = f
		} else {
			searchrequest.Fields = []string{
				resource.SEARCH_FIELD_TITLE,
				resource.SEARCH_FIELD_FOLDER,
				resource.SEARCH_FIELD_SOURCE_PATH,
				resource.SEARCH_FIELD_MANAGED_BY,
			}
		}
	}

	res, err := index.SearchInContext(ctx, searchrequest)
	if err != nil {
		return nil, err
	}

	response.TotalHits = int64(res.Total)
	response.QueryCost = float64(res.Cost)
	response.MaxScore = res.MaxScore

	response.Results, err = b.hitsToTable(ctx, searchrequest.Fields, res.Hits, req.Explain)
	if err != nil {
		return nil, err
	}

	// parse the facet fields
	for k, v := range res.Facets {
		f := newResponseFacet(v)
		if response.Facet == nil {
			response.Facet = make(map[string]*resourcepb.ResourceSearchResponse_Facet)
		}
		response.Facet[k] = f
	}
	return response, nil
}

func (b *bleveIndex) DocCount(ctx context.Context, folder string) (int64, error) {
	ctx, span := b.tracing.Start(ctx, tracingPrexfixBleve+"DocCount")
	defer span.End()

	if folder == "" {
		count, err := b.index.DocCount()
		return int64(count), err
	}

	req := &bleve.SearchRequest{
		Size:   0, // we just need the count
		Fields: []string{},
		Query: &query.TermQuery{
			Term:     folder,
			FieldVal: resource.SEARCH_FIELD_FOLDER,
		},
	}
	rsp, err := b.index.SearchInContext(ctx, req)
	if rsp == nil {
		return 0, err
	}
	return int64(rsp.Total), err
}

// make sure the request key matches the index
func (b *bleveIndex) verifyKey(key *resourcepb.ResourceKey) *resourcepb.ErrorResult {
	if key.Namespace != b.key.Namespace {
		return resource.NewBadRequestError("namespace mismatch (expected " + b.key.Namespace + ")")
	}
	if key.Group != b.key.Group {
		return resource.NewBadRequestError("group mismatch (expected " + b.key.Group + ")")
	}
	if key.Resource != b.key.Resource {
		return resource.NewBadRequestError("resource mismatch (expected " + b.key.Resource + ")")
	}
	return nil
}

func (b *bleveIndex) getIndex(
	ctx context.Context,
	req *resourcepb.ResourceSearchRequest,
	federate []resource.ResourceIndex,
) (bleve.Index, error) {
	_, span := b.tracing.Start(ctx, tracingPrexfixBleve+"getIndex")
	defer span.End()

	if len(req.Federated) != len(federate) {
		return nil, fmt.Errorf("federation is misconfigured")
	}

	// Search across resources using
	// https://blevesearch.com/docs/IndexAlias/
	if len(federate) > 0 {
		all := []bleve.Index{b.index}
		for i, extra := range federate {
			typedindex, ok := extra.(*bleveIndex)
			if !ok {
				return nil, fmt.Errorf("federated indexes must be the same type")
			}
			if typedindex.verifyKey(req.Federated[i]) != nil {
				return nil, fmt.Errorf("federated index keys do not match (%v != %v)", typedindex, req.Federated[i])
			}
			all = append(all, typedindex.index)
		}
		return bleve.NewIndexAlias(all...), nil
	}
	return b.index, nil
}

func (b *bleveIndex) toBleveSearchRequest(ctx context.Context, req *resourcepb.ResourceSearchRequest, access authlib.AccessClient) (*bleve.SearchRequest, *resourcepb.ErrorResult) {
	ctx, span := b.tracing.Start(ctx, tracingPrexfixBleve+"toBleveSearchRequest")
	defer span.End()

	facets := bleve.FacetsRequest{}
	for _, f := range req.Facet {
		facets[f.Field] = bleve.NewFacetRequest(f.Field, int(f.Limit))
	}

	// Convert resource-specific fields to bleve fields (just considers dashboard fields for now)
	fields := make([]string, 0, len(req.Fields))
	for _, f := range req.Fields {
		if slices.Contains(DashboardFields(), f) {
			f = resource.SEARCH_FIELD_PREFIX + f
		}
		fields = append(fields, f)
	}

	size, err := safeInt64ToInt(req.Limit)
	if err != nil {
		return nil, resource.AsErrorResult(err)
	}
	offset, err := safeInt64ToInt(req.Offset)
	if err != nil {
		return nil, resource.AsErrorResult(err)
	}

	searchrequest := &bleve.SearchRequest{
		Fields:  fields,
		Size:    size,
		From:    offset,
		Explain: req.Explain,
		Facets:  facets,
	}

	// Currently everything is within an AND query
	queries := []query.Query{}
	if len(req.Options.Labels) > 0 {
		for _, v := range req.Options.Labels {
			q, err := requirementQuery(v, "labels.")
			if err != nil {
				return nil, err
			}
			queries = append(queries, q)
		}
	}
	// filters
	if len(req.Options.Fields) > 0 {
		for _, v := range req.Options.Fields {
			q, err := requirementQuery(v, "")
			if err != nil {
				return nil, err
			}
			queries = append(queries, q)
		}
	}

	if len(req.Query) > 1 && strings.Contains(req.Query, "*") {
		// wildcard query is expensive - should be used with caution
		wildcard := bleve.NewWildcardQuery(req.Query)
		queries = append(queries, wildcard)
	}

	if req.Query != "" && !strings.Contains(req.Query, "*") {
		// Add a text query
		searchrequest.Fields = append(searchrequest.Fields, resource.SEARCH_FIELD_SCORE)

		// There are multiple ways to match the query string to documents. The following queries are ordered by priority:

		// Query 1: Match the exact query string
		queryExact := bleve.NewMatchQuery(req.Query)
		queryExact.SetBoost(10.0)
		queryExact.Analyzer = keyword.Name // don't analyze the query input - treat it as a single token

		// Query 2: Phrase query with standard analyzer
		queryPhrase := bleve.NewMatchPhraseQuery(req.Query)
		queryExact.SetBoost(5.0)
		queryPhrase.Analyzer = standard.Name

		// Query 3: Match query with standard analyzer
		queryAnalyzed := bleve.NewMatchQuery(req.Query)
		queryAnalyzed.Analyzer = standard.Name

		// At least one of the queries must match
		searchQuery := bleve.NewDisjunctionQuery(queryExact, queryAnalyzed, queryPhrase)
		queries = append(queries, searchQuery)
	}

	switch len(queries) {
	case 0:
		searchrequest.Query = bleve.NewMatchAllQuery()
	case 1:
		searchrequest.Query = queries[0]
	default:
		searchrequest.Query = bleve.NewConjunctionQuery(queries...) // AND
	}

	if access != nil {
		auth, ok := authlib.AuthInfoFrom(ctx)
		if !ok {
			return nil, resource.AsErrorResult(fmt.Errorf("missing auth info"))
		}
		verb := utils.VerbList
		if req.Permission == int64(dashboardaccess.PERMISSION_EDIT) {
			verb = utils.VerbPatch
		}

		checker, err := access.Compile(ctx, auth, authlib.ListRequest{
			Namespace: b.key.Namespace,
			Group:     b.key.Group,
			Resource:  b.key.Resource,
			Verb:      verb,
		})
		if err != nil {
			return nil, resource.AsErrorResult(err)
		}
		checkers := map[string]authlib.ItemChecker{
			b.key.Resource: checker,
		}

		// handle federation
		for _, federated := range req.Federated {
			checker, err := access.Compile(ctx, auth, authlib.ListRequest{
				Namespace: federated.Namespace,
				Group:     federated.Group,
				Resource:  federated.Resource,
				Verb:      utils.VerbList,
			})
			if err != nil {
				return nil, resource.AsErrorResult(err)
			}
			checkers[federated.Resource] = checker
		}

		searchrequest.Query = newPermissionScopedQuery(searchrequest.Query, checkers)
	}

	for k, v := range req.Facet {
		if searchrequest.Facets == nil {
			searchrequest.Facets = make(bleve.FacetsRequest)
		}
		searchrequest.Facets[k] = bleve.NewFacetRequest(v.Field, int(v.Limit))
	}

	// Add the sort fields
	sorting := getSortFields(req)
	searchrequest.SortBy(sorting)

	// When no sort fields are provided, sort by score if there is a query, otherwise sort by title
	if len(sorting) == 0 {
		if req.Query != "" && req.Query != "*" {
			searchrequest.Sort = append(searchrequest.Sort, &search.SortScore{
				Desc: true,
			})
		} else {
			searchrequest.Sort = append(searchrequest.Sort, &search.SortField{
				Field: resource.SEARCH_FIELD_TITLE_PHRASE,
				Desc:  false,
			})
		}
	}

	return searchrequest, nil
}

func (b *bleveIndex) stopUpdaterAndCloseIndex() error {
	// Signal updater to stop. We do this by 1) setting updaterShuttingDown + sending signal, and by 2) calling cancel.
	b.updaterMu.Lock()
	b.updaterShutdown = true
	b.updaterCond.Broadcast()
	// if updater is running, cancel it. (Setting to nil is only done from updater itself in defer.)
	if b.updaterCancel != nil {
		b.updaterCancel()
	}
	b.updaterMu.Unlock()

	b.updaterWg.Wait()
	// Close index only after updater is not working on it anymore.
	return b.index.Close()
}

func (b *bleveIndex) UpdateIndex(ctx context.Context, reason string) (int64, error) {
	// We don't have to do anything if the index cannot be updated (typically in tests).
	if b.updaterFn == nil {
		return 0, nil
	}

	// Use chan with buffer size 1 to ensure that we can always send the result back, even if there's no reader anymore.
	req := updateRequest{reason: reason, callback: make(chan updateResult, 1)}

	// Make sure that the updater goroutine is running.
	b.updaterMu.Lock()
	if b.updaterShutdown {
		b.updaterMu.Unlock()
		return 0, fmt.Errorf("cannot update index: %w", bleve.ErrorIndexClosed)
	}

	b.updaterQueue = append(b.updaterQueue, req)

	// If updater is not running, start it.
	if b.updaterCancel == nil {
		b.startUpdater()
	}
	b.updaterCond.Broadcast() // If updater is waiting for next batch, wake it up.
	b.updaterMu.Unlock()

	// wait for the update to finish
	select {
	case <-ctx.Done():
		return 0, ctx.Err()
	case ur := <-req.callback:
		return ur.rv, ur.err
	}
}

// Must be called with b.updaterMu lock held.
func (b *bleveIndex) startUpdater() {
	c, cancel := context.WithCancel(context.Background())
	b.updaterCancel = cancel
	b.updaterWg.Add(1)

	go func() {
		defer func() {
			cancel() // Make sure to call this to release resources.

			b.updaterMu.Lock()
			b.updaterCancel = nil
			b.updaterMu.Unlock()

			b.updaterWg.Done()
		}()

		b.runUpdater(c)
	}()
}

const maxWait = 5 * time.Second

func (b *bleveIndex) runUpdater(ctx context.Context) {
	for {
		start := time.Now()
		t := time.AfterFunc(maxWait, b.updaterCond.Broadcast)

		b.updaterMu.Lock()
		for !b.updaterShutdown && ctx.Err() == nil && len(b.updaterQueue) == 0 && time.Since(start) < maxWait {
			// Cond is signalled when updaterShutdown changes, updaterQueue gets new element or when timeout occurs.
			b.updaterCond.Wait()
		}

		shutdown := b.updaterShutdown
		batch := b.updaterQueue
		b.updaterQueue = nil // empty the queue for the next batch
		b.updaterMu.Unlock()

		t.Stop()

		// Nothing to index after maxWait, exit the goroutine.
		if len(batch) == 0 {
			return
		}

		if shutdown {
			for _, req := range batch {
				req.callback <- updateResult{err: fmt.Errorf("cannot update index: %w", bleve.ErrorIndexClosed)}
			}
			return
		}

		var rv int64
		var err = ctx.Err()
		if err == nil {
			rv, err = b.updateIndexWithLatestModifications(ctx, len(batch))
		}
		for _, req := range batch {
			req.callback <- updateResult{rv: rv, err: err}
		}
	}
}

func (b *bleveIndex) updateIndexWithLatestModifications(ctx context.Context, requests int) (int64, error) {
	ctx, span := b.tracing.Start(ctx, tracingPrexfixBleve+"updateIndexWithLatestModifications")
	defer span.End()

	sinceRV := b.resourceVersion
	b.logger.Debug("Updating index", "sinceRV", sinceRV, "requests", requests)

	startTime := time.Now()
	listRV, docs, err := b.updaterFn(ctx, b, sinceRV)
	if err == nil && listRV > 0 && listRV != sinceRV {
		err = b.updateResourceVersion(listRV) // updates b.resourceVersion
	}

	elapsed := time.Since(startTime)
	if err == nil {
		b.logger.Debug("Finished updating index", "sinceRV", sinceRV, "listRV", listRV, "duration", elapsed, "docs", docs)

		if b.updateLatency != nil {
			b.updateLatency.Observe(elapsed.Seconds())
		}
		if b.updatedDocuments != nil {
			b.updatedDocuments.Observe(float64(docs))
		}
	} else {
		b.logger.Error("Updating of index finished with error", "duration", elapsed, "err", err)
	}
	return listRV, err
}

func safeInt64ToInt(i64 int64) (int, error) {
	if i64 > math.MaxInt32 || i64 < math.MinInt32 {
		return 0, fmt.Errorf("int64 value %d overflows int", i64)
	}
	return int(i64), nil
}

func getSortFields(req *resourcepb.ResourceSearchRequest) []string {
	sorting := make([]string, 0, len(req.SortBy))
	for _, sort := range req.SortBy {
		input := sort.Field
		if field, ok := textSortFields[input]; ok {
			input = field
		}

		if slices.Contains(DashboardFields(), input) {
			input = resource.SEARCH_FIELD_PREFIX + input
		}

		if sort.Desc {
			input = "-" + input
		}
		sorting = append(sorting, input)
	}
	return sorting
}

// fields that we went to sort by the full text
var textSortFields = map[string]string{
	resource.SEARCH_FIELD_TITLE: resource.SEARCH_FIELD_TITLE_PHRASE,
}

const lowerCase = "phrase"

// termField fields to use termQuery for filtering
var termFields = []string{
	resource.SEARCH_FIELD_TITLE,
}

// Convert a "requirement" into a bleve query
func requirementQuery(req *resourcepb.Requirement, prefix string) (query.Query, *resourcepb.ErrorResult) {
	switch selection.Operator(req.Operator) {
	case selection.Equals, selection.DoubleEquals:
		if len(req.Values) == 0 {
			return query.NewMatchAllQuery(), nil
		}

		if len(req.Values) == 1 {
			filter := filterValue(req.Key, req.Values[0])
			return newQuery(req.Key, filter, prefix), nil
		}

		conjuncts := []query.Query{}
		for _, v := range req.Values {
			q := newQuery(req.Key, filterValue(req.Key, v), prefix)
			conjuncts = append(conjuncts, q)
		}

		return query.NewConjunctionQuery(conjuncts), nil

	case selection.NotEquals:
	case selection.DoesNotExist:
	case selection.GreaterThan:
	case selection.LessThan:
	case selection.Exists:
	case selection.In:
		if len(req.Values) == 0 {
			return query.NewMatchAllQuery(), nil
		}
		if len(req.Values) == 1 {
			q := newQuery(req.Key, filterValue(req.Key, req.Values[0]), prefix)
			return q, nil
		}

		disjuncts := []query.Query{}
		for _, v := range req.Values {
			q := newQuery(req.Key, filterValue(req.Key, v), prefix)
			disjuncts = append(disjuncts, q)
		}

		return query.NewDisjunctionQuery(disjuncts), nil

	case selection.NotIn:
		boolQuery := bleve.NewBooleanQuery()

		var mustNotQueries []query.Query
		for _, value := range req.Values {
			q := newQuery(req.Key, filterValue(req.Key, value), prefix)
			mustNotQueries = append(mustNotQueries, q)
		}
		boolQuery.AddMustNot(mustNotQueries...)

		// must still have a value
		notEmptyQuery := bleve.NewMatchAllQuery()
		boolQuery.AddMust(notEmptyQuery)

		return boolQuery, nil
	}
	return nil, resource.NewBadRequestError(
		fmt.Sprintf("unsupported query operation (%s %s %v)", req.Key, req.Operator, req.Values),
	)
}

// newQuery will create a query that will match the value or the tokens of the value
func newQuery(key string, value string, prefix string) query.Query {
	if value == "*" {
		return bleve.NewMatchAllQuery()
	}
	if strings.Contains(value, "*") {
		// wildcard query is expensive - should be used with caution
		return bleve.NewWildcardQuery(value)
	}
	delimiter, ok := hasTerms(value)
	if slices.Contains(termFields, key) && ok {
		return newTermsQuery(key, value, delimiter, prefix)
	}
	q := bleve.NewMatchQuery(value)
	q.SetField(prefix + key)
	return q
}

// newTermsQuery will create a query that will match on term or tokens
func newTermsQuery(key string, value string, delimiter string, prefix string) query.Query {
	tokens := strings.Split(value, delimiter)
	// won't match with ending space
	value = strings.TrimSuffix(value, " ")

	q := bleve.NewTermQuery(value)
	q.SetField(prefix + key)

	cq := newMatchAllTokensQuery(tokens, key, prefix)
	return bleve.NewDisjunctionQuery(q, cq)
}

// newMatchAllTokensQuery will create a query that will match on all tokens
func newMatchAllTokensQuery(tokens []string, key string, prefix string) query.Query {
	cq := bleve.NewConjunctionQuery()
	for _, token := range tokens {
		_, ok := hasTerms(token)
		if ok {
			tq := bleve.NewTermQuery(token)
			tq.SetField(prefix + key)
			cq.AddQuery(tq)
			continue
		}
		mq := bleve.NewMatchQuery(token)
		mq.SetField(prefix + key)
		cq.AddQuery(mq)
	}
	return cq
}

// filterValue will convert the value to lower case if the field is a phrase field
func filterValue(field string, v string) string {
	if strings.HasSuffix(field, lowerCase) {
		return strings.ToLower(v)
	}
	return v
}

func (b *bleveIndex) hitsToTable(ctx context.Context, selectFields []string, hits search.DocumentMatchCollection, explain bool) (*resourcepb.ResourceTable, error) {
	_, span := b.tracing.Start(ctx, tracingPrexfixBleve+"hitsToTable")
	defer span.End()

	fields := []*resourcepb.ResourceTableColumnDefinition{}
	for _, name := range selectFields {
		if name == "_all" {
			fields = b.allFields
			break
		}

		f := b.standard.Field(name)
		if f == nil && b.fields != nil {
			f = b.fields.Field(name)
		}
		if f == nil {
			// Labels as a string
			if strings.HasPrefix(name, "labels.") {
				f = &resourcepb.ResourceTableColumnDefinition{
					Name: name,
					Type: resourcepb.ResourceTableColumnDefinition_STRING,
				}
			}

			// return nil, fmt.Errorf("unknown response field: " + name)
			if f == nil {
				continue // OK for now
			}
		}
		fields = append(fields, f)
	}
	if explain {
		fields = append(fields, b.standard.Field(resource.SEARCH_FIELD_EXPLAIN))
	}

	builder, err := resource.NewTableBuilder(fields)
	if err != nil {
		return nil, err
	}
	encoders := builder.Encoders()

	table := &resourcepb.ResourceTable{
		Columns: fields,
		Rows:    make([]*resourcepb.ResourceTableRow, hits.Len()),
	}
	for rowID, match := range hits {
		row := &resourcepb.ResourceTableRow{
			Key:   &resourcepb.ResourceKey{},
			Cells: make([][]byte, len(fields)),
		}
		table.Rows[rowID] = row

		err := resource.ReadSearchID(row.Key, match.ID)
		if err != nil {
			return nil, err
		}

		for i, f := range fields {
			var v any
			switch f.Name {
			case resource.SEARCH_FIELD_ID:
				row.Cells[i] = []byte(match.ID)

			case resource.SEARCH_FIELD_SCORE:
				row.Cells[i], err = encoders[i](match.Score)

			case resource.SEARCH_FIELD_EXPLAIN:
				if match.Expl != nil {
					row.Cells[i], err = json.Marshal(match.Expl)
				}
			case resource.SEARCH_FIELD_LEGACY_ID:
				v := match.Fields[resource.SEARCH_FIELD_LABELS+"."+resource.SEARCH_FIELD_LEGACY_ID]
				if v != nil {
					str, ok := v.(string)
					if ok {
						id, _ := strconv.ParseInt(str, 10, 64)
						row.Cells[i], err = encoders[i](id)
					}
				}
			default:
				fieldName := f.Name
				// since the bleve index fields mix common and resource-specific fields, it is possible a conflict can happen
				// if a specific field is named the same as a common field
				v := match.Fields[fieldName]
				// fields that are specific to the resource get stored as fields.<fieldName>, so we need to check for that
				if v == nil {
					v = match.Fields[resource.SEARCH_FIELD_PREFIX+fieldName]
				}
				if v != nil {
					// Encode the value to protobuf
					row.Cells[i], err = encoders[i](v)
				}
			}
			if err != nil {
				return nil, fmt.Errorf("error encoding (row:%d/col:%d) %v %w", rowID, i, v, err)
			}
		}
	}

	return table, nil
}

func getAllFields(standard resource.SearchableDocumentFields, custom resource.SearchableDocumentFields) ([]*resourcepb.ResourceTableColumnDefinition, error) {
	fields := []*resourcepb.ResourceTableColumnDefinition{
		standard.Field(resource.SEARCH_FIELD_ID),
		standard.Field(resource.SEARCH_FIELD_TITLE),
		standard.Field(resource.SEARCH_FIELD_TAGS),
		standard.Field(resource.SEARCH_FIELD_FOLDER),
		standard.Field(resource.SEARCH_FIELD_RV),
		standard.Field(resource.SEARCH_FIELD_CREATED),
		standard.Field(resource.SEARCH_FIELD_LEGACY_ID),
		standard.Field(resource.SEARCH_FIELD_MANAGER_KIND),
	}

	if custom != nil {
		for _, name := range custom.Fields() {
			f := custom.Field(name)
			if f.Priority > 10 {
				continue
			}
			fields = append(fields, f)
		}
	}
	for _, field := range fields {
		if field == nil {
			return nil, fmt.Errorf("invalid all field")
		}
	}
	return fields, nil
}

func newResponseFacet(v *search.FacetResult) *resourcepb.ResourceSearchResponse_Facet {
	f := &resourcepb.ResourceSearchResponse_Facet{
		Field:   v.Field,
		Total:   int64(v.Total),
		Missing: int64(v.Missing),
	}
	if v.Terms != nil {
		for _, t := range v.Terms.Terms() {
			f.Terms = append(f.Terms, &resourcepb.ResourceSearchResponse_TermFacet{
				Term:  t.Term,
				Count: int64(t.Count),
			})
		}
	}
	return f
}

type permissionScopedQuery struct {
	query.Query
	checkers map[string]authlib.ItemChecker // one checker per resource
	log      log.Logger
}

func newPermissionScopedQuery(q query.Query, checkers map[string]authlib.ItemChecker) *permissionScopedQuery {
	return &permissionScopedQuery{
		Query:    q,
		checkers: checkers,
		log:      log.New("search_permissions"),
	}
}

func (q *permissionScopedQuery) Searcher(ctx context.Context, i index.IndexReader, m mapping.IndexMapping, options search.SearcherOptions) (search.Searcher, error) {
	// Get a new logger from context, to pass traceIDs etc.
	logger := q.log.FromContext(ctx)
	searcher, err := q.Query.Searcher(ctx, i, m, options)
	if err != nil {
		return nil, err
	}
	dvReader, err := i.DocValueReader([]string{"folder"})
	if err != nil {
		return nil, err
	}
	filteringSearcher := bleveSearch.NewFilteringSearcher(ctx, searcher, func(d *search.DocumentMatch) bool {
		// The doc ID has the format: <namespace>/<group>/<resourceType>/<name>
		// IndexInternalID will be the same as the doc ID when using an in-memory index, but when using a file-based
		// index it becomes a binary encoded number that has some other internal meaning. Using ExternalID() will get the
		// correct doc ID regardless of the index type.
		d.ID, err = i.ExternalID(d.IndexInternalID)
		if err != nil {
			logger.Debug("Error getting external ID", "error", err)
			return false
		}

		parts := strings.Split(d.ID, "/")
		// Exclude doc if id isn't expected format
		if len(parts) != 4 {
			logger.Debug("Unexpected document ID format", "id", d.ID)
			return false
		}
		ns := parts[0]
		resource := parts[2]
		name := parts[3]
		folder := ""
		err = dvReader.VisitDocValues(d.IndexInternalID, func(field string, value []byte) {
			if field == "folder" {
				folder = string(value)
			}
		})
		if err != nil {
			logger.Debug("Error reading doc values", "error", err)
			return false
		}
		if _, ok := q.checkers[resource]; !ok {
			logger.Debug("No resource checker found", "resource", resource)
			return false
		}
		allowed := q.checkers[resource](name, folder)
		if !allowed {
			logger.Debug("Denying access", "ns", ns, "name", name, "folder", folder)
		}
		return allowed
	})

	return filteringSearcher, nil
}

// hasTerms - any value that will be split into multiple tokens
var hasTerms = func(v string) (string, bool) {
	for _, c := range TermCharacters {
		if strings.Contains(v, c) {
			return c, true
		}
	}
	return "", false
}

// TermCharacters characters that will be used to determine if a value is split into tokens
var TermCharacters = []string{
	" ", "-", "_", ".", ",", ":", ";", "?", "!", "@", "#", "$", "%", "^", "&", "*", "(", ")", "+",
	"=", "{", "}", "[", "]", "|", "\\", "/", "<", ">", "~", "`",
	"'", "\"",
}
