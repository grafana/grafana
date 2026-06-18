package search

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func TestESClampResultWindow(t *testing.T) {
	body := map[string]any{"size": int64(100000), "from": int64(0)}
	esClampResultWindow(body)
	require.Equal(t, int64(100000), esRequestLimit(body))

	body = map[string]any{"size": int64(100001), "from": int64(0)}
	esClampResultWindow(body)
	require.Equal(t, int64(100000), esRequestLimit(body))
}

func TestESMappingGolden(t *testing.T) {
	schema := []*resourcepb.FieldDescriptor{
		{
			Name:         "tags",
			Type:         resourcepb.FieldType_FIELD_TYPE_STRING,
			Array:        true,
			Capabilities: []resourcepb.Capability{resourcepb.Capability_CAPABILITY_FILTER, resourcepb.Capability_CAPABILITY_FACET},
		},
		{
			Name:         "panel_title",
			Type:         resourcepb.FieldType_FIELD_TYPE_STRING,
			Array:        true,
			Capabilities: []resourcepb.Capability{resourcepb.Capability_CAPABILITY_TEXT, resourcepb.Capability_CAPABILITY_PARTIAL},
		},
	}
	got := esMappingFromSchema(schema)
	assertGoldenJSON(t, "elastic_mapping_golden.json", got)
}

func TestESSearchBodyGolden(t *testing.T) {
	req := &resourcepb.SearchRequest{
		Index: &resourcepb.ResourceIndexKey{Namespace: "default", Group: "dashboard.grafana.app", Resource: "dashboards"},
		Query: &resourcepb.Query{
			Text: []*resourcepb.TextPredicate{{Value: "cpu", Fields: []string{"title"}}},
			Filters: []*resourcepb.FilterPredicate{{
				Field:  "folder",
				Op:     resourcepb.FilterOp_FILTER_OP_IN,
				Values: []string{"platform"},
			}},
		},
		Authz: &resourcepb.AuthzFilter{Folders: []string{"platform", "general"}},
		Sort:  []*resourcepb.Sort{{Field: "title", Desc: true}},
		Facets: []*resourcepb.FacetRequest{{
			Field: "tags",
			Limit: 10,
		}},
		Limit:        25,
		IncludeTotal: true,
	}
	got := esSearchBody(req)
	assertGoldenJSON(t, "elastic_query_golden.json", got)
}

func assertGoldenJSON(t *testing.T, name string, got any) {
	t.Helper()
	raw, err := json.MarshalIndent(got, "", "  ")
	require.NoError(t, err)
	path := filepath.Join("testdata", name)
	if os.Getenv("UPDATE_GOLDEN") == "1" {
		require.NoError(t, os.MkdirAll(filepath.Dir(path), 0750))
		require.NoError(t, os.WriteFile(path, raw, 0644))
	}
	want, err := os.ReadFile(path)
	if os.IsNotExist(err) {
		t.Fatalf("golden file %s missing; re-run with UPDATE_GOLDEN=1", path)
	}
	require.NoError(t, err)
	require.JSONEq(t, string(want), string(raw))
}
