package search

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/search/engine"
)

func TestESSearchBodyRootFolderFilter(t *testing.T) {
	req := &resourcepb.SearchRequest{
		Index: &resourcepb.ResourceIndexKey{Namespace: "default", Group: "dashboard.grafana.app", Resource: "dashboards"},
		Query: &resourcepb.Query{
			Filters: []*resourcepb.FilterPredicate{{
				Field:  "folder",
				Op:     resourcepb.FilterOp_FILTER_OP_IN,
				Values: []string{""},
			}},
		},
		Limit: 50,
	}
	body := esSearchBody(req)
	query, ok := body["query"].(map[string]any)
	require.True(t, ok)
	boolQ, ok := query["bool"].(map[string]any)
	require.True(t, ok)
	filter, ok := boolQ["filter"].([]any)
	require.True(t, ok)
	var folderClause map[string]any
	for _, f := range filter {
		m, ok := f.(map[string]any)
		if !ok {
			continue
		}
		if _, ok := m["bool"]; ok {
			folderClause = m
			break
		}
	}
	require.NotNil(t, folderClause)
	inner, ok := folderClause["bool"].(map[string]any)
	require.True(t, ok)
	should, ok := inner["should"].([]any)
	require.True(t, ok)
	require.Len(t, should, 2)
}

func TestExpandESFolderFilterValues(t *testing.T) {
	require.Equal(t, []string{"", "general"}, expandESFolderFilterValues([]string{""}))
	require.Equal(t, []string{"", "general"}, expandESFolderFilterValues([]string{"general"}))
	require.Equal(t, []string{"abc"}, expandESFolderFilterValues([]string{"abc"}))
}

func TestParseESHitPopulatesFields(t *testing.T) {
	req := &resourcepb.SearchRequest{
		Index: &resourcepb.ResourceIndexKey{
			Namespace: "default",
			Group:     "dashboard.grafana.app",
			Resource:  "dashboards",
		},
	}
	hit := parseESHit(map[string]any{
		"_score": 1.5,
		"_source": map[string]any{
			"name":   "dash-1",
			"title":  "Seed Dashboard 0001",
			"folder": "general",
		},
	}, req)

	require.NotNil(t, hit.Key)
	require.Equal(t, "dash-1", hit.Key.Name)
	require.Equal(t, 1.5, hit.Score)
	require.Len(t, hit.Fields, 3)

	values := map[string]string{}
	for _, fv := range hit.Fields {
		values[fv.Name] = fv.Values[0].GetStringValue()
	}
	require.Equal(t, "dash-1", values[resource.SEARCH_FIELD_NAME])
	require.Equal(t, "Seed Dashboard 0001", values[resource.SEARCH_FIELD_TITLE])
	require.Equal(t, "general", values[resource.SEARCH_FIELD_FOLDER])
}

func TestParseESSearchResponseMapsLegacyTable(t *testing.T) {
	raw := map[string]any{
		"hits": map[string]any{
			"total": map[string]any{"value": float64(1)},
			"hits": []any{
				map[string]any{
					"_score": 2.0,
					"_source": map[string]any{
						"name":   "dash-1",
						"title":  "CPU Usage",
						"folder": "platform",
					},
				},
			},
		},
	}
	engineReq := &resourcepb.SearchRequest{
		Index: &resourcepb.ResourceIndexKey{
			Namespace: "default",
			Group:     "dashboard.grafana.app",
			Resource:  "dashboards",
		},
	}
	engineRsp, err := parseESSearchResponse(raw, engineReq)
	require.NoError(t, err)
	require.Equal(t, int64(1), engineRsp.TotalHits)

	legacyReq := &resourcepb.ResourceSearchRequest{
		Options: &resourcepb.ListOptions{
			Key: &resourcepb.ResourceKey{
				Namespace: "default",
				Group:     "dashboard.grafana.app",
				Resource:  "dashboards",
			},
		},
	}
	legacy, err := engine.ToResourceSearchResponse(legacyReq, engineRsp)
	require.NoError(t, err)
	require.Len(t, legacy.Results.Rows, 1)

	cols := map[string]int{}
	for i, col := range legacy.Results.Columns {
		cols[col.Name] = i
	}
	row := legacy.Results.Rows[0]
	require.Equal(t, "dash-1", string(row.Cells[cols[resource.SEARCH_FIELD_NAME]]))
	require.Equal(t, "CPU Usage", string(row.Cells[cols[resource.SEARCH_FIELD_TITLE]]))
	require.Equal(t, "platform", string(row.Cells[cols[resource.SEARCH_FIELD_FOLDER]]))
}
