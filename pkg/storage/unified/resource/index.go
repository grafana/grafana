package resource

import (
	"context"
	golog "log"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/blevesearch/bleve/v2"
	"github.com/google/uuid"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
	"golang.org/x/sync/errgroup"
)

const tracingPrexfixIndex = "unified_storage.index."
const specFieldPrefix = "Spec."
const descendingPrefix = "-"

type Shard struct {
	index bleve.Index
	path  string
	batch *bleve.Batch
}

type Opts struct {
	Workers   int    // This controls how many goroutines are used to index objects
	BatchSize int    // This is the batch size for how many objects to add to the index at once
	ListLimit int    // This is how big the List page size is. If the response size is too large, the number of items will be limited by the server.
	IndexDir  string // The directory where the indexes for each tenant are stored
}

type Index struct {
	shardMutex sync.RWMutex
	shards     map[string]*Shard
	opts       Opts
	s          *server
	log        log.Logger
	tracer     tracing.Tracer
}

func NewIndex(s *server, opts Opts, tracer tracing.Tracer) *Index {
	return &Index{
		shardMutex: sync.RWMutex{},
		s:          s,
		opts:       opts,
		shards:     make(map[string]*Shard),
		log:        log.New("unifiedstorage.search.index"),
		tracer:     tracer,
	}
}

// IndexBatches goes through all the shards and indexes their batches if they are large enough
func (i *Index) IndexBatches(ctx context.Context, maxSize int, tenants []string) error {
	_, span := i.tracer.Start(ctx, tracingPrexfixIndex+"IndexBatches")
	defer span.End()

	group := errgroup.Group{}
	group.SetLimit(i.opts.Workers)
	totalBatchesIndexed := 0

	for _, tenant := range tenants {
		shard, err := i.getShard(tenant)
		if err != nil {
			return err
		}
		// Index the batch if it is large enough
		if shard.batch.Size() >= maxSize {
			totalBatchesIndexed++
			group.Go(func() error {
				i.log.Debug("indexing batch for shard", "tenant", tenant, "size", shard.batch.Size())
				err = shard.index.Batch(shard.batch)
				if err != nil {
					return err
				}
				shard.batch.Reset()
				return nil
			})
		}
	}

	err := group.Wait()
	if err != nil {
		return err
	}

	span.AddEvent("batches indexed", trace.WithAttributes(attribute.Int("batches_indexed", totalBatchesIndexed)))

	return nil
}

// AddToBatches adds resources to their respective shard's batch
// returns a list of tenants that have changes
func (i *Index) AddToBatches(ctx context.Context, list *ListResponse) ([]string, error) {
	_, span := i.tracer.Start(ctx, tracingPrexfixIndex+"AddToBatches")
	defer span.End()

	tenantsWithChanges := make(map[string]bool)
	for _, obj := range list.Items {
		// Transform the raw resource into a more generic indexable resource
		res, err := NewIndexedResource(obj.Value)
		if err != nil {
			return nil, err
		}

		shard, err := i.getShard(res.Namespace)
		if err != nil {
			return nil, err
		}
		i.log.Debug("indexing resource in batch", "batch_count", len(list.Items), "kind", res.Kind, "tenant", res.Namespace)

		err = shard.batch.Index(res.Uid, res)
		if err != nil {
			return nil, err
		}

		if _, ok := tenantsWithChanges[res.Namespace]; !ok {
			tenantsWithChanges[res.Namespace] = true
		}
	}

	tenants := make([]string, 0, len(tenantsWithChanges))
	for tenant := range tenantsWithChanges {
		tenants = append(tenants, tenant)
	}

	return tenants, nil
}

func (i *Index) Init(ctx context.Context) error {
	logger := i.log.FromContext(ctx)
	ctx, span := i.tracer.Start(ctx, tracingPrexfixIndex+"Init")
	defer span.End()

	start := time.Now().Unix()
	group := errgroup.Group{}
	group.SetLimit(i.opts.Workers)

	totalObjects := 0
	// Get all tenants currently in Unified Storage
	tenants, err := i.s.backend.Namespaces(ctx)
	if err != nil {
		return err
	}
	for _, tenant := range tenants {
		group.Go(func() error {
			logger.Info("initializing index for tenant", "tenant", tenant)
			objs, err := i.InitForTenant(ctx, tenant)
			if err != nil {
				return err
			}
			totalObjects += objs
			return nil
		})
	}

	err = group.Wait()
	if err != nil {
		return err
	}

	//index all remaining batches for all tenants
	logger.Info("indexing remaining batches", "shards", len(i.shards))
	err = i.IndexBatches(ctx, 1, i.allTenants())
	if err != nil {
		return err
	}

	end := time.Now().Unix()
	totalDocCount := getTotalDocCount(i)
	logger.Info("Initial indexing finished", "seconds", float64(end-start), "objs_fetched", totalObjects, "objs_indexed", totalDocCount)
	span.AddEvent(
		"indexing finished",
		trace.WithAttributes(attribute.Int64("objects_indexed", int64(totalDocCount))),
		trace.WithAttributes(attribute.Int64("objects_fetched", int64(totalObjects))),
	)
	if IndexServerMetrics != nil {
		IndexServerMetrics.IndexCreationTime.WithLabelValues().Observe(float64(end - start))
	}

	return nil
}

