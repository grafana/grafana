package resource

import (
	"context"

	"google.golang.org/grpc"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

type DualWriter interface {
	IsEnabled(schema.GroupResource) bool
	ReadFromUnified(context.Context, schema.GroupResource) (bool, error)
}

func NewSearchClient(dual DualWriter, gr schema.GroupResource, unifiedClient resourcepb.ResourceIndexClient,
	legacyClient resourcepb.ResourceIndexClient, features featuremgmt.FeatureToggles) resourcepb.ResourceIndexClient {
	if dual.IsEnabled(gr) {
		return &searchWrapper{
			dual:          dual,
			groupResource: gr,
			unifiedClient: unifiedClient,
			legacyClient:  legacyClient,
			features:      features,
			logger:        log.New("unified-storage.search-client"),
		}
	}
	//nolint:errcheck
	if ok, _ := dual.ReadFromUnified(context.Background(), gr); ok {
		return unifiedClient
	}
	return legacyClient
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

	// If dual reader feature flag is enabled, make a background call to the other client
	if s.features != nil && s.features.IsEnabledGlobally(featuremgmt.FlagUnifiedStorageSearchDualReaderEnabled) {
		var backgroundClient resourcepb.ResourceIndexClient
		if unified {
			backgroundClient = s.legacyClient
		} else {
			backgroundClient = s.unifiedClient
		}

		// Make background call without blocking the main request
		go func() {
			_, bgErr := backgroundClient.GetStats(context.Background(), in, opts...)
			if bgErr != nil {
				s.logger.Error("Background GetStats call failed", "unified", !unified, "error", bgErr)
			} else {
				s.logger.Debug("Background GetStats call succeeded", "unified", !unified)
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

	// If dual reader feature flag is enabled, make a background call to the other client
	if s.features != nil && s.features.IsEnabledGlobally(featuremgmt.FlagUnifiedStorageSearchDualReaderEnabled) {
		var backgroundClient resourcepb.ResourceIndexClient
		if unified {
			backgroundClient = s.legacyClient
		} else {
			backgroundClient = s.unifiedClient
		}

		// Make background call without blocking the main request
		go func() {
			_, bgErr := backgroundClient.Search(context.Background(), in, opts...)
			if bgErr != nil {
				s.logger.Error("Background Search call failed", "unified", !unified, "error", bgErr)
			} else {
				s.logger.Debug("Background Search call succeeded", "unified", !unified)
			}
		}()
	}

	return client.Search(ctx, in, opts...)
}
