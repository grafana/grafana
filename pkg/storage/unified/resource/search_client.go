package resource

import (
	"context"
	"fmt"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
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

var (
	// searchResultsMatchHistogram tracks the percentage match between legacy and unified search results
	searchResultsMatchHistogram = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Namespace: "grafana",
			Subsystem: "unified_storage",
			Name:      "search_results_match_percentage",
			Help:      "Histogram of percentage match between legacy and unified search results",
			Buckets:   []float64{0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100},
		},
		[]string{"resource_type"},
	)
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

// extractUIDs extracts unique UIDs from search response results
func extractUIDs(response *resourcepb.ResourceSearchResponse) map[string]bool {
	uids := make(map[string]bool)
	if response == nil || response.Results == nil || response.Results.Rows == nil {
		return uids
	}

	for _, row := range response.Results.Rows {
		if row.Key != nil && row.Key.Name != "" {
			uids[row.Key.Name] = true
		}
	}
	return uids
}

// calculateMatchPercentage calculates the percentage of matching UIDs between two result sets
func calculateMatchPercentage(legacyUIDs, unifiedUIDs map[string]bool) float64 {
	if len(legacyUIDs) == 0 && len(unifiedUIDs) == 0 {
		return 100.0 // Both empty, consider as 100% match
	}
	if len(legacyUIDs) == 0 || len(unifiedUIDs) == 0 {
		return 0.0 // One empty, other not
	}

	// Count matches
	matches := 0
	for uid := range legacyUIDs {
		if unifiedUIDs[uid] {
			matches++
		}
	}

	// Calculate percentage based on the union of both sets
	totalUnique := len(legacyUIDs)
	for uid := range unifiedUIDs {
		if !legacyUIDs[uid] {
			totalUnique++
		}
	}

	if totalUnique == 0 {
		return 100.0
	}

	return float64(matches) / float64(totalUnique) * 100.0
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
	// make a background call to unified and compare results
	if s.features != nil && s.features.IsEnabledGlobally(featuremgmt.FlagUnifiedStorageSearchDualReaderEnabled) && !unified {
		// Get the legacy result first
		legacyResponse, legacyErr := s.legacyClient.Search(ctx, in, opts...)
		if legacyErr != nil {
			return nil, legacyErr
		}

		// Create background context with timeout but ignore parent cancelation
		ctxBg := context.WithoutCancel(ctx)
		ctxBgWithTimeout, cancel := context.WithTimeout(ctxBg, backgroundRequestTimeout)

		// Make background call and compare results
		go func() {
			defer cancel() // Ensure we clean up the context
			unifiedResponse, bgErr := s.unifiedClient.Search(ctxBgWithTimeout, in, opts...)
			if bgErr != nil {
				s.logger.Error("Background Search call to unified failed", "error", bgErr, "timeout", backgroundRequestTimeout)
			} else {
				s.logger.Debug("Background Search call to unified succeeded")

				// Compare results when both are successful
				var requestKey *resourcepb.ResourceKey
				if in.Options != nil {
					requestKey = in.Options.Key
				}
				s.compareSearchResults(legacyResponse, unifiedResponse, requestKey)
			}
		}()

		return legacyResponse, nil
	}

	return client.Search(ctx, in, opts...)
}

// compareSearchResults compares legacy and unified search results and logs/metrics the outcome
func (s *searchWrapper) compareSearchResults(legacyResponse, unifiedResponse *resourcepb.ResourceSearchResponse, requestKey *resourcepb.ResourceKey) {
	if legacyResponse == nil || unifiedResponse == nil {
		return
	}

	legacyUIDs := extractUIDs(legacyResponse)
	unifiedUIDs := extractUIDs(unifiedResponse)

	matchPercentage := calculateMatchPercentage(legacyUIDs, unifiedUIDs)

	// Determine resource type for labeling - handle nil safely
	resourceType := "unknown"
	if requestKey != nil && requestKey.Resource != "" {
		resourceType = requestKey.Resource
	}

	s.logger.Debug("Search results comparison completed",
		"resource_type", resourceType,
		"legacy_count", len(legacyUIDs),
		"unified_count", len(unifiedUIDs),
		"match_percentage", fmt.Sprintf("%.1f%%", matchPercentage),
		"legacy_total_hits", legacyResponse.TotalHits,
		"unified_total_hits", unifiedResponse.TotalHits,
	)

	searchResultsMatchHistogram.WithLabelValues(resourceType).Observe(matchPercentage)
}