func (i *Index) InitForTenant(ctx context.Context, namespace string) (int, error) {
	ctx, span := i.tracer.Start(ctx, tracingPrexfixIndex+"InitForTenant")
	defer span.End()
	logger := i.log.FromContext(ctx)

	resourceTypes := fetchResourceTypes()
	totalObjectsFetched := 0
	for _, rt := range resourceTypes {
		logger.Debug("indexing resource", "kind", rt.Key.Resource, "list_limit", i.opts.ListLimit, "batch_size", i.opts.BatchSize, "workers", i.opts.Workers, "namespace", namespace)
		r := &ListRequest{Options: rt, Limit: int64(i.opts.ListLimit)}
		r.Options.Key.Namespace = namespace // scope the list to a tenant or this will take forever when US has 1M+ resources

		// Paginate through the list of resources and index each page
		for {
			logger.Debug("fetching resource list", "kind", rt.Key.Resource, "namespace", namespace)
			list, err := i.s.List(ctx, r)
			if err != nil {
				return totalObjectsFetched, err
			}

			// Record the number of objects indexed for the kind
			IndexServerMetrics.IndexedKinds.WithLabelValues(rt.Key.Resource).Add(float64(len(list.Items)))

			totalObjectsFetched += len(list.Items)

			logger.Debug("indexing batch", "kind", rt.Key.Resource, "count", len(list.Items), "namespace", namespace)
			//add changes to batches for shards with changes in the List
			err = i.writeBatch(ctx, list)
			if err != nil {
				return totalObjectsFetched, err
			}

			if list.NextPageToken == "" {
				break
			}

			r.NextPageToken = list.NextPageToken
		}
	}

	span.AddEvent(
		"indexing finished for tenant",
		trace.WithAttributes(attribute.Int64("objects_indexed", int64(totalObjectsFetched))),
		trace.WithAttributes(attribute.String("tenant", namespace)),
	)

	return totalObjectsFetched, nil
}

func (i *Index) writeBatch(ctx context.Context, list *ListResponse) error {
	tenants, err := i.AddToBatches(ctx, list)
	if err != nil {
		return err
	}

	// Index the batches for tenants with changes if the batch is large enough
	err = i.IndexBatches(ctx, i.opts.BatchSize, tenants)
	if err != nil {
		return err
	}
	return nil
}

func (i *Index) Index(ctx context.Context, data *Data) error {
	ctx, span := i.tracer.Start(ctx, tracingPrexfixIndex+"Index")
	defer span.End()
	logger := i.log.FromContext(ctx)

	// Transform the raw resource into a more generic indexable resource
	res, err := NewIndexedResource(data.Value.Value)
	if err != nil {
		return err
	}
	tenant := res.Namespace
	logger.Debug("indexing resource for tenant", "res", string(data.Value.Value), "tenant", tenant)

	// if tenant doesn't exist, they may have been created during initial indexing
	_, ok := i.shards[tenant]
	if !ok {
		i.log.Info("tenant not found, initializing their index", "tenant", tenant)
		_, err = i.InitForTenant(ctx, tenant)
		if err != nil {
			return err
		}
	}

	shard, err := i.getShard(tenant)
	if err != nil {
		return err
	}
	err = shard.index.Index(res.Uid, res)
	if err != nil {
		return err
	}

	//record the kind of resource that was indexed
	IndexServerMetrics.IndexedKinds.WithLabelValues(res.Kind).Inc()

	// record latency from when event was created to when it was indexed
	latencySeconds := float64(time.Now().UnixMicro()-data.Value.ResourceVersion) / 1e6
	if latencySeconds > 5 {
		logger.Warn("high index latency", "latency", latencySeconds)
	}
	if IndexServerMetrics != nil {
		IndexServerMetrics.IndexLatency.WithLabelValues(data.Key.Resource).Observe(latencySeconds)
	}

	return nil
}

func (i *Index) Delete(ctx context.Context, uid string, key *ResourceKey) error {
	_, span := i.tracer.Start(ctx, tracingPrexfixIndex+"Delete")
	defer span.End()

	shard, err := i.getShard(key.Namespace)
	if err != nil {
		return err
	}
	err = shard.index.Delete(uid)
	if err != nil {
		return err
	}
	return nil
}

