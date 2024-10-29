package resource

import (
	"context"
	golog "log"
	"os"
	"path/filepath"
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

type Shard struct {
	index bleve.Index
	path  string
	batch *bleve.Batch
}

type Index struct {
	shards map[string]Shard
	opts   Opts
	s      *server
	log    log.Logger
	tracer tracing.Tracer
}

func NewIndex(s *server, opts Opts, tracer tracing.Tracer) *Index {
	if opts.IndexDir == "" {
		opts.IndexDir = os.TempDir()
	}

	idx := &Index{
		s:      s,
		opts:   opts,
		shards: make(map[string]Shard),
		log:    log.New("unifiedstorage.search.index"),
		tracer: tracer,
	}

	return idx
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
	for tenant, _ := range tenantsWithChanges {
		tenants = append(tenants, tenant)
	}

	return tenants, nil
}

func (i *Index) Init(ctx context.Context) error {
	ctx, span := i.tracer.Start(ctx, tracingPrexfixIndex+"Init")
	defer span.End()

	start := time.Now().Unix()
	resourceTypes := fetchResourceTypes()
	totalObjectsFetched := 0
	for _, rt := range resourceTypes {
		i.log.Info("indexing resource", "kind", rt.Key.Resource, "list_limit", i.opts.ListLimit, "batch_size", i.opts.BatchSize, "workers", i.opts.Workers)
		r := &ListRequest{Options: rt, Limit: int64(i.opts.ListLimit)}

		// Paginate through the list of resources and index each page
		for {
			i.log.Info("fetching resource list", "kind", rt.Key.Resource)
			list, err := i.s.List(ctx, r)
			if err != nil {
				return err
			}

			totalObjectsFetched += len(list.Items)

			i.log.Info("indexing batch", "kind", rt.Key.Resource, "count", len(list.Items))
			//add changes to batches for shards with changes in the List
			tenants, err := i.AddToBatches(ctx, list)
			if err != nil {
				return err
			}

			// Index the batches for tenants with changes if the batch is large enough
			err = i.IndexBatches(ctx, i.opts.BatchSize, tenants)
			if err != nil {
				return err
			}

			if list.NextPageToken == "" {
				break
			}

			r.NextPageToken = list.NextPageToken
		}
	}

	//index all remaining batches
	i.log.Info("indexing remaining batches", "shards", len(i.shards))
	err := i.IndexBatches(ctx, 1, i.allTenants())
	if err != nil {
		return err
	}

	span.AddEvent("indexing finished", trace.WithAttributes(attribute.Int64("objects_indexed", int64(totalObjectsFetched))))
	end := time.Now().Unix()
	i.log.Info("Initial indexing finished", "seconds", float64(end-start))
	if IndexServerMetrics != nil {
		IndexServerMetrics.IndexCreationTime.WithLabelValues().Observe(float64(end - start))
	}

	return nil
}

func (i *Index) Index(ctx context.Context, data *Data) error {
	_, span := i.tracer.Start(ctx, tracingPrexfixIndex+"Index")
	defer span.End()

	// Transform the raw resource into a more generic indexable resource
	res, err := NewIndexedResource(data.Value.Value)
	if err != nil {
		return err
	}
	tenant := res.Namespace
	i.log.Debug("indexing resource for tenant", "res", string(data.Value.Value), "tenant", tenant)
	shard, err := i.getShard(tenant)
	if err != nil {
		return err
	}
	err = shard.index.Index(res.Uid, res)
	if err != nil {
		return err
	}

	// record latency from when event was created to when it was indexed
	latencySeconds := float64(time.Now().UnixMicro()-data.Value.ResourceVersion) / 1e6
	if latencySeconds > 5 {
		i.log.Warn("high index latency", "latency", latencySeconds)
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

func (i *Index) Search(ctx context.Context, tenant string, query string, limit int, offset int) ([]IndexedResource, error) {
	_, span := i.tracer.Start(ctx, tracingPrexfixIndex+"Search")
	defer span.End()

	if tenant == "" {
		tenant = "default"
	}
	shard, err := i.getShard(tenant)
	if err != nil {
		return nil, err
	}
	docCount, err := shard.index.DocCount()
	if err != nil {
		return nil, err
	}
	i.log.Info("got index for tenant", "tenant", tenant, "docCount", docCount)

	fields, _ := shard.index.Fields()
	i.log.Debug("indexed fields", "fields", fields)

	// use 10 as a default limit for now
	if limit <= 0 {
		limit = 10
	}

	req := bleve.NewSearchRequest(bleve.NewQueryStringQuery(query))
	req.From = offset
	req.Size = limit

	req.Fields = []string{"*"} // return all indexed fields in search results

	i.log.Info("searching index", "query", query, "tenant", tenant)
	res, err := shard.index.Search(req)
	if err != nil {
		return nil, err
	}
	hits := res.Hits

	i.log.Info("got search results", "hits", hits)

	results := make([]IndexedResource, len(hits))
	for resKey, hit := range hits {
		ir := IndexedResource{}.FromSearchHit(hit)
		results[resKey] = ir
	}

	return results, nil
}

func (i *Index) Count() (uint64, error) {
	var total uint64
	for _, shard := range i.shards {
		count, err := shard.index.DocCount()
		if err != nil {
			i.log.Error("failed to get doc count", "error", err)
		}
		total += count
	}
	return total, nil
}

type Opts struct {
	Workers   int    // This controls how many goroutines are used to index objects
	BatchSize int    // This is the batch size for how many objects to add to the index at once
	ListLimit int    // This is how big the List page size is. If the response size is too large, the number of items will be limited by the server.
	IndexDir  string // The directory where the indexes for each tenant are stored
}

func createFileIndex(path string) (bleve.Index, string, error) {
	indexPath := filepath.Join(path, uuid.New().String())
	index, err := bleve.New(indexPath, createIndexMappings())
	if err != nil {
		golog.Fatalf("Failed to create index: %v", err)
	}
	return index, indexPath, err
}

func (i *Index) allTenants() []string {
	tenants := make([]string, 0, len(i.shards))
	for tenant := range i.shards {
		tenants = append(tenants, tenant)
	}
	return tenants
}

func (i *Index) getShard(tenant string) (Shard, error) {
	shard, ok := i.shards[tenant]
	if ok {
		return shard, nil
	}
	index, path, err := createFileIndex(i.opts.IndexDir)
	if err != nil {
		return Shard{}, err
	}

	shard = Shard{
		index: index,
		path:  path,
		batch: index.NewBatch(),
	}
	// TODO: do we need to lock this?
	i.shards[tenant] = shard
	return shard, nil
}

// TODO - fetch from api
func fetchResourceTypes() []*ListOptions {
	items := []*ListOptions{}
	items = append(items, &ListOptions{
		Key: &ResourceKey{
			Group:    "playlist.grafana.app",
			Resource: "playlists",
		},
	}, &ListOptions{
		Key: &ResourceKey{
			Group:    "folder.grafana.app",
			Resource: "folders",
		},
	})
	return items
}
