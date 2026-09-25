package vector

import (
	"context"
	"encoding/json"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"

	"github.com/grafana/grafana/pkg/storage/unified/sql/dbutil"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
)

var _ LexicalSearcher = (*pgvectorBackend)(nil)

// searchFilterPredicates maps SearchFilters onto template predicates;
// shared by both legs so filter semantics can't diverge.
func searchFilterPredicates(filters []SearchFilter) (uids, folders []string, groups []MetadataFilterGroup) {
	for _, f := range filters {
		switch f.Field {
		case "uid":
			uids = f.Values
		case "folder":
			folders = f.Values
		default:
			// An empty group would render as "AND ()" — invalid SQL.
			if len(f.Values) == 0 {
				continue
			}
			// Writers store metadata values as scalars (embed extractor) or
			// arrays (external collections); match either shape per value.
			group := MetadataFilterGroup{JSONs: make([]string, 0, 2*len(f.Values))}
			for _, v := range f.Values {
				s, _ := json.Marshal(map[string]string{f.Field: v})
				a, _ := json.Marshal(map[string][]string{f.Field: {v}})
				group.JSONs = append(group.JSONs, string(s), string(a))
			}
			groups = append(groups, group)
		}
	}
	return uids, folders, groups
}

// LexicalSearch runs postgres FTS over stored content:
// websearch_to_tsquery + ts_rank_cd, best chunk per uid. No
// validateResource: q.Resource is a freshly-resolved partition key, used
// only as a query parameter, never interpolated.
func (b *pgvectorBackend) LexicalSearch(ctx context.Context, q LexicalQuery) (hits []LexicalHit, retErr error) {
	ctx, span := tracer.Start(ctx, "unified.vector.pgvector.LexicalSearch")
	defer func() {
		if retErr != nil {
			span.RecordError(retErr)
			span.SetStatus(codes.Error, retErr.Error())
		}
		span.End()
	}()
	span.SetAttributes(
		attribute.String("namespace", q.Namespace),
		attribute.String("model", q.Model),
		attribute.String("resource", q.Resource),
		attribute.Int("limit", q.Limit),
		attribute.Int("filter_count", len(q.Filters)),
	)

	req := &sqlVectorCollectionLexicalSearchRequest{
		SQLTemplate: sqltemplate.New(b.dialect),
		Resource:    q.Resource,
		Namespace:   q.Namespace,
		Model:       q.Model,
		Query:       q.Query,
		Limit:       int64(q.Limit),
		Response:    &sqlVectorCollectionLexicalSearchResponse{},
	}
	req.UIDValues, req.FolderValues, req.MetadataFilterGroups = searchFilterPredicates(q.Filters)

	rows, err := dbutil.Query(ctx, b.db, sqlVectorCollectionLexicalSearch, req)
	if err != nil {
		return nil, err
	}

	hits = make([]LexicalHit, len(rows))
	for i, row := range rows {
		hits[i] = LexicalHit{
			UID:         row.UID,
			Title:       row.Title,
			Folder:      row.Folder,
			Score:       row.Rank,
			Subresource: row.Subresource,
			Content:     row.Content,
			Metadata:    row.Metadata,
		}
	}
	return hits, nil
}
