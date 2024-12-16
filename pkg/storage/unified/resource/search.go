package resource

import (
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

	"github.com/grafana/authlib/authz"
)

type NamespacedResource struct {
	Namespace string
	Group     string
	Resource  string
}

// All fields are set
func (s *NamespacedResource) Valid() bool {
	return s.Namespace != "" && s.Group != "" && s.Resource != ""
}

type ResourceIndex interface {
	// Add a document to the index.  Note it may not be searchable until after flush is called
	Write(doc *IndexableDocument) error

	// Mark a resource as deleted.  Note it may not be searchable until after flush is called
	Delete(key *ResourceKey) error

	// Make sure any changes to the index are flushed and available in the next search/origin calls
	Flush() error

	// Search within a namespaced resource
	// When working with federated queries, the additional indexes will be passed in explicitly
	Search(ctx context.Context, access authz.AccessClient, req *ResourceSearchRequest, federate []ResourceIndex) (*ResourceSearchResponse, error)

	// Execute an origin query -- access control is not not checked for each item
	// NOTE: this will likely be used for provisioning, or it will be removed
	Origin(ctx context.Context, req *OriginRequest) (*OriginResponse, error)

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
	tracer      trace.Tracer
	log         *slog.Logger
	storage     StorageBackend
	search      SearchBackend
	access      authz.AccessClient
	builders    *builderCache
	initWorkers int
	initMinSize int
}

var (
	_ ResourceIndexServer = (*searchSupport)(nil)
)

