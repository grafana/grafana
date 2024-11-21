package resource

import (
	"context"
	"fmt"
	"log/slog"
	"sync"
	"time"

	"github.com/hashicorp/golang-lru/v2/expirable"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
	"golang.org/x/sync/errgroup"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

type NamespacedResource struct {
	Namespace string
	Group     string
	Resource  string
}

type SearchBackend interface {
	// TODO
}

const tracingPrexfixSearch = "unified_search."

// This supports indexing+search regardless of implementation
type searchSupport struct {
	tracer      trace.Tracer
	log         *slog.Logger
	storage     StorageBackend
	search      SearchBackend
	builders    *builderCache
	initWorkers int
}

func newSearchSupport(opts SearchOptions, storage StorageBackend, blob BlobSupport, tracer trace.Tracer) (support *searchSupport, err error) {
	// No backend search support
	if opts.Backend == nil {
		return nil, nil
	}

	if opts.WorkerThreads < 1 {
		opts.WorkerThreads = 1
	}

	support = &searchSupport{
		tracer:      tracer,
		storage:     storage,
		search:      opts.Backend,
		log:         slog.Default().With("logger", "resource-search"),
		initWorkers: opts.WorkerThreads,
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

// init is called during startup.  any failure will block startup and continued execution
func (s *searchSupport) init(ctx context.Context) error {
	_, span := s.tracer.Start(ctx, tracingPrexfixSearch+"Init")
	defer span.End()

	// TODO, replace namespaces with a query that gets top values
	namespaces, err := s.storage.Namespaces(ctx)
	if err != nil {
		return err
	}

	// Hardcoded for now... should come from the query
	kinds := []schema.GroupResource{
		{Group: "dashboard.grafana.app", Resource: "dashboards"},
		{Group: "playlist.grafana.app", Resource: "playlists"},
	}

	totalBatchesIndexed := 0
	group := errgroup.Group{}
	group.SetLimit(s.initWorkers)

	// Prepare all the (large) indexes
	// TODO, threading and query real information:
	// SELECT namespace,"group",resource,COUNT(*),resource_version FROM resource
	//   GROUP BY "group", "resource", "namespace"
	//   ORDER BY resource_version desc;
	for _, ns := range namespaces {
		for _, gr := range kinds {
			group.Go(func() error {
				s.log.Debug("initializing search index", "namespace", ns, "gr", gr)
				totalBatchesIndexed++
				_, _, err = s.build(ctx, NamespacedResource{
					Group:     gr.Group,
					Resource:  gr.Resource,
					Namespace: ns,
				}, 10, 0) // TODO, approximate size
				return err
			})
		}
	}

	err = group.Wait()
	if err != nil {
		return err
	}
	span.AddEvent("namespaces indexed", trace.WithAttributes(attribute.Int("namespaced_indexed", totalBatchesIndexed)))

	s.log.Debug("TODO, listen to all events")

	return nil
}

func (s *searchSupport) build(ctx context.Context, nsr NamespacedResource, size int64, rv int64) (any, int64, error) {
	_, span := s.tracer.Start(ctx, tracingPrexfixSearch+"Build")
	defer span.End()

	builder, err := s.builders.get(ctx, nsr)
	if err != nil {
		return nil, 0, err
	}

	s.log.Debug(fmt.Sprintf("TODO, build %+v (size:%d, rv:%d) // builder:%+v\n", nsr, size, rv, builder))

	return nil, 0, nil
}

type builderCache struct {
	// The default builder
	defaultBuilder DocumentBuilder

	// Possible blob support
	blob BlobSupport

	// lookup by group, then resource (namespace)
	// This is only modified at startup, so we do not need mutex for access
	lookup map[string]map[string]DocumentBuilderInfo

	// For namespaced based resources that require a cache
	ns *expirable.LRU[NamespacedResource, DocumentBuilder]
	mu sync.Mutex // only locked for a cache miss
}

func newBuilderCache(cfg []DocumentBuilderInfo, nsCacheSize int, ttl time.Duration) (*builderCache, error) {
	cache := &builderCache{
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
	}
	return cache, nil
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