func (i *Index) Search(ctx context.Context, request *SearchRequest) (*IndexResults, error) {
	ctx, span := i.tracer.Start(ctx, tracingPrexfixIndex+"Search")
	defer span.End()
	logger := i.log.FromContext(ctx)

	if request.Tenant == "" {
		request.Tenant = "default"
	}
	shard, err := i.getShard(request.Tenant)
	if err != nil {
		return nil, err
	}
	docCount, err := shard.index.DocCount()
	if err != nil {
		return nil, err
	}
	logger.Info("got index for tenant", "tenant", request.Tenant, "docCount", docCount)

	fields, _ := shard.index.Fields()
	logger.Debug("indexed fields", "fields", fields)

	// use 10 as a default limit for now
	if request.Limit <= 0 {
		request.Limit = 10
	}

	textQuery := bleve.NewQueryStringQuery(request.Query)
	query := bleve.NewConjunctionQuery(textQuery)

	if len(request.Kind) > 0 {
		// apply OR condition filter for each kind ( dashboard, folder, etc )
		orQuery := bleve.NewDisjunctionQuery()
		for _, term := range request.Kind {
			termQuery := bleve.NewTermQuery(term)
			orQuery.AddQuery(termQuery)
		}
		query.AddQuery(orQuery)
	}

	req := bleve.NewSearchRequest(query)
	if len(request.SortBy) > 0 {
		sorting := getSortFields(request)
		req.SortBy(sorting)
	}

	for _, group := range request.GroupBy {
		facet := bleve.NewFacetRequest(specFieldPrefix+group.Name, int(group.Limit))
		req.AddFacet(group.Name+"_facet", facet)
	}

	req.From = int(request.Offset)
	req.Size = int(request.Limit)

	req.Fields = []string{"*"} // return all indexed fields in search results

	logger.Info("searching index", "query", request.Query, "tenant", request.Tenant)
	res, err := shard.index.Search(req)
	if err != nil {
		return nil, err
	}
	hits := res.Hits

	logger.Info("got search results", "hits", hits)

	results := make([]IndexedResource, len(hits))
	for resKey, hit := range hits {
		ir := IndexedResource{}.FromSearchHit(hit)
		results[resKey] = ir
	}

	groups := []*Group{}
	for _, group := range request.GroupBy {
		groupByFacet := res.Facets[group.Name+"_facet"]
		for _, term := range groupByFacet.Terms.Terms() {
			groups = append(groups, &Group{Name: term.Term, Count: int64(term.Count)})
		}
	}

	return &IndexResults{Values: results, Groups: groups}, nil
}

// Count returns the total doc count
func (i *Index) Count() (int, error) {
	total := 0
	for _, shard := range i.shards {
		count, err := shard.index.DocCount()
		if err != nil {
			i.log.Error("failed to get doc count", "error", err)
		}
		total += int(count)
	}
	return total, nil
}

// allTenants returns a list of all tenants in the index
func (i *Index) allTenants() []string {
	tenants := make([]string, 0, len(i.shards))
	for tenant := range i.shards {
		tenants = append(tenants, tenant)
	}
	return tenants
}

func (i *Index) getShard(tenant string) (*Shard, error) {
	i.shardMutex.Lock()
	defer i.shardMutex.Unlock()

	shard, ok := i.shards[tenant]
	if ok {
		return shard, nil
	}

	index, path, err := i.createIndex()
	if err != nil {
		return &Shard{}, err
	}

	shard = &Shard{
		index: index,
		path:  path,
		batch: index.NewBatch(),
	}
	i.shards[tenant] = shard

	return shard, nil
}

func (i *Index) createIndex() (bleve.Index, string, error) {
	if i.opts.IndexDir == "" {
		return createInMemoryIndex()
	}
	return createFileIndex(i.opts.IndexDir)
}

var mappings = createIndexMappings()

// less memory intensive alternative for larger indexes with less tenants (on-prem)
func createFileIndex(path string) (bleve.Index, string, error) {
	indexPath := filepath.Join(path, uuid.New().String())
	index, err := bleve.New(indexPath, mappings)
	if err != nil {
		golog.Fatalf("Failed to create index: %v", err)
	}
	return index, indexPath, err
}

// faster indexing when there are many tenants with smaller batches (cloud)
func createInMemoryIndex() (bleve.Index, string, error) {
	index, err := bleve.NewMemOnly(mappings)
	return index, "", err
}

// TODO - fetch from api
func fetchResourceTypes() []*ListOptions {
	items := []*ListOptions{}
	items = append(items,
		&ListOptions{
			Key: &ResourceKey{
				Group:    "playlist.grafana.app",
				Resource: "playlists",
			},
		},
		&ListOptions{
			Key: &ResourceKey{
				Group:    "folder.grafana.app",
				Resource: "folders",
			},
		},
		&ListOptions{
			Key: &ResourceKey{
				Group:    "dashboard.grafana.app",
				Resource: "dashboards",
			},
		})
	return items
}

func getSortFields(request *SearchRequest) []string {
	sorting := make([]string, 0, len(request.SortBy))
	for _, sort := range request.SortBy {
		if IsSpecField(sort) {
			descending := strings.HasPrefix(sort, descendingPrefix)
			sort = strings.TrimPrefix(sort, descendingPrefix)
			sortOrder := ""
			if descending {
				sortOrder = descendingPrefix
			}
			sorting = append(sorting, sortOrder+specFieldPrefix+sort)
			continue
		}
		sorting = append(sorting, sort)
	}
	return sorting
}
