package resource

import (
	"context"
	"time"

	"google.golang.org/grpc"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

const (
	// backgroundRequestTimeout is the timeout for background shadow traffic requests
	backgroundRequestTimeout = 500 * time.Millisecond
)

type DualWriter interface {
	IsEnabled(schema.GroupResource) bool
	ReadFromUnified(context.Context, schema.GroupResource) (bool, error)
}

func NewSearchClient(dual DualWriter, gr schema.GroupResource, unifiedClient resourcepb.ResourceIndexClient,
	legacyClient resourcepb.ResourceIndexClient, features featuremgmt.FeatureToggles) resourcepb.ResourceIndexClient {
	return &searchWrapper{
		dual:          dual,
		groupResource: gr,
		unifiedClient: unifiedClient,
		legacyClient:  legacyClient,
		features:      features,
		logger:        log.New("unified-storage.search-client"),
	}
}

type searchWrapper struct {
	dual          DualWriter
	groupResource schema.GroupResource

	unifiedClient resourcepb.ResourceIndexClient
	legacyClient  resourcepb.ResourceIndexClient
	features      featuremgmt.FeatureToggles
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

	// If dual reader feature flag is enabled, and legacy is the main storage,
	// make a background call to unified
	if s.features != nil && s.features.IsEnabledGlobally(featuremgmt.FlagUnifiedStorageSearchDualReaderEnabled) && !unified {
		// Create background context with timeout but ignore parent cancelation
		ctxBg := context.WithoutCancel(ctx)
		ctxBgWithTimeout, cancel := context.WithTimeout(ctxBg, backgroundRequestTimeout)

		// Make background call without blocking the main request
		go func() {
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

	// If dual reader feature flag is enabled, and legacy is the main storage,
	// make a background call to unified
	if s.features != nil && s.features.IsEnabledGlobally(featuremgmt.FlagUnifiedStorageSearchDualReaderEnabled) && !unified {
		// Create background context with timeout but ignore parent cancelation
		ctxBg := context.WithoutCancel(ctx)
		ctxBgWithTimeout, cancel := context.WithTimeout(ctxBg, backgroundRequestTimeout)

		// Make background call without blocking the main request
		go func() {
			defer cancel() // Ensure we clean up the context
			_, bgErr := s.unifiedClient.Search(ctxBgWithTimeout, in, opts...)
			if bgErr != nil {
				s.logger.Error("Background Search call to unified failed", "error", bgErr, "timeout", backgroundRequestTimeout)
			} else {
				s.logger.Debug("Background Search call to unified succeeded")
			}
		}()
	}

	return client.Search(ctx, in, opts...)
}
