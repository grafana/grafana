package search_test

import (
	"encoding/json"
	"flag"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/search"
)

// Run with -update-golden to regenerate the JSON snapshots after an
// intentional change to the bleve mapping shape:
//
//	go test ./pkg/storage/unified/search/ -run TestBleveMappingsGoldenJSON -update-golden
var updateGolden = flag.Bool("update-golden", false, "regenerate bleve mapping golden JSON files")

// TestBleveMappingsGoldenJSON pins the bleve index mapping shape produced by
// GetBleveMappings to JSON snapshots committed under testdata. The snapshots
// were generated from origin/main at commit 518fecc6df7 (the last commit
// before the manifest-driven search-fields work started) so this test serves
// as a regression guard: any future change that alters the on-disk index
// mapping shape will fail this test, forcing an explicit review and
// -update-golden regeneration.
//
// The standard search fields (title, title_phrase, title_ngram, description,
// tags, folder, ownerReferences, createdBy, managedBy, manager.*, source.*,
// labels.*, reference.*) are part of the mapping returned by
// GetBleveMappings even with nil inputs, so the "empty" case below already
// captures their full bleve representation. A separate snapshot of the
// raw StandardSearchFields column definitions would not add information.
func TestBleveMappingsGoldenJSON(t *testing.T) {
	filterableStringFields := func(t *testing.T) resource.SearchableDocumentFields {
		t.Helper()
		f, err := resource.NewSearchableDocumentFields([]*resourcepb.ResourceTableColumnDefinition{
			{
				// A typical per-kind custom field: filterable STRING. Today's
				// inner-loop output is a single keyword mapping at fields.<name>.
				Name: "panel_types",
				Type: resourcepb.ResourceTableColumnDefinition_STRING,
				Properties: &resourcepb.ResourceTableColumnDefinition_Properties{
					Filterable: true,
				},
			},
			{
				// A non-filterable STRING: no explicit mapping today.
				Name: "panel_title",
				Type: resourcepb.ResourceTableColumnDefinition_STRING,
			},
			{
				// A non-string column: no explicit mapping today.
				Name: "schema_version",
				Type: resourcepb.ResourceTableColumnDefinition_INT32,
			},
		})
		require.NoError(t, err)
		return f
	}

	cases := []struct {
		name             string
		fields           func(t *testing.T) resource.SearchableDocumentFields
		selectableFields []string
		path             string
	}{
		{
			name: "empty",
			path: "testdata/bleve_mapping_empty.json",
		},
		{
			name:   "filterable_string_field",
			fields: filterableStringFields,
			path:   "testdata/bleve_mapping_filterable_string.json",
		},
		{
			name:             "selectable_fields",
			selectableFields: []string{"spec.title", "spec.description"},
			path:             "testdata/bleve_mapping_selectable_fields.json",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			var fields resource.SearchableDocumentFields
			if tc.fields != nil {
				fields = tc.fields(t)
			}

			mappings, err := search.GetBleveMappings(fields, tc.selectableFields)
			require.NoError(t, err)

			got, err := json.MarshalIndent(mappings, "", "  ")
			require.NoError(t, err)
			got = append(got, '\n')

			compareOrUpdateGolden(t, tc.path, got)
		})
	}
}

func compareOrUpdateGolden(t *testing.T, path string, got []byte) {
	t.Helper()
	if *updateGolden {
		require.NoError(t, os.MkdirAll(filepath.Dir(path), 0o750))
		require.NoError(t, os.WriteFile(path, got, 0o600))
		return
	}
	want, err := os.ReadFile(path) //nolint:gosec // path comes from a hardcoded test case
	require.NoError(t, err, "missing golden file %s; regenerate with -update-golden", path)
	assert.Equal(t, strings.TrimSpace(string(want)), strings.TrimSpace(string(got)),
		"golden snapshot changed; if intended, rerun with -update-golden")
}
