package resource

import (
	"context"
	"sort"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/search/vector"
)

// HybridSearch implements ResourceIndexServer.
func (s *searchServer) HybridSearch(ctx context.Context, req *resourcepb.HybridSearchRequest) (*resourcepb.HybridSearchResponse, error) {
	return nil, status.Error(codes.Unimplemented, "hybrid search not implemented")
}

// rrfK is the standard Reciprocal Rank Fusion constant (Cormack, Clarke
// & Buettcher 2009).
const rrfK = 60

// maxChunksPerHybridResult bounds response size; only the best chunk
// influences score, the rest are payload for RAG consumers.
const maxChunksPerHybridResult = 10

type lexicalHit struct {
	uid    string
	title  string
	folder string
}

// fuseRRF merges the two authz-filtered rankings into one per-resource
// list ordered by descending RRF score (Σ 1/(rrfK+rank), 1-based ranks).
// Semantic rows arrive chunk-per-row in ascending-distance order; the
// first chunk per uid sets that uid's rank, later chunks ride along
// best-first. Lexical titles win over embeddings-row titles. Ties break
// by name for deterministic output.
func fuseRRF(reqKey *resourcepb.ResourceKey, lex []lexicalHit, sem []vector.VectorSearchResult) []*resourcepb.HybridSearchResult {
	fused := make(map[string]*resourcepb.HybridSearchResult, len(lex)+len(sem))
	get := func(uid string) *resourcepb.HybridSearchResult {
		r, ok := fused[uid]
		if !ok {
			r = &resourcepb.HybridSearchResult{Key: &resourcepb.ResourceKey{
				Namespace: reqKey.Namespace,
				Group:     reqKey.Group,
				Resource:  reqKey.Resource,
				Name:      uid,
			}}
			fused[uid] = r
		}
		return r
	}

	for i, h := range lex {
		r := get(h.uid)
		r.Score += 1.0 / float64(rrfK+i+1)
		r.Title = h.title
		r.Folder = h.folder
	}

	seen := make(map[string]struct{}, len(sem))
	rank := 0
	for i := range sem {
		v := &sem[i]
		r := get(v.UID)
		if _, dup := seen[v.UID]; !dup {
			seen[v.UID] = struct{}{}
			rank++
			r.Score += 1.0 / float64(rrfK+rank)
			if r.Title == "" {
				r.Title = v.Title
			}
			if r.Folder == "" {
				r.Folder = v.Folder
			}
		}
		if len(r.Chunks) < maxChunksPerHybridResult {
			r.Chunks = append(r.Chunks, &resourcepb.HybridSearchChunk{
				Subresource: v.Subresource,
				Content:     v.Content,
				Metadata:    v.Metadata,
			})
		}
	}

	out := make([]*resourcepb.HybridSearchResult, 0, len(fused))
	for _, r := range fused {
		// Rerankers score content, so hits found only by title matching
		// still need text to score.
		if len(r.Chunks) == 0 {
			r.Chunks = []*resourcepb.HybridSearchChunk{{Content: r.Title}}
		}
		out = append(out, r)
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].Score != out[j].Score {
			return out[i].Score > out[j].Score
		}
		return out[i].Key.Name < out[j].Key.Name
	})
	return out
}

// lexicalHitsFromResponse flattens the lexical leg's table into
// rank-ordered hits. STRING cells are raw bytes (see table.go's
// encoder). Missing columns leave fields empty; uid always comes from
// the row key.
func lexicalHitsFromResponse(resp *resourcepb.ResourceSearchResponse) []lexicalHit {
	if resp == nil || resp.Results == nil {
		return nil
	}
	titleIdx, folderIdx := -1, -1
	for i, c := range resp.Results.Columns {
		switch c.Name {
		case SEARCH_FIELD_TITLE:
			titleIdx = i
		case SEARCH_FIELD_FOLDER:
			folderIdx = i
		}
	}
	hits := make([]lexicalHit, 0, len(resp.Results.Rows))
	for _, row := range resp.Results.Rows {
		if row.Key == nil {
			continue
		}
		h := lexicalHit{uid: row.Key.Name}
		if titleIdx >= 0 && titleIdx < len(row.Cells) {
			h.title = string(row.Cells[titleIdx])
		}
		if folderIdx >= 0 && folderIdx < len(row.Cells) {
			h.folder = string(row.Cells[folderIdx])
		}
		hits = append(hits, h)
	}
	return hits
}
