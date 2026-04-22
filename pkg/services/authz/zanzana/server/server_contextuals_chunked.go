package server

import (
	"context"
	"sort"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"
	"google.golang.org/protobuf/proto"
	"google.golang.org/protobuf/types/known/structpb"

	"github.com/grafana/grafana/pkg/services/authz/zanzana"
	"github.com/grafana/grafana/pkg/setting"
)

// mergeContextualTupleKeys appends teamSlice to the optional base (render-service tuples, etc.).
func mergeContextualTupleKeys(base *openfgav1.ContextualTupleKeys, teamSlice []*openfgav1.TupleKey) *openfgav1.ContextualTupleKeys {
	if base == nil && len(teamSlice) == 0 {
		return nil
	}
	var keys []*openfgav1.TupleKey
	if base != nil {
		keys = append(keys, base.GetTupleKeys()...)
	}
	keys = append(keys, teamSlice...)
	if len(keys) == 0 {
		return nil
	}
	return &openfgav1.ContextualTupleKeys{TupleKeys: keys}
}

// contextualTeamChunkSize returns the effective chunk size (at least 1; default [setting.DefaultContextualTeamsChunkSize] from config when unset/0).
func (s *Server) contextualTeamChunkSize() int {
	n := s.cfg.ContextualTeamsChunkSize
	if n <= 0 {
		return setting.DefaultContextualTeamsChunkSize
	}
	return n
}

// buildContextualTupleChunks returns one or more [openfgav1.ContextualTupleKeys] when team tuples
// must be split, so each OpenFGA call stays under the per-request contextual tuple cap.
// When there are no team tuples, the result is either nil (no base) or a single element with
// only base (e.g. render) tuples.
func (s *Server) buildContextualTupleChunks(base *openfgav1.ContextualTupleKeys, teamTuples []*openfgav1.TupleKey) []*openfgav1.ContextualTupleKeys {
	if len(teamTuples) == 0 {
		if base == nil || len(base.GetTupleKeys()) == 0 {
			return nil
		}
		return []*openfgav1.ContextualTupleKeys{base}
	}
	size := s.contextualTeamChunkSize()
	if size < 1 {
		size = setting.DefaultContextualTeamsChunkSize
	}
	var out []*openfgav1.ContextualTupleKeys
	for i := 0; i < len(teamTuples); i += size {
		end := i + size
		if end > len(teamTuples) {
			end = len(teamTuples)
		}
		chunk := mergeContextualTupleKeys(base, teamTuples[i:end])
		if chunk != nil {
			out = append(out, chunk)
		}
	}
	if len(out) == 0 {
		return nil
	}
	return out
}

// openfgaCheckWithContextualTeamChunks runs [Server.openfgaCheck] for each chunk; returns allow on first match.
func (s *Server) openfgaCheckWithContextualTeamChunks(
	ctx context.Context,
	store *zanzana.StoreInfo,
	subject, relation, object string,
	base *openfgav1.ContextualTupleKeys,
	teamTuples []*openfgav1.TupleKey,
	resourceCtx *structpb.Struct,
) (*openfgav1.CheckResponse, error) {
	chunks := s.buildContextualTupleChunks(base, teamTuples)
	if len(chunks) == 0 {
		return s.openfgaCheck(ctx, store, subject, relation, object, nil, resourceCtx)
	}
	if len(chunks) == 1 {
		return s.openfgaCheck(ctx, store, subject, relation, object, chunks[0], resourceCtx)
	}
	var last *openfgav1.CheckResponse
	for _, ch := range chunks {
		res, err := s.openfgaCheck(ctx, store, subject, relation, object, ch, resourceCtx)
		if err != nil {
			return nil, err
		}
		if res.GetAllowed() {
			return res, nil
		}
		last = res
	}
	return last, nil
}

