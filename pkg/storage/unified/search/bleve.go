package search

import (
	"context"
	"encoding/json"
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
	"go.opentelemetry.io/otel/trace"
	"k8s.io/apimachinery/pkg/selection"

	"github.com/grafana/grafana/pkg/services/dashboards/dashboardaccess"
	"github.com/grafana/grafana/pkg/services/featuremgmt"

	authlib "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

const tracingPrexfixBleve = "unified_search.bleve."

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
}

type bleveBackend struct {
	tracer trace.Tracer
	log    *slog.Logger
	opts   BleveOptions
	start  time.Time

	// cache info
	cache   map[resource.NamespacedResource]*bleveIndex
	cacheMu sync.RWMutex

	features     featuremgmt.FeatureToggles
	indexMetrics *resource.BleveIndexMetrics
}

func NewBleveBackend(opts BleveOptions, tracer trace.Tracer, features featuremgmt.FeatureToggles, indexMetrics *resource.BleveIndexMetrics) (*bleveBackend, error) {
	if opts.Root == "" {
		return nil, fmt.Errorf("bleve backend missing root folder configuration")
	}
	root, err := os.Stat(opts.Root)
	if err != nil {
		return nil, fmt.Errorf("error opening bleve root folder %w", err)
	}
	if !root.IsDir() {
		return nil, fmt.Errorf("bleve root is configured against a file (not folder)")
	}

	bleveBackend := &bleveBackend{
		log:          slog.Default().With("logger", "bleve-backend"),
		tracer:       tracer,
		cache:        make(map[resource.NamespacedResource]*bleveIndex),
		opts:         opts,
		start:        time.Now(),
		features:     features,
		indexMetrics: indexMetrics,
	}

	go bleveBackend.updateIndexSizeMetric(opts.Root)

	return bleveBackend, nil
}

