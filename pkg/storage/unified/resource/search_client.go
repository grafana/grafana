package resource

import (
	"context"
	"time"

	"google.golang.org/grpc"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/storage/legacysql/dualwrite"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

const (
	// backgroundRequestTimeout is the timeout for background shadow traffic requests
	backgroundRequestTimeout = 500 * time.Millisecond
)

type DualWriter interface {
	ReadFromUnified(context.Context, schema.GroupResource) (bool, error)
	Status(ctx context.Context, gr schema.GroupResource) (dualwrite.StorageStatus, error)
}

func NewSearchClient(dual DualWriter, gr schema.GroupResource, unifiedClient resourcepb.ResourceIndexClient,
	legacyClient resourcepb.ResourceIndexClient) resourcepb.ResourceIndexClient {
	return &searchWrapper{
		dual:          dual,
		groupResource: gr,
		unifiedClient: unifiedClient,
		legacyClient:  legacyClient,
		logger:        log.New("unified-storage.search-client"),
	}
}

type searchWrapper struct {
	dual          DualWriter
	groupResource schema.GroupResource

	unifiedClient resourcepb.ResourceIndexClient
	legacyClient  resourcepb.ResourceIndexClient
	logger        log.Logger
}

func (s *searchWrapper) GetStats(ctx context.Context, in *resourcepb.ResourceStatsRequest,
	opts ...grpc.CallOption) (*resourcepb.ResourceStatsResponse, error) {
	client := s.legacyClient
	unified, err := s.dual.ReadFromUnified(ctx, s.groupResource)
	if err != nil {
		return nil, err
	}
	if unified {
		client = s.unifiedClient
	}

	status, err := s.dual.Status(ctx, s.groupResource)
	if err != nil {
		return nil, err
	}

	// While legacy still serves reads and unified is being written to, call
	// unified in the background as well, so it is exercised before it takes over
	// reads. The result is thrown away.
	if !unified && status.WriteUnified {
		// Create background context with timeout but ignore parent cancelation
		ctxBg := context.WithoutCancel(ctx)

		// Make background call without blocking the main request
		go func() {
			ctxBgWithTimeout, cancel := context.WithTimeout(ctxBg, backgroundRequestTimeout)
			defer cancel() // Ensure we clean up the context
			_, bgErr := s.unifiedClient.GetStats(ctxBgWithTimeout, in, opts...)
			if bgErr != nil {
				s.logger.Error("Background GetStats call to unified failed", "error", bgErr, "timeout", backgroundRequestTimeout)
			} else {
				s.logger.Debug("Background GetStats call to unified succeeded")
			}
		}()
	}

	return client.GetStats(ctx, in, opts...)
}

// VectorSearch is unified-storage-only — there's no legacy bleve fallback for
// vector search, so always route to the unified client regardless of the
// dual-write toggle.
func (s *searchWrapper) VectorSearch(ctx context.Context, in *resourcepb.VectorSearchRequest,
	opts ...grpc.CallOption) (*resourcepb.VectorSearchResponse, error) {
	return s.unifiedClient.VectorSearch(ctx, in, opts...)
}

// HybridSearch is unified-storage-only — like VectorSearch, there is no
// legacy fallback path.
func (s *searchWrapper) HybridSearch(ctx context.Context, in *resourcepb.HybridSearchRequest,
	opts ...grpc.CallOption) (*resourcepb.HybridSearchResponse, error) {
	return s.unifiedClient.HybridSearch(ctx, in, opts...)
}

func (s *searchWrapper) Search(ctx context.Context, in *resourcepb.ResourceSearchRequest,
	opts ...grpc.CallOption) (*resourcepb.ResourceSearchResponse, error) {
	client := s.legacyClient
	unified, err := s.dual.ReadFromUnified(ctx, s.groupResource)
	if err != nil {
		return nil, err
	}
	if unified {
		client = s.unifiedClient
	}

	return client.Search(ctx, in, opts...)
}

func (s *searchWrapper) RebuildIndexes(ctx context.Context, in *resourcepb.RebuildIndexesRequest,
	opts ...grpc.CallOption) (*resourcepb.RebuildIndexesResponse, error) {
	return s.unifiedClient.RebuildIndexes(ctx, in, opts...)
}
