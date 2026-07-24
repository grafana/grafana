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
// external_group_mapping) take each in-tree kind's Group and Resource from its
// builder and its provider from a shared manifest-backed provider, matching how
// production builds the mapping from the registry. Each per-kind case sets
// providerExpected so a regression that drops a kind's declared fields is caught
// here. Search server and client can deploy separately, so the byte-identical
// guarantee from these goldens matters.
func TestBleveMappingsGoldenJSON(t *testing.T) {
	// builderInfoFor returns the DocumentBuilderInfo for an in-tree kind, used
	// for its Group and Resource.
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
		return builderInfoFor(t, func() (resource.DocumentBuilderInfo, error) { return builders.GetUserBuilder(nil) })
	}
	teamInfo := func(t *testing.T) resource.DocumentBuilderInfo {
		return builderInfoFor(t, func() (resource.DocumentBuilderInfo, error) { return builders.GetTeamSearchBuilder(nil) })
	}
	teamBindingInfo := func(t *testing.T) resource.DocumentBuilderInfo {
		return builderInfoFor(t, func() (resource.DocumentBuilderInfo, error) { return builders.GetTeamBindingBuilder(nil) })
	}
	externalGroupMappingInfo := func(t *testing.T) resource.DocumentBuilderInfo {
		return builderInfoFor(t, func() (resource.DocumentBuilderInfo, error) { return builders.GetExternalGroupMappingBuilder(nil) })
	}

	// In production the mapping's provider comes from the shared registry, built
	// from the app manifests, not from the builder. Mirror that here.
	manifestProvider := resource.NewManifestBackedProvider(resource.AppManifests())

	cases := []struct {
		name string
		// builder returns the DocumentBuilderInfo for a real in-tree kind. When
		// set, the test takes Group/Resource from it and the provider from the
		// shared manifest provider, matching production.
		builder func(t *testing.T) resource.DocumentBuilderInfo
		// providerExpected, when true, asserts the manifest provider declares
		// fields for the kind, so a regression that drops them is caught here.
		providerExpected bool
		provider         func(t *testing.T) (resource.SearchFieldsProvider, string, string)
		selectableFields []string
		path             string
	}{
		{
			name: "empty",
			path: "testdata/bleve_mapping_empty.json",
		},
		{
			name:             "selectable_fields",
			selectableFields: []string{"spec.title", "spec.description"},
			path:             "testdata/bleve_mapping_selectable_fields.json",
		},
		{
			name:             "dashboard",
			builder:          dashboardInfo,
			providerExpected: true,
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
			// Provider-driven path with a synthetic kind: exercises the
			// type-aware filter rule (string+filter emits an explicit keyword
			// mapping, non-string+filter falls back to dynamic) on
			// declarations that no in-tree builder produces.
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
			var provider resource.SearchFieldsProvider
			var group, kindResource string

			switch {
			case tc.builder != nil:
				info := tc.builder(t)
				provider = manifestProvider
				group = info.GroupResource.Group
				kindResource = info.GroupResource.Resource
				if tc.providerExpected {
					require.NotEmpty(t, provider.Fields(schema.GroupVersionResource{Group: group, Resource: kindResource}),
						"the manifest provider must declare fields for %q so the golden exercises the provider-driven mapping path used in production", tc.name)
				}
			case tc.provider != nil:
				provider, group, kindResource = tc.provider(t)
			}

			mappings, err := search.GetBleveMappings(provider, group, kindResource, tc.selectableFields)
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