// listObjectsWithContextualTeamChunks calls [Server.listObjects] for each chunk and unions object ids (deduplicated, stable order).
func (s *Server) listObjectsWithContextualTeamChunks(
	ctx context.Context,
	req *openfgav1.ListObjectsRequest,
	base *openfgav1.ContextualTupleKeys,
	teamTuples []*openfgav1.TupleKey,
) (*openfgav1.ListObjectsResponse, error) {
	chunks := s.buildContextualTupleChunks(base, teamTuples)
	if len(chunks) == 0 {
		return s.listObjects(ctx, cloneListObjectsRequestWithContextualTuples(req, nil))
	}
	if len(chunks) == 1 {
		return s.listObjects(ctx, cloneListObjectsRequestWithContextualTuples(req, chunks[0]))
	}
	seen := make(map[string]struct{})
	var merged []string
	for _, ch := range chunks {
		lo, err := s.listObjects(ctx, cloneListObjectsRequestWithContextualTuples(req, ch))
		if err != nil {
			return nil, err
		}
		for _, o := range lo.GetObjects() {
			if _, ok := seen[o]; ok {
				continue
			}
			seen[o] = struct{}{}
			merged = append(merged, o)
		}
	}
	sort.Strings(merged)
	return &openfgav1.ListObjectsResponse{Objects: merged}, nil
}

func cloneListObjectsRequestWithContextualTuples(req *openfgav1.ListObjectsRequest, ctxTuples *openfgav1.ContextualTupleKeys) *openfgav1.ListObjectsRequest {
	out := proto.Clone(req).(*openfgav1.ListObjectsRequest)
	out.ContextualTuples = ctxTuples
	return out
}

// doBatchCheckWithContextualTeamChunks sets contextual tuples on each check item, possibly running
// multiple OpenFGA [BatchCheck] calls (OR across chunks per correlation id).
func (s *Server) doBatchCheckWithContextualTeamChunks(
	ctx context.Context,
	store *zanzana.StoreInfo,
	checks []*openfgav1.BatchCheckItem,
	base *openfgav1.ContextualTupleKeys,
	teamTuples []*openfgav1.TupleKey,
) (map[string]*openfgav1.BatchCheckSingleResult, error) {
	if len(checks) == 0 {
		return nil, nil
	}
	chunks := s.buildContextualTupleChunks(base, teamTuples)
	if len(chunks) == 0 {
		s.setBatchCheckItemsContextualTuples(checks, nil)
		return s.doBatchCheck(ctx, store, checks)
	}
	if len(chunks) == 1 {
		s.setBatchCheckItemsContextualTuples(checks, chunks[0])
		return s.doBatchCheck(ctx, store, checks)
	}

	var merged map[string]*openfgav1.BatchCheckSingleResult
	for _, ch := range chunks {
		s.setBatchCheckItemsContextualTuples(checks, ch)
		partial, err := s.doBatchCheck(ctx, store, checks)
		if err != nil {
			return nil, err
		}
		if merged == nil {
			merged = partial
		} else {
			for id, p := range partial {
				merged[id] = orBatchCheckSingleResult(merged[id], p)
			}
		}
		if allBatchAllowed(merged) {
			return merged, nil
		}
	}
	return merged, nil
}

func (s *Server) setBatchCheckItemsContextualTuples(checks []*openfgav1.BatchCheckItem, ct *openfgav1.ContextualTupleKeys) {
	for _, c := range checks {
		if c != nil {
			c.ContextualTuples = ct
		}
	}
}

func allBatchAllowed(results map[string]*openfgav1.BatchCheckSingleResult) bool {
	if len(results) == 0 {
		return false
	}
	for _, r := range results {
		if r == nil || r.GetError() != nil {
			return false
		}
		if !r.GetAllowed() {
			return false
		}
	}
	return true
}

func orBatchCheckSingleResult(a, b *openfgav1.BatchCheckSingleResult) *openfgav1.BatchCheckSingleResult {
	if a == nil {
		return b
	}
	if b == nil {
		return a
	}
	if a.GetAllowed() || b.GetAllowed() {
		return &openfgav1.BatchCheckSingleResult{CheckResult: &openfgav1.BatchCheckSingleResult_Allowed{Allowed: true}}
	}
	if a.GetError() != nil {
		return a
	}
	if b.GetError() != nil {
		return b
	}
	return a
}
