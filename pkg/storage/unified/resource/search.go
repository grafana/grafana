package resource

import (
	"cmp"
	"context"
	"fmt"
	"log/slog"
	"slices"
	"strings"
	"sync"
	"time"

	"github.com/hashicorp/golang-lru/v2/expirable"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
	"golang.org/x/sync/errgroup"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/authlib/types"

	dashboardv1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1beta1"
	folders "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1beta1"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

const maxBatchSize = 1000

type NamespacedResource struct {
	Namespace string
	Group     string
	Resource  string
}

// All fields are set
func (s *NamespacedResource) Valid() bool {
	return s.Namespace != "" && s.Group != "" && s.Resource != ""
}

type IndexAction int

const (
	ActionIndex IndexAction = iota
	ActionDelete
)

type BulkIndexItem struct {
	Action IndexAction
	Key    *resourcepb.ResourceKey // Only used for delete actions
	Doc    *IndexableDocument      // Only used for index actions
}

type BulkIndexRequest struct {
	Items           []*BulkIndexItem
	ResourceVersion int64
}

type ResourceIndex interface {
	// BulkIndex allows for multiple index actions to be performed in a single call.
	// The order of the items is guaranteed to be the same as the input
	BulkIndex(req *BulkIndexRequest) error

	// Search within a namespaced resource
	// When working with federated queries, the additional indexes will be passed in explicitly
	Search(ctx context.Context, access types.AccessClient, req *resourcepb.ResourceSearchRequest, federate []ResourceIndex) (*resourcepb.ResourceSearchResponse, error)

	// List within an response
	ListManagedObjects(ctx context.Context, req *resourcepb.ListManagedObjectsRequest) (*resourcepb.ListManagedObjectsResponse, error)

	// Counts the values in a repo
	CountManagedObjects(ctx context.Context) ([]*resourcepb.CountManagedObjectsResponse_ResourceCount, error)

	// Get the number of documents in the index
	DocCount(ctx context.Context, folder string) (int64, error)
}

// SearchBackend contains the technology specific logic to support search
type SearchBackend interface {
	// This will return nil if the key does not exist
	GetIndex(ctx context.Context, key NamespacedResource) (ResourceIndex, error)

	// Build an index from scratch
	BuildIndex(ctx context.Context,
		key NamespacedResource,

		// When the size is known, it will be passed along here
		// Depending on the size, the backend may choose different options (eg: memory vs disk)
		size int64,

		// The last known resource version (can be used to know that nothing has changed)
		resourceVersion int64,

		// The non-standard index fields
		fields SearchableDocumentFields,

		// The builder will write all documents before returning
		builder func(index ResourceIndex) (int64, error),
	) (ResourceIndex, error)

	// Gets the total number of documents across all indexes
	TotalDocs() int64
}

const tracingPrexfixSearch = "unified_search."

// This supports indexing+search regardless of implementation
type searchSupport struct {
	tracer       trace.Tracer
	log          *slog.Logger
	storage      StorageBackend
	search       SearchBackend
	indexMetrics *BleveIndexMetrics
	access       types.AccessClient
	builders     *builderCache
	initWorkers  int
	initMinSize  int

	// Index queue processors
	indexQueueProcessorsMutex sync.Mutex
	indexQueueProcessors      map[string]*indexQueueProcessor
	indexEventsChan           chan *IndexEvent

	// testing
	clientIndexEventsChan chan *IndexEvent
}

var (
	_ resourcepb.ResourceIndexServer      = (*searchSupport)(nil)
	_ resourcepb.ManagedObjectIndexServer = (*searchSupport)(nil)
)

func newSearchSupport(opts SearchOptions, storage StorageBackend, access types.AccessClient, blob BlobSupport, tracer trace.Tracer, indexMetrics *BleveIndexMetrics) (support *searchSupport, err error) {
	// No backend search support
	if opts.Backend == nil {
		return nil, nil
	}
	if tracer == nil {
		return nil, fmt.Errorf("missing tracer")
	}

	if opts.WorkerThreads < 1 {
		opts.WorkerThreads = 1
	}

	support = &searchSupport{
		access:                access,
		tracer:                tracer,
		storage:               storage,
		search:                opts.Backend,
		log:                   slog.Default().With("logger", "resource-search"),
		initWorkers:           opts.WorkerThreads,
		initMinSize:           opts.InitMinCount,
		indexMetrics:          indexMetrics,
		clientIndexEventsChan: opts.IndexEventsChan,
		indexEventsChan:       make(chan *IndexEvent),
		indexQueueProcessors:  make(map[string]*indexQueueProcessor),
	}

	info, err := opts.Resources.GetDocumentBuilders()
	if err != nil {
		return nil, err
	}

	support.builders, err = newBuilderCache(info, 100, time.Minute*2) // TODO? opts
	if support.builders != nil {
		support.builders.blob = blob
	}

	return support, err
}

func (s *searchSupport) ListManagedObjects(ctx context.Context, req *resourcepb.ListManagedObjectsRequest) (*resourcepb.ListManagedObjectsResponse, error) {
	if req.NextPageToken != "" {
		return &resourcepb.ListManagedObjectsResponse{
			Error: NewBadRequestError("multiple pages not yet supported"),
		}, nil
	}

	rsp := &resourcepb.ListManagedObjectsResponse{}
	stats, err := s.storage.GetResourceStats(ctx, req.Namespace, 0)
	if err != nil {
		rsp.Error = AsErrorResult(err)
		return rsp, nil
	}

	for _, info := range stats {
		idx, err := s.getOrCreateIndex(ctx, NamespacedResource{
			Namespace: req.Namespace,
			Group:     info.Group,
			Resource:  info.Resource,
		})
		if err != nil {
			rsp.Error = AsErrorResult(err)
			return rsp, nil
		}

		kind, err := idx.ListManagedObjects(ctx, req)
		if err != nil {
			rsp.Error = AsErrorResult(err)
			return rsp, nil
		}
		if kind.NextPageToken != "" {
			rsp.Error = &resourcepb.ErrorResult{
				Message: "Multiple pages are not yet supported",
			}
			return rsp, nil
		}
		rsp.Items = append(rsp.Items, kind.Items...)
	}

	// Sort based on path
	slices.SortFunc(rsp.Items, func(a, b *resourcepb.ListManagedObjectsResponse_Item) int {
		return cmp.Compare(a.Path, b.Path)
	})

	return rsp, nil
}

func (s *searchSupport) CountManagedObjects(ctx context.Context, req *resourcepb.CountManagedObjectsRequest) (*resourcepb.CountManagedObjectsResponse, error) {
	rsp := &resourcepb.CountManagedObjectsResponse{}
	stats, err := s.storage.GetResourceStats(ctx, req.Namespace, 0)
	if err != nil {
		rsp.Error = AsErrorResult(err)
		return rsp, nil
	}

	for _, info := range stats {
		idx, err := s.getOrCreateIndex(ctx, NamespacedResource{
			Namespace: req.Namespace,
			Group:     info.Group,
			Resource:  info.Resource,
		})
		if err != nil {
			rsp.Error = AsErrorResult(err)
			return rsp, nil
		}

		counts, err := idx.CountManagedObjects(ctx)
		if err != nil {
			rsp.Error = AsErrorResult(err)
			return rsp, nil
		}
		if req.Id == "" {
			rsp.Items = append(rsp.Items, counts...)
		} else {
			for _, k := range counts {
				if k.Id == req.Id {
					rsp.Items = append(rsp.Items, k)
				}
			}
		}
	}

	// Sort based on manager/group/resource
	slices.SortFunc(rsp.Items, func(a, b *resourcepb.CountManagedObjectsResponse_ResourceCount) int {
		return cmp.Or(
			cmp.Compare(a.Kind, b.Kind),
			cmp.Compare(a.Id, b.Id),
			cmp.Compare(a.Group, b.Group),
			cmp.Compare(a.Resource, b.Resource),
		)
	})

	return rsp, nil
}

// Search implements ResourceIndexServer.
func (s *searchSupport) Search(ctx context.Context, req *resourcepb.ResourceSearchRequest) (*resourcepb.ResourceSearchResponse, error) {
	ctx, span := s.tracer.Start(ctx, tracingPrexfixSearch+"Search")
	defer span.End()

	nsr := NamespacedResource{
		Group:     req.Options.Key.Group,
		Namespace: req.Options.Key.Namespace,
		Resource:  req.Options.Key.Resource,
	}
	idx, err := s.getOrCreateIndex(ctx, nsr)
	if err != nil {
		return &resourcepb.ResourceSearchResponse{
			Error: AsErrorResult(err),
		}, nil
	}

	// Get the federated indexes
	federate := make([]ResourceIndex, len(req.Federated))
	for i, f := range req.Federated {
		nsr.Group = f.Group
		nsr.Resource = f.Resource
		federate[i], err = s.getOrCreateIndex(ctx, nsr)
		if err != nil {
			return &resourcepb.ResourceSearchResponse{
				Error: AsErrorResult(err),
			}, nil
		}
	}

	return idx.Search(ctx, s.access, req, federate)
}

// GetStats implements ResourceServer.
func (s *searchSupport) GetStats(ctx context.Context, req *resourcepb.ResourceStatsRequest) (*resourcepb.ResourceStatsResponse, error) {
	if req.Namespace == "" {
		return &resourcepb.ResourceStatsResponse{
			Error: NewBadRequestError("missing namespace"),
		}, nil
	}
	rsp := &resourcepb.ResourceStatsResponse{}

	// Explicit list of kinds
	if len(req.Kinds) > 0 {
		rsp.Stats = make([]*resourcepb.ResourceStatsResponse_Stats, len(req.Kinds))
		for i, k := range req.Kinds {
			parts := strings.SplitN(k, "/", 2)
			index, err := s.getOrCreateIndex(ctx, NamespacedResource{
				Namespace: req.Namespace,
				Group:     parts[0],
				Resource:  parts[1],
			})
			if err != nil {
				rsp.Error = AsErrorResult(err)
				return rsp, nil
			}
			count, err := index.DocCount(ctx, req.Folder)
			if err != nil {
				rsp.Error = AsErrorResult(err)
				return rsp, nil
			}
			rsp.Stats[i] = &resourcepb.ResourceStatsResponse_Stats{
				Group:    parts[0],
				Resource: parts[1],
				Count:    count,
			}
		}
		return rsp, nil
	}

	stats, err := s.storage.GetResourceStats(ctx, req.Namespace, 0)
	if err != nil {
		return &resourcepb.ResourceStatsResponse{
			Error: AsErrorResult(err),
		}, nil
	}
	rsp.Stats = make([]*resourcepb.ResourceStatsResponse_Stats, len(stats))

	// When not filtered by folder or repository, we can use the results directly
	if req.Folder == "" {
		for i, stat := range stats {
			rsp.Stats[i] = &resourcepb.ResourceStatsResponse_Stats{
				Group:    stat.Group,
				Resource: stat.Resource,
				Count:    stat.Count,
			}
		}
		return rsp, nil
	}

	for i, stat := range stats {
		index, err := s.getOrCreateIndex(ctx, NamespacedResource{
			Namespace: req.Namespace,
			Group:     stat.Group,
			Resource:  stat.Resource,
		})
		if err != nil {
			rsp.Error = AsErrorResult(err)
			return rsp, nil
		}
		count, err := index.DocCount(ctx, req.Folder)
		if err != nil {
			rsp.Error = AsErrorResult(err)
			return rsp, nil
		}
		rsp.Stats[i] = &resourcepb.ResourceStatsResponse_Stats{
			Group:    stat.Group,
			Resource: stat.Resource,
			Count:    count,
		}
	}
	return rsp, nil
}

// init is called during startup.  any failure will block startup and continued execution
func (s *searchSupport) init(ctx context.Context) error {
	ctx, span := s.tracer.Start(ctx, tracingPrexfixSearch+"Init")
	defer span.End()
	start := time.Now().Unix()

	totalBatchesIndexed := 0
	group := errgroup.Group{}
	group.SetLimit(s.initWorkers)

	stats, err := s.storage.GetResourceStats(ctx, "", s.initMinSize)
	if err != nil {
		return err
	}

	for _, info := range stats {
		group.Go(func() error {
			s.log.Debug("initializing search index", "namespace", info.Namespace, "group", info.Group, "resource", info.Resource)
			totalBatchesIndexed++
			_, _, err = s.build(ctx, info.NamespacedResource, info.Count, info.ResourceVersion)
			return err
		})
	}

	err = group.Wait()
	if err != nil {
		return err
	}
	span.AddEvent("namespaces indexed", trace.WithAttributes(attribute.Int("namespaced_indexed", totalBatchesIndexed)))

	// Now start listening for new events
	watchctx := context.Background() // new context?
	events, err := s.storage.WatchWriteEvents(watchctx)
	if err != nil {
		return err
	}
	go func() {
		for {
			v := <-events

			// Skip events during batch updates
			if v.PreviousRV < 0 {
				continue
			}

			s.dispatchEvent(watchctx, v)
		}
	}()

	go s.monitorIndexEvents(ctx)

	end := time.Now().Unix()
	s.log.Info("search index initialized", "duration_secs", end-start, "total_docs", s.search.TotalDocs())
	if s.indexMetrics != nil {
		s.indexMetrics.IndexCreationTime.WithLabelValues().Observe(float64(end - start))
	}

	return nil
}

// Async event dispatching
// This is called from the watch event loop
// It will dispatch the event to the appropriate index queue processor
func (s *searchSupport) dispatchEvent(ctx context.Context, evt *WrittenEvent) {
	ctx, span := s.tracer.Start(ctx, tracingPrexfixSearch+"dispatchEvent")
	defer span.End()
	span.SetAttributes(
		attribute.String("event_type", evt.Type.String()),
		attribute.String("namespace", evt.Key.Namespace),
		attribute.String("group", evt.Key.Group),
		attribute.String("resource", evt.Key.Resource),
		attribute.String("name", evt.Key.Name),
	)

	switch evt.Type {
	case resourcepb.WatchEvent_ADDED, resourcepb.WatchEvent_MODIFIED, resourcepb.WatchEvent_DELETED: // OK
	default:
		s.log.Info("ignoring watch event", "type", evt.Type)
		span.AddEvent("ignoring watch event", trace.WithAttributes(attribute.String("type", evt.Type.String())))
	}

	nsr := NamespacedResource{
		Namespace: evt.Key.Namespace,
		Group:     evt.Key.Group,
		Resource:  evt.Key.Resource,
	}
	index, err := s.getOrCreateIndex(ctx, nsr)
	if err != nil {
		s.log.Warn("error getting index for watch event", "error", err)
		span.RecordError(err)
		return
	}
	// Get or create index queue processor for this index
	indexQueueProcessor, err := s.getOrCreateIndexQueueProcessor(index, nsr)
	if err != nil {
		s.log.Error("error getting index queue processor for watch event", "error", err)
		span.RecordError(err)
		return
	}
	indexQueueProcessor.Add(evt)
}

func (s *searchSupport) monitorIndexEvents(ctx context.Context) {
	var evt *IndexEvent
	for {
		select {
		case <-ctx.Done():
			return
		case evt = <-s.indexEventsChan:
		}
		if evt.Err != nil {
			s.log.Error("error indexing watch event", "error", evt.Err)
			continue
		}
		_, span := s.tracer.Start(ctx, tracingPrexfixSearch+"monitorIndexEvents")
		defer span.End()
		// record latency from when event was created to when it was indexed
		span.AddEvent("index latency", trace.WithAttributes(attribute.Float64("latency_seconds", evt.Latency.Seconds())))
		s.log.Debug("indexed new object", "resource", evt.WrittenEvent.Key.Resource, "latency_seconds", evt.Latency.Seconds(), "name", evt.WrittenEvent.Key.Name, "namespace", evt.WrittenEvent.Key.Namespace, "rv", evt.WrittenEvent.ResourceVersion)
		if evt.Latency.Seconds() > 1 {
			s.log.Warn("high index latency object details", "resource", evt.WrittenEvent.Key.Resource, "latency_seconds", evt.Latency.Seconds(), "name", evt.WrittenEvent.Key.Name, "namespace", evt.WrittenEvent.Key.Namespace, "rv", evt.WrittenEvent.ResourceVersion)
		}
		if s.indexMetrics != nil {
			s.indexMetrics.IndexLatency.WithLabelValues(evt.WrittenEvent.Key.Resource).Observe(evt.Latency.Seconds())
		}
		if s.clientIndexEventsChan != nil {
			s.clientIndexEventsChan <- evt
		}
	}
}

func (s *searchSupport) getOrCreateIndex(ctx context.Context, key NamespacedResource) (ResourceIndex, error) {
	if s == nil || s.search == nil {
		return nil, fmt.Errorf("search is not configured properly (missing unifiedStorageSearch feature toggle?)")
	}

	ctx, span := s.tracer.Start(ctx, tracingPrexfixSearch+"GetOrCreateIndex")
	defer span.End()

	// TODO???
	// We want to block while building the index and return the same index for the key
	// simple mutex not great... we don't want to block while anything in building, just the same key
	idx, err := s.search.GetIndex(ctx, key)
	if err != nil {
		return nil, err
	}

	if idx == nil {
		idx, _, err = s.build(ctx, key, 10, 0) // unknown size and RV
		if err != nil {
			return nil, fmt.Errorf("error building search index, %w", err)
		}
		if idx == nil {
			return nil, fmt.Errorf("nil index after build")
		}
	}
	return idx, nil
}

func (s *searchSupport) build(ctx context.Context, nsr NamespacedResource, size int64, rv int64) (ResourceIndex, int64, error) {
	ctx, span := s.tracer.Start(ctx, tracingPrexfixSearch+"Build")
	defer span.End()

	builder, err := s.builders.get(ctx, nsr)
	if err != nil {
		return nil, 0, err
	}
	fields := s.builders.GetFields(nsr)

	s.log.Debug("Building index", "resource", nsr.Resource, "size", size, "rv", rv)

	index, err := s.search.BuildIndex(ctx, nsr, size, rv, fields, func(index ResourceIndex) (int64, error) {
		rv, err = s.storage.ListIterator(ctx, &resourcepb.ListRequest{
			Limit: 1000000000000, // big number
			Options: &resourcepb.ListOptions{
				Key: &resourcepb.ResourceKey{
					Group:     nsr.Group,
					Resource:  nsr.Resource,
					Namespace: nsr.Namespace,
				},
			},
		}, func(iter ListIterator) error {
			// Collect all documents in a single bulk request
			items := make([]*BulkIndexItem, 0)

			for iter.Next() {
				if err = iter.Error(); err != nil {
					return err
				}

				// Update the key name
				key := &resourcepb.ResourceKey{
					Group:     nsr.Group,
					Resource:  nsr.Resource,
					Namespace: nsr.Namespace,
					Name:      iter.Name(),
				}

				// Convert it to an indexable document
				doc, err := builder.BuildDocument(ctx, key, iter.ResourceVersion(), iter.Value())
				if err != nil {
					s.log.Error("error building search document", "key", SearchID(key), "err", err)
					continue
				}

				// Add to bulk items
				items = append(items, &BulkIndexItem{
					Action: ActionIndex,
					Doc:    doc,
				})
			}

			// Perform single bulk index operation
			if len(items) > 0 {
				if err = index.BulkIndex(&BulkIndexRequest{
					Items: items,
				}); err != nil {
					return err
				}
			}
			return iter.Error()
		})
		return rv, err
	})

	if err != nil {
		return nil, 0, err
	}

	// Record the number of objects indexed for the kind/resource
	docCount, err := index.DocCount(ctx, "")
	if err != nil {
		s.log.Warn("error getting doc count", "error", err)
	}
	if s.indexMetrics != nil {
		s.indexMetrics.IndexedKinds.WithLabelValues(nsr.Resource).Add(float64(docCount))
	}

	// rv is the last RV we read.  when watching, we must add all events since that time
	return index, rv, err
}

type builderCache struct {
	// The default builder
	defaultBuilder DocumentBuilder

	// Possible blob support
	blob BlobSupport

	// searchable fields initialized once on startup
	fields map[schema.GroupResource]SearchableDocumentFields

	// lookup by group, then resource (namespace)
	// This is only modified at startup, so we do not need mutex for access
	lookup map[string]map[string]DocumentBuilderInfo

	// For namespaced based resources that require a cache
	ns *expirable.LRU[NamespacedResource, DocumentBuilder]
	mu sync.Mutex // only locked for a cache miss
}

func newBuilderCache(cfg []DocumentBuilderInfo, nsCacheSize int, ttl time.Duration) (*builderCache, error) {
	cache := &builderCache{
		fields: make(map[schema.GroupResource]SearchableDocumentFields),
		lookup: make(map[string]map[string]DocumentBuilderInfo),
		ns:     expirable.NewLRU[NamespacedResource, DocumentBuilder](nsCacheSize, nil, ttl),
	}
	if len(cfg) == 0 {
		return cache, fmt.Errorf("no builders configured")
	}

	for _, b := range cfg {
		// the default
		if b.GroupResource.Group == "" && b.GroupResource.Resource == "" {
			if b.Builder == nil {
				return cache, fmt.Errorf("default document builder is missing")
			}
			cache.defaultBuilder = b.Builder
			continue
		}
		g, ok := cache.lookup[b.GroupResource.Group]
		if !ok {
			g = make(map[string]DocumentBuilderInfo)
			cache.lookup[b.GroupResource.Group] = g
		}
		g[b.GroupResource.Resource] = b

		// Any custom fields
		cache.fields[b.GroupResource] = b.Fields
	}
	return cache, nil
}

func (s *builderCache) GetFields(key NamespacedResource) SearchableDocumentFields {
	return s.fields[schema.GroupResource{Group: key.Group, Resource: key.Resource}]
}

// context is typically background.  Holds an LRU cache for a
func (s *builderCache) get(ctx context.Context, key NamespacedResource) (DocumentBuilder, error) {
	g, ok := s.lookup[key.Group]
	if ok {
		r, ok := g[key.Resource]
		if ok {
			if r.Builder != nil {
				return r.Builder, nil
			}

			// The builder needs context
			builder, ok := s.ns.Get(key)
			if ok {
				return builder, nil
			}
			{
				s.mu.Lock()
				defer s.mu.Unlock()

				b, err := r.Namespaced(ctx, key.Namespace, s.blob)
				if err == nil {
					_ = s.ns.Add(key, b)
				}
				return b, err
			}
		}
	}
	return s.defaultBuilder, nil
}

// AsResourceKey converts the given namespace and type to a search key
func AsResourceKey(ns string, t string) (*resourcepb.ResourceKey, error) {
	if ns == "" {
		return nil, fmt.Errorf("missing namespace")
	}
	switch t {
	case "folders", "folder":
		return &resourcepb.ResourceKey{
			Namespace: ns,
			Group:     folders.GROUP,
			Resource:  folders.RESOURCE,
		}, nil
	case "dashboards", "dashboard":
		return &resourcepb.ResourceKey{
			Namespace: ns,
			Group:     dashboardv1.GROUP,
			Resource:  dashboardv1.DASHBOARD_RESOURCE,
		}, nil

	// NOT really supported in the dashboard search UI, but useful for manual testing
	case "playlist", "playlists":
		return &resourcepb.ResourceKey{
			Namespace: ns,
			Group:     "playlist.grafana.app",
			Resource:  "playlists",
		}, nil
	}

	return nil, fmt.Errorf("unknown resource type")
}

// getOrCreateIndexQueueProcessor returns an IndexQueueProcessor for the given index
func (s *searchSupport) getOrCreateIndexQueueProcessor(index ResourceIndex, nsr NamespacedResource) (*indexQueueProcessor, error) {
	s.indexQueueProcessorsMutex.Lock()
	defer s.indexQueueProcessorsMutex.Unlock()

	key := fmt.Sprintf("%s/%s/%s", nsr.Namespace, nsr.Group, nsr.Resource)
	if indexQueueProcessor, ok := s.indexQueueProcessors[key]; ok {
		return indexQueueProcessor, nil
	}

	builder, err := s.builders.get(context.Background(), nsr)
	if err != nil {
		s.log.Error("error getting document builder", "error", err)
		return nil, err
	}
	indexQueueProcessor := newIndexQueueProcessor(index, nsr, maxBatchSize, builder, s.indexEventsChan)
	s.indexQueueProcessors[key] = indexQueueProcessor
	return indexQueueProcessor, nil
}
