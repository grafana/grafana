package search

import (
	"fmt"
	"strings"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// esMaxResultWindow matches folderSearchLimit in folderimpl — Bleve accepts
// large page sizes; Elasticsearch defaults to 10_000 unless raised on the index.
const esMaxResultWindow int64 = 100000

func esSearchBody(req *resourcepb.SearchRequest) map[string]any {
	body := map[string]any{
		"size": req.Limit,
	}
	if req.Limit <= 0 {
		body["size"] = 50
	}
	if req.Offset > 0 {
		body["from"] = req.Offset
	}
	if len(req.SearchAfter) > 0 {
		body["search_after"] = req.SearchAfter
		delete(body, "from")
	}
	if req.IncludeTotal {
		body["track_total_hits"] = true
	}

	boolQ := map[string]any{}
	var filter []any
	var must []any
	var mustNot []any

	if req.IsDeleted {
		filter = append(filter, map[string]any{"term": map[string]any{"is_deleted": true}})
	} else {
		filter = append(filter, map[string]any{"term": map[string]any{"is_deleted": false}})
	}

	if req.Query != nil {
		for _, text := range req.Query.Text {
			if text == nil || text.Value == "" {
				continue
			}
			fields := esTextFields(text.Fields)
			must = append(must, map[string]any{
				"multi_match": map[string]any{
					"query":  text.Value,
					"fields": fields,
					"type":   "best_fields",
				},
			})
		}
		for _, f := range req.Query.Filters {
			if f == nil {
				continue
			}
			field := esFilterField(f.Field)
			switch f.Op {
			case resourcepb.FilterOp_FILTER_OP_NOT_IN:
				mustNot = append(mustNot, map[string]any{"terms": map[string]any{field: f.Values}})
			default:
				filter = append(filter, map[string]any{"terms": map[string]any{field: f.Values}})
			}
		}
		for _, l := range req.Query.Labels {
			if l == nil {
				continue
			}
			field := "labels." + l.Key
			switch l.Op {
			case resourcepb.FilterOp_FILTER_OP_NOT_IN:
				mustNot = append(mustNot, map[string]any{"terms": map[string]any{field: l.Values}})
			default:
				filter = append(filter, map[string]any{"terms": map[string]any{field: l.Values}})
			}
		}
	}

	if req.Authz != nil {
		if req.Authz.All {
			// no authz filter
		} else {
			if len(req.Authz.Folders) > 0 {
				filter = append(filter, map[string]any{"terms": map[string]any{"folder": req.Authz.Folders}})
			}
			if len(req.Authz.Names) > 0 {
				filter = append(filter, map[string]any{"terms": map[string]any{"name": req.Authz.Names}})
			}
		}
	}

	if len(filter) > 0 {
		boolQ["filter"] = filter
	}
	if len(must) > 0 {
		boolQ["must"] = must
	}
	if len(mustNot) > 0 {
		boolQ["must_not"] = mustNot
	}
	if len(boolQ) > 0 {
		body["query"] = map[string]any{"bool": boolQ}
	} else {
		body["query"] = map[string]any{"match_all": map[string]any{}}
	}

	if len(req.Sort) > 0 {
		sort := make([]any, 0, len(req.Sort))
		for _, s := range req.Sort {
			if s == nil {
				continue
			}
			order := "asc"
			if s.Desc {
				order = "desc"
			}
			sort = append(sort, map[string]any{esSortField(s.Field): map[string]any{"order": order}})
		}
		body["sort"] = sort
	}

	if len(req.Facets) > 0 {
		aggs := map[string]any{}
		for _, facet := range req.Facets {
			if facet == nil {
				continue
			}
			name := facet.Field
			limit := facet.Limit
			if limit <= 0 {
				limit = 50
			}
			aggs[name] = map[string]any{
				"terms": map[string]any{
					"field": esFilterField(facet.Field),
					"size":  limit,
				},
			}
		}
		body["aggs"] = aggs
	}

	if req.Explain {
		body["explain"] = true
	}
	esClampResultWindow(body)
	return body
}

func esClampResultWindow(body map[string]any) {
	size := esRequestLimit(body)
	var from int64
	switch v := body["from"].(type) {
	case int:
		from = int64(v)
	case int64:
		from = v
	case float64:
		from = int64(v)
	}
	if from+size > esMaxResultWindow {
		capped := esMaxResultWindow - from
		if capped < 1 {
			capped = 1
		}
		body["size"] = capped
	}
}

func esFilterField(field string) string {
	field = strings.TrimPrefix(field, resource.SEARCH_SELECTABLE_FIELDS_PREFIX)
	field = strings.TrimPrefix(field, resource.SEARCH_FIELD_PREFIX)
	if field == "folder" || field == "name" || field == "tags" || field == resource.SEARCH_FIELD_TITLE {
		return esKeywordField(field)
	}
	if strings.HasPrefix(field, "labels.") {
		return field
	}
	return "fields." + field + ".keyword"
}

func esSortField(field string) string {
	field = strings.TrimPrefix(field, resource.SEARCH_FIELD_PREFIX)
	switch field {
	case resource.SEARCH_FIELD_TITLE:
		return "title_phrase"
	case "folder", "name", "created":
		return field
	default:
		return "fields." + field + ".keyword"
	}
}

func esDocID(key *resourcepb.ResourceKey) string {
	if key == nil {
		return ""
	}
	return fmt.Sprintf("%s/%s/%s/%s", key.Namespace, key.Group, key.Resource, key.Name)
}

func documentToES(doc *resourcepb.Document) map[string]any {
	if doc == nil || doc.Key == nil {
		return nil
	}
	out := map[string]any{
		"name":             doc.Key.Name,
		"title":            doc.Title,
		"title_phrase":     strings.ToLower(doc.Title),
		"title_ngram":      doc.Title,
		"folder":           doc.Folder,
		"created":          doc.Created,
		"created_by":       doc.CreatedBy,
		"ownerReferences":  doc.OwnerReferences,
		"labels":           doc.Labels,
		"is_deleted":       doc.IsDeleted,
		"resource_version": doc.ResourceVersion,
	}
	if len(doc.Fields) > 0 {
		fields := map[string]any{}
		for _, fv := range doc.Fields {
			if fv == nil {
				continue
			}
			vals := make([]any, 0, len(fv.Values))
			for _, v := range fv.Values {
				vals = append(vals, v.AsInterface())
			}
			if len(vals) == 1 {
				fields[fv.Name] = vals[0]
			} else {
				fields[fv.Name] = vals
			}
		}
		out["fields"] = fields
	}
	return out
}

func parseESSearchResponse(raw map[string]any, req *resourcepb.SearchRequest) (*resourcepb.SearchResponse, error) {
	out := &resourcepb.SearchResponse{}
	if hitsRoot, ok := raw["hits"].(map[string]any); ok {
		if total, ok := hitsRoot["total"].(map[string]any); ok {
			if v, ok := total["value"].(float64); ok {
				out.TotalHits = int64(v)
			}
		}
		if hits, ok := hitsRoot["hits"].([]any); ok {
			for _, h := range hits {
				hitMap, ok := h.(map[string]any)
				if !ok {
					continue
				}
				out.Hits = append(out.Hits, parseESHit(hitMap, req))
				if score, ok := hitMap["_score"].(float64); ok && score > out.MaxScore {
					out.MaxScore = score
				}
			}
		}
	}
	if aggs, ok := raw["aggregations"].(map[string]any); ok {
		for field, aggRaw := range aggs {
			agg, ok := aggRaw.(map[string]any)
			if !ok {
				continue
			}
			fr := &resourcepb.FacetResult{Field: field}
			if buckets, ok := agg["buckets"].([]any); ok {
				for _, b := range buckets {
					bm, ok := b.(map[string]any)
					if !ok {
						continue
					}
					term := fmt.Sprint(bm["key"])
					count := int64(0)
					if v, ok := bm["doc_count"].(float64); ok {
						count = int64(v)
					}
					fr.Terms = append(fr.Terms, &resourcepb.TermCount{Term: term, Count: count})
					fr.Total += count
				}
			}
			out.Facets = append(out.Facets, fr)
		}
	}
	return out, nil
}

func esRequestLimit(body map[string]any) int64 {
	switch v := body["size"].(type) {
	case int64:
		if v > 0 {
			return v
		}
	case int:
		if v > 0 {
			return int64(v)
		}
	case float64:
		if v > 0 {
			return int64(v)
		}
	}
	return 50
}

func parseESHit(hit map[string]any, req *resourcepb.SearchRequest) *resourcepb.Hit {
	src, _ := hit["_source"].(map[string]any)
	h := &resourcepb.Hit{}
	if score, ok := hit["_score"].(float64); ok {
		h.Score = score
	}
	if sa, ok := hit["sort"].([]any); ok {
		for _, v := range sa {
			h.SortValues = append(h.SortValues, fmt.Sprint(v))
		}
	}
	if src != nil && req != nil && req.Index != nil {
		key := &resourcepb.ResourceKey{
			Namespace: req.Index.Namespace,
			Group:     req.Index.Group,
			Resource:  req.Index.Resource,
			Name:      fmt.Sprint(src["name"]),
		}
		if idx, ok := hit["_index"].(string); ok {
			if parsed := parseResourceKeyFromIndexName(idx, req); parsed != nil {
				key = parsed
				key.Name = fmt.Sprint(src["name"])
			}
		}
		h.Key = key
	}
	return h
}

// parseResourceKeyFromIndexName maps an Elasticsearch index name back to a
// resource key when searching federated indices (e.g. dashboards + folders).
func parseResourceKeyFromIndexName(indexName string, req *resourcepb.SearchRequest) *resourcepb.ResourceKey {
	if req == nil || req.Index == nil {
		return nil
	}
	candidates := []*resourcepb.ResourceIndexKey{req.Index}
	candidates = append(candidates, req.Federated...)
	for _, idxKey := range candidates {
		if idxKey == nil {
			continue
		}
		// Index names are built by esClient.indexName; match by suffix.
		suffix := sanitizeESName(idxKey.Group) + "-" + sanitizeESName(idxKey.Resource)
		if strings.HasSuffix(indexName, suffix) || strings.Contains(indexName, suffix) {
			return &resourcepb.ResourceKey{
				Namespace: idxKey.Namespace,
				Group:     idxKey.Group,
				Resource:  idxKey.Resource,
			}
		}
	}
	return nil
}