// This will return nil if the key does not exist
func (b *bleveBackend) GetIndex(ctx context.Context, key resource.NamespacedResource) (resource.ResourceIndex, error) {
	b.cacheMu.RLock()
	defer b.cacheMu.RUnlock()

	idx, ok := b.cache[key]
	if ok {
		return idx, nil
	}
	return nil, nil
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

// Build an index from scratch
func (b *bleveBackend) BuildIndex(ctx context.Context,
	key resource.NamespacedResource,

	// When the size is known, it will be passed along here
	// Depending on the size, the backend may choose different options (eg: memory vs disk)
	size int64,

	// The last known resource version can be used to know that we can skip calling the builder
	resourceVersion int64,

	// the non-standard searchable fields
	fields resource.SearchableDocumentFields,

	// The builder will write all documents before returning
	builder func(index resource.ResourceIndex) (int64, error),
) (resource.ResourceIndex, error) {
	_, span := b.tracer.Start(ctx, tracingPrexfixBleve+"BuildIndex")
	defer span.End()

	var err error
	var index bleve.Index

	build := true
	mapper, err := GetBleveMappings(fields)
	if err != nil {
		return nil, err
	}

	if size > b.opts.FileThreshold {
		resourceDir := filepath.Join(b.opts.Root, key.Namespace,
			fmt.Sprintf("%s.%s", key.Resource, key.Group),
		)
		fname := fmt.Sprintf("rv%d", resourceVersion)
		if resourceVersion == 0 {
			fname = b.start.Format("tmp-20060102-150405")
		}
		dir := filepath.Join(resourceDir, fname)
		if !isValidPath(dir, b.opts.Root) {
			b.log.Error("Directory is not valid", "directory", dir)
		}
		if resourceVersion > 0 {
			info, _ := os.Stat(dir)
			if info != nil && info.IsDir() {
				index, err = bleve.Open(dir) // NOTE, will use the same mappings!!!
				if err == nil {
					found, err := index.DocCount()
					if err != nil || int64(found) != size {
						b.log.Info("this size changed since the last time the index opened")
						_ = index.Close()

						// Pick a new file name
						fname = b.start.Format("tmp-20060102-150405-changed")
						dir = filepath.Join(resourceDir, fname)
						index = nil
					} else {
						build = false // no need to build the index
					}
				}
			}
		}

		if index == nil {
			index, err = bleve.New(dir, mapper)
			if err != nil {
				err = fmt.Errorf("error creating new bleve index: %s %w", dir, err)
			}
		}

		// Start a background task to cleanup the old index directories
		if index != nil && err == nil {
			go b.cleanOldIndexes(resourceDir, fname)
		}
		if b.indexMetrics != nil {
			b.indexMetrics.IndexTenants.WithLabelValues("file").Inc()
		}
	} else {
		index, err = bleve.NewMemOnly(mapper)
		if b.indexMetrics != nil {
			b.indexMetrics.IndexTenants.WithLabelValues("memory").Inc()
		}
	}
	if err != nil {
		return nil, err
	}

	// Batch all the changes
	idx := &bleveIndex{
		key:       key,
		index:     index,
		batch:     index.NewBatch(),
		batchSize: b.opts.BatchSize,
		fields:    fields,
		standard:  resource.StandardSearchFields(),
		features:  b.features,
		tracing:   b.tracer,
	}

	idx.allFields, err = getAllFields(idx.standard, fields)
	if err != nil {
		return nil, err
	}

	if build {
		_, err = builder(idx)
		if err != nil {
			return nil, err
		}

		// Flush the batch
		err = idx.Flush()
		if err != nil {
			return nil, err
		}
	}

	b.cacheMu.Lock()
	b.cache[key] = idx
	b.cacheMu.Unlock()
	return idx, nil
}

func (b *bleveBackend) cleanOldIndexes(dir string, skip string) {
	files, err := os.ReadDir(dir)
	if err != nil {
		b.log.Warn("error cleaning folders from", "directory", dir, "error", err)
		return
	}
	for _, file := range files {
		if file.IsDir() && file.Name() != skip {
			fpath := filepath.Join(dir, file.Name())
			if !isValidPath(dir, b.opts.Root) {
				b.log.Error("Path is not valid", "directory", fpath, "error", err)
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

// isValidPath does a sanity check in case it tries to access a different dir
func isValidPath(path, safeDir string) bool {
	if path == "" || safeDir == "" {
		return false
	}
	cleanPath := filepath.Clean(path)
	cleanSafeDir := filepath.Clean(safeDir)

	rel, err := filepath.Rel(cleanSafeDir, cleanPath)
	if err != nil {
		return false
	}
	return !strings.HasPrefix(rel, "..") && !strings.Contains(rel, "\\")
}

// TotalDocs returns the total number of documents across all indices
func (b *bleveBackend) TotalDocs() int64 {
	var totalDocs int64
	for _, v := range b.cache {
		c, err := v.index.DocCount()
		if err != nil {
			continue
		}
		totalDocs += int64(c)
	}
	return totalDocs
}

type bleveIndex struct {
	key   resource.NamespacedResource
	index bleve.Index

	standard resource.SearchableDocumentFields
	fields   resource.SearchableDocumentFields

	// The values returned with all
	allFields []*resource.ResourceTableColumnDefinition

	// only valid in single thread
	batch     *bleve.Batch
	batchSize int // ??? not totally sure the units here

	features featuremgmt.FeatureToggles
	tracing  trace.Tracer
}

// Write implements resource.DocumentIndex.
func (b *bleveIndex) Write(v *resource.IndexableDocument) error {
	v = v.UpdateCopyFields()

	// remove references (for now!)
	v.References = nil
	if b.batch != nil {
		err := b.batch.Index(v.Key.SearchID(), v)
		if err != nil {
			return err
		}
		if b.batch.Size() > b.batchSize {
			err = b.index.Batch(b.batch)
			b.batch.Reset() // clear the batch
		}
		return err // nil
	}
	return b.index.Index(v.Key.SearchID(), v)
}

// Delete implements resource.DocumentIndex.
func (b *bleveIndex) Delete(key *resource.ResourceKey) error {
	if b.batch != nil {
		return fmt.Errorf("unexpected delete while building batch")
	}
	return b.index.Delete(key.SearchID())
}

// Flush implements resource.DocumentIndex.
func (b *bleveIndex) Flush() (err error) {
	if b.batch != nil {
		err = b.index.Batch(b.batch)
		b.batch.Reset()
		b.batch = nil
	}
	return err
}

func (b *bleveIndex) ListManagedObjects(ctx context.Context, req *resource.ListManagedObjectsRequest) (*resource.ListManagedObjectsResponse, error) {
	if req.NextPageToken != "" {
		return nil, fmt.Errorf("next page not implemented yet")
	}
	if req.Kind == "" {
		return &resource.ListManagedObjectsResponse{
			Error: resource.NewBadRequestError("empty manager kind"),
		}, nil
	}
	if req.Id == "" {
		return &resource.ListManagedObjectsResponse{
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

	rsp := &resource.ListManagedObjectsResponse{}
	for _, hit := range found.Hits {
		item := &resource.ListManagedObjectsResponse_Item{
			Object: &resource.ResourceKey{},
			Hash:   asString(hit.Fields[resource.SEARCH_FIELD_SOURCE_CHECKSUM]),
			Path:   asString(hit.Fields[resource.SEARCH_FIELD_SOURCE_PATH]),
			Time:   asTime(hit.Fields[resource.SEARCH_FIELD_SOURCE_TIME]),
			Title:  asString(hit.Fields[resource.SEARCH_FIELD_TITLE]),
			Folder: asString(hit.Fields[resource.SEARCH_FIELD_FOLDER]),
		}
		err := item.Object.ReadSearchID(hit.ID)
		if err != nil {
			return nil, err
		}
		rsp.Items = append(rsp.Items, item)
	}
	return rsp, nil
}

func (b *bleveIndex) CountManagedObjects(ctx context.Context) ([]*resource.CountManagedObjectsResponse_ResourceCount, error) {
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
	vals := make([]*resource.CountManagedObjectsResponse_ResourceCount, 0)
	f, ok := found.Facets["count"]
	if ok && f.Terms != nil {
		for _, v := range f.Terms.Terms() {
			val := v.Term
			idx := strings.Index(val, ":")
			if idx > 0 {
				vals = append(vals, &resource.CountManagedObjectsResponse_ResourceCount{
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
	req *resource.ResourceSearchRequest,
	federate []resource.ResourceIndex, // For federated queries, these will match the values in req.federate
) (*resource.ResourceSearchResponse, error) {
	ctx, span := b.tracing.Start(ctx, tracingPrexfixBleve+"Search")
	defer span.End()

	if req.Options == nil || req.Options.Key == nil {
		return &resource.ResourceSearchResponse{
			Error: resource.NewBadRequestError("missing query key"),
		}, nil
	}

	response := &resource.ResourceSearchResponse{
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
			response.Facet = make(map[string]*resource.ResourceSearchResponse_Facet)
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
func (b *bleveIndex) verifyKey(key *resource.ResourceKey) *resource.ErrorResult {
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
	req *resource.ResourceSearchRequest,
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

func (b *bleveIndex) toBleveSearchRequest(ctx context.Context, req *resource.ResourceSearchRequest, access authlib.AccessClient) (*bleve.SearchRequest, *resource.ErrorResult) {
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

	if access != nil && b.features.IsEnabledGlobally(featuremgmt.FlagUnifiedStorageSearchPermissionFiltering) {
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

func safeInt64ToInt(i64 int64) (int, error) {
	if i64 > math.MaxInt32 || i64 < math.MinInt32 {
		return 0, fmt.Errorf("int64 value %d overflows int", i64)
	}
	return int(i64), nil
}

func getSortFields(req *resource.ResourceSearchRequest) []string {
	sorting := []string{}
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
func requirementQuery(req *resource.Requirement, prefix string) (query.Query, *resource.ErrorResult) {
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

func (b *bleveIndex) hitsToTable(ctx context.Context, selectFields []string, hits search.DocumentMatchCollection, explain bool) (*resource.ResourceTable, error) {
	_, span := b.tracing.Start(ctx, tracingPrexfixBleve+"hitsToTable")
	defer span.End()

	fields := []*resource.ResourceTableColumnDefinition{}
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
				f = &resource.ResourceTableColumnDefinition{
					Name: name,
					Type: resource.ResourceTableColumnDefinition_STRING,
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

	table := &resource.ResourceTable{
		Columns: fields,
		Rows:    make([]*resource.ResourceTableRow, hits.Len()),
	}
	for rowID, match := range hits {
		row := &resource.ResourceTableRow{
			Key:   &resource.ResourceKey{},
			Cells: make([][]byte, len(fields)),
		}
		table.Rows[rowID] = row

		err := row.Key.ReadSearchID(match.ID)
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

func getAllFields(standard resource.SearchableDocumentFields, custom resource.SearchableDocumentFields) ([]*resource.ResourceTableColumnDefinition, error) {
	fields := []*resource.ResourceTableColumnDefinition{
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

func newResponseFacet(v *search.FacetResult) *resource.ResourceSearchResponse_Facet {
	f := &resource.ResourceSearchResponse_Facet{
		Field:   v.Field,
		Total:   int64(v.Total),
		Missing: int64(v.Missing),
	}
	if v.Terms != nil {
		for _, t := range v.Terms.Terms() {
			f.Terms = append(f.Terms, &resource.ResourceSearchResponse_TermFacet{
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
			q.log.Debug("Error getting external ID", "error", err)
			return false
		}

		parts := strings.Split(d.ID, "/")
		// Exclude doc if id isn't expected format
		if len(parts) != 4 {
			q.log.Debug("Unexpected document ID format", "id", d.ID)
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
			q.log.Debug("Error reading doc values", "error", err)
			return false
		}
		if _, ok := q.checkers[resource]; !ok {
			q.log.Debug("No resource checker found", "resource", resource)
			return false
		}
		allowed := q.checkers[resource](name, folder)
		if !allowed {
			q.log.Debug("Denying access", "ns", ns, "name", name, "folder", folder)
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
