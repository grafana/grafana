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
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/search"
	"github.com/grafana/grafana/pkg/storage/unified/search/builders"
)

// Run with -update-golden to regenerate the JSON snapshots after an
// intentional change to the bleve mapping shape:
//
//	go test ./pkg/storage/unified/search/ -run TestBleveMappingsGoldenJSON -update-golden
var updateGolden = flag.Bool("update-golden", false, "regenerate bleve mapping golden JSON files")

// TestBleveMappingsGoldenJSON pins the bleve index mapping shape produced by
// GetBleveMappings to JSON snapshots committed under testdata. Each snapshot
// captures the current on-disk shape; when an intentional change to the
// mapping ships, regenerate with -update-golden and review the diff. Any
// unintended drift trips this test.
//
// The standard search fields (title, title_phrase, title_ngram, description,
// tags, folder, ownerReferences, createdBy, managedBy, manager.*, source.*,
// labels.*, reference.*, created, updated) are part of the mapping returned
// by GetBleveMappings even with nil inputs, so the "empty" case below already
// captures their full bleve representation. A separate snapshot of the
// raw StandardSearchFields column definitions would not add information.
//
// The per-kind cases (dashboard, user, team, team_binding,
// external_group_mapping) call each in-tree builder and feed the resulting
// DocumentBuilderInfo through GetBleveMappings the same way BuildIndex does
// in production: when DocumentBuilderInfo.SearchFieldsProvider is non-nil,
// the test passes it through, exercising the provider-driven mapping path.
// Dashboard's builder does not set a provider yet, so it continues to drive
// the mapping from its column-definition-derived Fields. The per-kind
// snapshots guard against accidental shape drift while the manifest-driven
// search-fields work moves the source of truth from column definitions to
// SearchFieldsProvider declarations.
//
// Because the IAM builders return a non-nil provider, the user, team,
// team_binding, and external_group_mapping goldens prove that turning the
// provider on for these kinds produces the same on-disk mapping shape as
// the legacy column-definition path. Search server and client can deploy
// separately, so this byte-identical guarantee matters.
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

	// builderInfoFor returns the DocumentBuilderInfo for an in-tree kind so
	// the test can mirror BuildIndex: pass Fields, SearchFieldsProvider,
	// Group, and Resource through to GetBleveMappings together.
	builderInfoFor := func(t *testing.T, fn func() (resource.DocumentBuilderInfo, error)) resource.DocumentBuilderInfo {
		t.Helper()
		info, err := fn()
		require.NoError(t, err)
		return info
	}
	dashboardInfo := func(t *testing.T) resource.DocumentBuilderInfo {
		return builderInfoFor(t, func() (resource.DocumentBuilderInfo, error) { return builders.DashboardBuilder(nil) })
	}
	userInfo := func(t *testing.T) resource.DocumentBuilderInfo {
		return builderInfoFor(t, builders.GetUserBuilder)
	}
	teamInfo := func(t *testing.T) resource.DocumentBuilderInfo {
		return builderInfoFor(t, builders.GetTeamSearchBuilder)
	}
	teamBindingInfo := func(t *testing.T) resource.DocumentBuilderInfo {
		return builderInfoFor(t, builders.GetTeamBindingBuilder)
	}
	externalGroupMappingInfo := func(t *testing.T) resource.DocumentBuilderInfo {
		return builderInfoFor(t, builders.GetExternalGroupMappingBuilder)
	}

	cases := []struct {
		name string
		// builder returns the DocumentBuilderInfo for a real in-tree kind.
		// When set, the test passes info.Fields, info.SearchFieldsProvider,
		// info.GroupResource.{Group,Resource} to GetBleveMappings together,
		// matching production.
		builder func(t *testing.T) resource.DocumentBuilderInfo
		// providerExpected, when true, asserts builder() returns a non-nil
		// SearchFieldsProvider so a future regression in builder wiring
		// (silently dropping the provider) is caught here.
		providerExpected bool
		fields           func(t *testing.T) resource.SearchableDocumentFields
		provider         func(t *testing.T) (resource.SearchFieldsProvider, string, string)
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
		{
			// Dashboard's builder does not set SearchFieldsProvider yet (a
			// follow-up migration will). Until then the mapping is driven by
			// the column-definition-derived Fields, so providerExpected stays
			// false and this case keeps the legacy path covered.
			name:             "dashboard",
			builder:          dashboardInfo,
			providerExpected: false,
			path:             "testdata/bleve_mapping_dashboard.json",
		},
		{
			name:             "user",
			builder:          userInfo,
			providerExpected: true,
			path:             "testdata/bleve_mapping_user.json",
		},
		{
			name:             "team",
			builder:          teamInfo,
			providerExpected: true,
			path:             "testdata/bleve_mapping_team.json",
		},
		{
			name:             "team_binding",
			builder:          teamBindingInfo,
			providerExpected: true,
			path:             "testdata/bleve_mapping_team_binding.json",
		},
		{
			name:             "external_group_mapping",
			builder:          externalGroupMappingInfo,
			providerExpected: true,
			path:             "testdata/bleve_mapping_external_group_mapping.json",
		},
		{
			// Provider-driven path: a kind whose bleve mapping comes from
			// SearchFieldDefinitions rather than column definitions. Exercises
			// the type-aware filter rule: string+filter emits an explicit
			// keyword mapping, non-string+filter falls back to dynamic.
			name: "provider_driven",
			provider: func(t *testing.T) (resource.SearchFieldsProvider, string, string) {
				t.Helper()
				gvr := schema.GroupVersionResource{Group: "example.test", Version: "v0", Resource: "widgets"}
				p := resource.NewMapProvider(
					map[schema.GroupVersionResource][]resource.SearchFieldDefinition{
						gvr: {
							{Name: "label", Type: resource.SearchFieldTypeString, Capabilities: []resource.SearchCapability{resource.SearchCapabilityFilter, resource.SearchCapabilityRetrieve}},
							{Name: "count", Type: resource.SearchFieldTypeInt64, Capabilities: []resource.SearchCapability{resource.SearchCapabilityFilter, resource.SearchCapabilityRetrieve}},
							{Name: "active", Type: resource.SearchFieldTypeBoolean, Capabilities: []resource.SearchCapability{resource.SearchCapabilityFilter, resource.SearchCapabilityRetrieve}},
							{Name: "description", Type: resource.SearchFieldTypeString, Capabilities: []resource.SearchCapability{resource.SearchCapabilityText, resource.SearchCapabilityRetrieve}},
						},
					},
					map[schema.GroupResource]string{
						gvr.GroupResource(): gvr.Version,
					},
				)
				return p, gvr.Group, gvr.Resource
			},
			path: "testdata/bleve_mapping_provider_driven.json",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			var fields resource.SearchableDocumentFields
			var provider resource.SearchFieldsProvider
			var group, kindResource string

			switch {
			case tc.builder != nil:
				info := tc.builder(t)
				fields = info.Fields
				provider = info.SearchFieldsProvider
				group = info.GroupResource.Group
				kindResource = info.GroupResource.Resource
				if tc.providerExpected {
					require.NotNil(t, provider, "builder for %q must return a non-nil SearchFieldsProvider so the golden exercises the provider-driven mapping path used in production", tc.name)
				}
			case tc.provider != nil:
				provider, group, kindResource = tc.provider(t)
			case tc.fields != nil:
				fields = tc.fields(t)
			}

			mappings, err := search.GetBleveMappings(fields, provider, group, kindResource, tc.selectableFields)
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