func newSearchSupport(opts SearchOptions, storage StorageBackend, access authz.AccessClient, blob BlobSupport, tracer trace.Tracer) (support *searchSupport, err error) {
	// No backend search support
	if opts.Backend == nil {
		return nil, nil
	}

	if opts.WorkerThreads < 1 {
		opts.WorkerThreads = 1
	}

	support = &searchSupport{
		access:      access,
		tracer:      tracer,
		storage:     storage,
		search:      opts.Backend,
		log:         slog.Default().With("logger", "resource-search"),
		initWorkers: opts.WorkerThreads,
		initMinSize: opts.InitMinCount,
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

// History implements ResourceIndexServer.
func (s *searchSupport) History(context.Context, *HistoryRequest) (*HistoryResponse, error) {
	return nil, fmt.Errorf("not implemented yet... likely should not be the serarch server")
}

// Origin implements ResourceIndexServer.
func (s *searchSupport) Origin(context.Context, *OriginRequest) (*OriginResponse, error) {
	return nil, fmt.Errorf("TBD.. rename to repository")
}

// Search implements ResourceIndexServer.
func (s *searchSupport) Search(ctx context.Context, req *ResourceSearchRequest) (*ResourceSearchResponse, error) {
	nsr := NamespacedResource{
		Group:     req.Options.Key.Group,
		Namespace: req.Options.Key.Namespace,
		Resource:  req.Options.Key.Resource,
	}
	idx, err := s.getOrCreateIndex(ctx, nsr)
	if err != nil {
		return &ResourceSearchResponse{
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
			return &ResourceSearchResponse{
				Error: AsErrorResult(err),
			}, nil
		}
	}

	return idx.Search(ctx, s.access, req, federate)
}

// GetStats implements ResourceServer.
func (s *searchSupport) GetStats(ctx context.Context, req *ResourceStatsRequest) (*ResourceStatsResponse, error) {
	if req.Namespace == "" {
		return &ResourceStatsResponse{
			Error: NewBadRequestError("missing namespace"),
		}, nil
	}
	rsp := &ResourceStatsResponse{}

	// Explicit list of kinds
	if len(req.Kinds) > 0 {
		rsp.Stats = make([]*ResourceStatsResponse_Stats, len(req.Kinds))
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
			rsp.Stats[i] = &ResourceStatsResponse_Stats{
				Group:    parts[0],
				Resource: parts[1],
				Count:    count,
			}
		}
		return rsp, nil
	}

	stats, err := s.storage.GetResourceStats(ctx, req.Namespace, 0)
	if err != nil {
		return &ResourceStatsResponse{
			Error: AsErrorResult(err),
		}, nil
	}
	rsp.Stats = make([]*ResourceStatsResponse_Stats, len(stats))

	// When not filtered by folder or repository, we can use the results directly
	if req.Folder == "" {
		for i, stat := range stats {
			rsp.Stats[i] = &ResourceStatsResponse_Stats{
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
		rsp.Stats[i] = &ResourceStatsResponse_Stats{
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

			s.handleEvent(watchctx, v)
		}
	}()

	end := time.Now().Unix()
	s.log.Info("search index initialized", "duration_secs", end-start, "total_docs", s.search.TotalDocs())
	if IndexMetrics != nil {
		IndexMetrics.IndexCreationTime.WithLabelValues().Observe(float64(end - start))
	}

	return nil
}

// Async event
func (s *searchSupport) handleEvent(ctx context.Context, evt *WrittenEvent) {
	if !slices.Contains([]WatchEvent_Type{WatchEvent_ADDED, WatchEvent_MODIFIED, WatchEvent_DELETED}, evt.Type) {
		s.log.Info("ignoring watch event", "type", evt.Type)
		return
	}

	nsr := NamespacedResource{
		Namespace: evt.Key.Namespace,
		Group:     evt.Key.Group,
		Resource:  evt.Key.Resource,
	}

	index, err := s.getOrCreateIndex(ctx, nsr)
	if err != nil {
		s.log.Warn("error getting index for watch event", "error", err)
		return
	}

	builder, err := s.builders.get(ctx, nsr)
	if err != nil {
		s.log.Warn("error getting builder for watch event", "error", err)
		return
	}

	doc, err := builder.BuildDocument(ctx, evt.Key, evt.ResourceVersion, evt.Value)
	if err != nil {
		s.log.Warn("error building document watch event", "error", err)
		return
	}

	switch evt.Type {
	case WatchEvent_ADDED, WatchEvent_MODIFIED:
		err = index.Write(doc)
		if err != nil {
			s.log.Warn("error writing document watch event", "error", err)
			return
		}
		if evt.Type == WatchEvent_ADDED {
			IndexMetrics.IndexedKinds.WithLabelValues(evt.Key.Resource).Inc()
		}
	case WatchEvent_DELETED:
		err = index.Delete(evt.Key)
		if err != nil {
			s.log.Warn("error deleting document watch event", "error", err)
			return
		}
		IndexMetrics.IndexedKinds.WithLabelValues(evt.Key.Resource).Dec()
	default:
		// do nothing
		s.log.Warn("unknown watch event", "type", evt.Type)
	}

	// record latency from when event was created to when it was indexed
	latencySeconds := float64(time.Now().UnixMicro()-evt.ResourceVersion) / 1e6
	if latencySeconds > 5 {
		s.log.Warn("high index latency", "latency", latencySeconds)
	}
	if IndexMetrics != nil {
		IndexMetrics.IndexLatency.WithLabelValues(evt.Key.Resource).Observe(latencySeconds)
	}
}

func (s *searchSupport) getOrCreateIndex(ctx context.Context, key NamespacedResource) (ResourceIndex, error) {
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
			return nil, err
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

	s.log.Debug(fmt.Sprintf("TODO, build %+v (size:%d, rv:%d) // builder:%+v\n", nsr, size, rv, builder))

	key := &ResourceKey{
		Group:     nsr.Group,
		Resource:  nsr.Resource,
		Namespace: nsr.Namespace,
	}
	index, err := s.search.BuildIndex(ctx, nsr, size, rv, fields, func(index ResourceIndex) (int64, error) {
		rv, err = s.storage.ListIterator(ctx, &ListRequest{
			Limit: 1000000000000, // big number
			Options: &ListOptions{
				Key: key,
			},
		}, func(iter ListIterator) error {
			for iter.Next() {
				if err = iter.Error(); err != nil {
					return err
				}

				// Update the key name
				// Or should we read it from the body?
				key.Name = iter.Name()

				// Convert it to an indexable document
				doc, err := builder.BuildDocument(ctx, key, iter.ResourceVersion(), iter.Value())
				if err != nil {
					return err
				}

				// And finally write it to the index
				if err = index.Write(doc); err != nil {
					return err
				}
			}
			return err
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
	if IndexMetrics != nil {
		IndexMetrics.IndexedKinds.WithLabelValues(key.Resource).Add(float64(docCount))
	}

	if err == nil {
		err = index.Flush()
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
