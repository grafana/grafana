package resource

import (
	"context"
	"fmt"
	"time"

	"go.opentelemetry.io/otel/attribute"
	"golang.org/x/sync/errgroup"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/grafana/grafana/pkg/infra/metrics/metricutil"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

const maxHybridSearchResources = 10

func (s *searchServer) HybridSearchResources(ctx context.Context, req *resourcepb.HybridSearchResourcesRequest) (resp *resourcepb.HybridSearchResponse, retErr error) {
	ctx, span := tracer.Start(ctx, "resource.searchServer.HybridSearchResources")
	defer span.End()
	start := time.Now()
	defer func() {
		metricutil.ObserveWithExemplar(ctx,
			s.vectorMetrics.HybridSearchDuration.WithLabelValues(GlobalSearchGroup, GlobalSearchResource, status.Code(retErr).String()),
			time.Since(start).Seconds(),
		)
	}()
	if s.search == nil {
		return nil, status.Error(codes.Unimplemented, "search index not configured")
	}
	requests, err := hybridResourceRequests(req)
	if err != nil {
		return nil, err
	}
	limit := min(int(req.Limit), maxVectorSearchLimit)
	if limit <= 0 {
		limit = defaultVectorSearchLimit
	}
	span.SetAttributes(attribute.String("namespace", req.Namespace), attribute.Int("resource_count", len(requests)))

	candidates := make([]*hybridCandidates, len(requests))
	g, gctx := errgroup.WithContext(ctx)
	g.SetLimit(4)
	for i, request := range requests {
		g.Go(func() error {
			var err error
			candidates[i], err = s.hybridSearchCandidates(gctx, request, hybridFetchDepth(limit))
			return err
		})
	}
	if err := g.Wait(); err != nil {
		return nil, s.grpcStatusError(ctx, "cross-resource hybrid search", err)
	}

	results := mergeHybridCandidates(candidates)
	if !req.SkipRerank {
		query := req.Query
		if req.SemanticQuery != "" {
			query = req.SemanticQuery
		}
		results, err = s.rerankHybridResults(ctx, query, results, req.MinRelevance)
		if err != nil {
			return nil, err
		}
	}
	if len(results) > limit {
		results = results[:limit]
	}

	metadata, metadataCtx := errgroup.WithContext(ctx)
	metadata.Go(func() error {
		s.resolveFolderTitles(metadataCtx, req.Namespace, results)
		return nil
	})
	for _, candidate := range candidates {
		if candidate.collection.IsExternal {
			continue
		}
		metadata.Go(func() error {
			var matching []*resourcepb.HybridSearchResult
			for _, result := range results {
				if result.Key.Group == candidate.key.Group && result.Key.Resource == candidate.key.Resource {
					matching = append(matching, result)
				}
			}
			s.resolveManagedBy(metadataCtx, candidate.key, candidate.lexUIDs, matching)
			return nil
		})
	}
	_ = metadata.Wait()
	return &resourcepb.HybridSearchResponse{Results: results}, nil
}

func hybridResourceRequests(req *resourcepb.HybridSearchResourcesRequest) ([]*resourcepb.HybridSearchRequest, error) {
	invalid := func(message string) error { return status.Error(codes.InvalidArgument, message) }
	if req == nil || req.Namespace == "" {
		return nil, invalid("namespace is required")
	}
	if len(req.Resources) == 0 || len(req.Resources) > maxHybridSearchResources {
		return nil, invalid(fmt.Sprintf("resources must contain between 1 and %d resource types", maxHybridSearchResources))
	}
	for _, filter := range req.Filters {
		if filter == nil || (filter.Key != "uid" && filter.Key != "folder") {
			return nil, invalid("cross-resource filters support only uid and folder")
		}
	}
	requests := make([]*resourcepb.HybridSearchRequest, 0, len(req.Resources))
	seen := make(map[GroupResource]bool, len(req.Resources))
	for _, target := range req.Resources {
		if target == nil || target.Group == "" || target.Resource == "" {
			return nil, invalid("each resource must specify group and resource")
		}
		key := GroupResource{Group: target.Group, Resource: target.Resource}
		if seen[key] {
			return nil, invalid(fmt.Sprintf("duplicate resource %s/%s", target.Group, target.Resource))
		}
		seen[key] = true
		request := &resourcepb.HybridSearchRequest{
			Key:   &resourcepb.ResourceKey{Namespace: req.Namespace, Group: target.Group, Resource: target.Resource},
			Query: req.Query, SemanticQuery: req.SemanticQuery, Limit: req.Limit,
			Filters: req.Filters, MinRelevance: req.MinRelevance, SkipRerank: req.SkipRerank,
		}
		if err := validateHybridSearchRequest(request); err != nil {
			return nil, err
		}
		requests = append(requests, request)
	}
	return requests, nil
}

// Independent per-resource scores aren't comparable. Interleaving preserves each
// resource's ordering and keeps one resource from filling the rerank budget.
func mergeHybridCandidates(candidates []*hybridCandidates) []*resourcepb.HybridSearchResult {
	results := make([]*resourcepb.HybridSearchResult, 0, maxRerankCandidates)
	for rank := 0; len(results) < maxRerankCandidates; rank++ {
		before := len(results)
		for _, candidate := range candidates {
			if rank < len(candidate.results) {
				result := candidate.results[rank]
				result.Score = 1 / float64(rrfK+len(results)+1)
				results = append(results, result)
				if len(results) == maxRerankCandidates {
					break
				}
			}
		}
		if len(results) == before {
			break
		}
	}
	return results
}
