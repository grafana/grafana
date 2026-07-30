package search

import (
	"strings"
	"testing"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime/schema"

	searchv0 "github.com/grafana/grafana/pkg/apis/search/v0alpha1"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

const (
	dashboardGroup    = "dashboard.grafana.app"
	dashboardResource = "dashboards"
)

// servedVersions reads the versions of a kind straight from the compiled-in
// manifests, so this cannot fall behind when a version is added.
func servedVersions(t *testing.T, group, resourceName string) []string {
	t.Helper()

	var out []string
	for _, m := range resource.AppManifests() {
		if m.ManifestData == nil || m.ManifestData.Group != group {
			continue
		}
		for _, version := range m.ManifestData.Versions {
			if !version.Served {
				continue
			}
			for _, kind := range version.Kinds {
				if resourceNameFor(kind) == resourceName {
					out = append(out, version.Name)
				}
			}
		}
	}
	require.NotEmpty(t, out, "found no served versions of %s/%s", group, resourceName)
	return out
}

func resourceNameFor(kind app.ManifestVersionKind) string {
	plural := kind.Plural
	if plural == "" {
		plural = kind.Kind + "s"
	}
	return strings.ToLower(plural)
}

// The search route is mounted on every served version of a kind, and validation
// resolves fields for the version in the URL. A version that does not declare
// its search fields would reject every custom field, so this checks the real
// compiled-in manifests rather than a test fixture.
func TestDashboardCustomFieldsResolveOnEveryServedVersion(t *testing.T) {
	provider := resource.NewManifestBackedProvider(resource.AppManifests())

	versions := servedVersions(t, dashboardGroup, dashboardResource)
	// Guard against the manifest shrinking to a single version and this test
	// quietly stopping to prove anything about cross-version consistency.
	require.Greater(t, len(versions), 1, "expected several served dashboard versions, got %v", versions)

	for _, version := range versions {
		t.Run(version, func(t *testing.T) {
			gvr := schema.GroupVersionResource{
				Group:    dashboardGroup,
				Version:  version,
				Resource: dashboardResource,
			}

			q := &searchv0.SearchQuery{
				TypeMeta: metaForKind(searchv0.KindSearchQuery),
				Where: &searchv0.WhereNode{
					Filter: &searchv0.FilterPredicate{
						Field:    "panel_types",
						Operator: "In",
						Values:   []string{"timeseries"},
					},
				},
			}

			req, errs := TranslateSearchQuery(q, gvr, "default", provider)
			require.Empty(t, errs, "panel_types must be declared for %s", version)
			require.NotNil(t, req)

			// The public name goes out as-is: mapping it to the physical
			// fields.* field is the backend's job.
			require.Len(t, req.Options.Fields, 1)
			assert.Equal(t, "panel_types", req.Options.Fields[0].Key)
		})
	}
}
