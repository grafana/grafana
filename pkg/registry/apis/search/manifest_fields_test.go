package search

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime/schema"

	searchv0 "github.com/grafana/grafana/pkg/apis/search/v0alpha1"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

// The search route is mounted on every served version of a kind, and validation
// resolves fields for the version in the URL. A version that does not declare
// its search fields would reject every custom field, so this checks the real
// compiled-in manifests rather than a test fixture.
func TestDashboardCustomFieldsResolveOnEverServedVersion(t *testing.T) {
	provider := resource.NewManifestBackedProvider(resource.AppManifests())

	for _, version := range []string{"v0alpha1", "v1", "v1beta1", "v2alpha1", "v2beta1"} {
		t.Run(version, func(t *testing.T) {
			gvr := schema.GroupVersionResource{
				Group:    "dashboard.grafana.app",
				Version:  version,
				Resource: "dashboards",
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
