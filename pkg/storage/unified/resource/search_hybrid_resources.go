package resource

import (
	"context"
	"fmt"

	"golang.org/x/sync/errgroup"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// hybridSearchKeys validates either key or namespace/resources and returns one
// key per resource so both request formats use the same search flow.
func hybridSearchKeys(req *resourcepb.HybridSearchRequest) ([]*resourcepb.ResourceKey, error) {
	invalid := func(message string) error { return status.Error(codes.InvalidArgument, message) }
	if req == nil {
		return nil, invalid("missing namespace, group or resource")
	}
	//nolint:staticcheck // Continue accepting requests from older clients.
	if req.Key != nil {
		if req.Namespace != "" || len(req.Resources) > 0 {
			return nil, invalid("use either key or namespace and resources")
		}
		if req.Key.Namespace == "" || req.Key.Group == "" || req.Key.Resource == "" {
			return nil, invalid("missing namespace, group or resource")
		}
		return []*resourcepb.ResourceKey{req.Key}, nil
	}
	if req.Namespace == "" || len(req.Resources) == 0 {
		return nil, invalid("namespace and at least one resource are required")
	}
	keys := make([]*resourcepb.ResourceKey, 0, len(req.Resources))
	seen := make(map[GroupResource]bool, len(req.Resources))
	for _, target := range req.Resources {
		if target == nil || target.Group == "" || target.Resource == "" {
			return nil, invalid("each resource must specify group and resource")
		}
		gr := GroupResource{Group: target.Group, Resource: target.Resource}
		if seen[gr] {
			return nil, invalid(fmt.Sprintf("duplicate resource %s/%s", target.Group, target.Resource))
		}
		seen[gr] = true
		keys = append(keys, &resourcepb.ResourceKey{Namespace: req.Namespace, Group: target.Group, Resource: target.Resource})
	}
	return keys, nil
}

// Independent per-resource scores aren't comparable. Interleaving preserves each
// resource's ordering and keeps one resource from filling the rerank budget.
func interleaveHybridCandidates(candidates []hybridCandidates) []*resourcepb.HybridSearchResult {
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

// enrichHybridResults looks up folder titles and semantic metadata only for retained results.
// External resources have no Bleve index, so they skip metadata lookups.
func (s *searchServer) enrichHybridResults(ctx context.Context, namespace string, candidates []hybridCandidates, results []*resourcepb.HybridSearchResult) {
	byResource := make(map[GroupResource][]*resourcepb.HybridSearchResult)
	for _, result := range results {
		gr := GroupResource{Group: result.Key.Group, Resource: result.Key.Resource}
		byResource[gr] = append(byResource[gr], result)
	}
	g, gctx := errgroup.WithContext(ctx)
	g.SetLimit(4)
	folderResults := make([]*resourcepb.HybridSearchResult, 0, len(results))
	for _, candidate := range candidates {
		if !candidate.shared {
			folderResults = append(folderResults, byResource[GroupResource{Group: candidate.key.Group, Resource: candidate.key.Resource}]...)
		}
	}
	g.Go(func() error {
		s.resolveFolderTitles(gctx, namespace, folderResults)
		return nil
	})
	for _, candidate := range candidates {
		matching := byResource[GroupResource{Group: candidate.key.Group, Resource: candidate.key.Resource}]
		if candidate.external || len(matching) == 0 {
			continue
		}
		g.Go(func() error {
			s.resolveSemanticMetadata(gctx, candidate.key, candidate.lexUIDs, matching)
			return nil
		})
	}
	_ = g.Wait() // Independent, best-effort lookups over disjoint fields.
}
