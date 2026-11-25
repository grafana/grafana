package v2beta1_test

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/kube-openapi/pkg/validation/spec"

	dashv2beta1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2beta1"
)

func TestDashboardPreferencesMergedJSON(t *testing.T) {
	for _, tc := range []struct {
		name     string
		value    any
		expected string
	}{
		{
			name: "nothing stored",
			value: dashv2beta1.DashboardPreferencesMerged{
				TypeMeta: metav1.TypeMeta{Kind: dashv2beta1.DashboardPreferencesMergedKind, APIVersion: dashv2beta1.APIVERSION},
				Sources:  map[string]dashv2beta1.DashboardPreferencesMergedSource{},
			},
			expected: `{"kind":"DashboardPreferencesMerged","apiVersion":"dashboard.grafana.app/v2beta1","spec":{},"sources":{}}`,
		},
		{
			name:     "source without a name",
			value:    dashv2beta1.DashboardPreferencesMergedSource{Tier: dashv2beta1.DashboardPreferencesMergedTierFolder},
			expected: `{"tier":"folder"}`,
		},
		{
			name:     "reset source",
			value:    dashv2beta1.DashboardPreferencesMergedSource{Tier: dashv2beta1.DashboardPreferencesMergedTierUser, Name: "user-u1", Reset: true},
			expected: `{"tier":"user","name":"user-u1","reset":true}`,
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			b, err := json.Marshal(tc.value)
			require.NoError(t, err)
			require.JSONEq(t, tc.expected, string(b))
		})
	}
}

func TestDashboardPreferencesMergedOpenAPI(t *testing.T) {
	const refPrefix = "#/components/schemas/"
	defs := dashv2beta1.GetOpenAPIDefinitions(func(n string) spec.Ref { return spec.MustCreateRef(refPrefix + n) })

	mergedName := dashv2beta1.DashboardPreferencesMerged{}.OpenAPIModelName()
	specName := dashv2beta1.DashboardPreferencesMergedSpec{}.OpenAPIModelName()
	sourceName := dashv2beta1.DashboardPreferencesMergedSource{}.OpenAPIModelName()
	require.Equal(t, "com.github.grafana.grafana.apps.dashboard.pkg.apis.dashboard.v2beta1.DashboardPreferencesMerged", mergedName)
	require.Equal(t, "com.github.grafana.grafana.apps.dashboard.pkg.apis.dashboard.v2beta1.DashboardPreferencesMergedSpec", specName)
	require.Equal(t, "com.github.grafana.grafana.apps.dashboard.pkg.apis.dashboard.v2beta1.DashboardPreferencesMergedSource", sourceName)
	for _, name := range []string{mergedName, specName, sourceName} {
		_, ok := defs[name]
		require.True(t, ok, "no OpenAPI definition for %s", name)
	}

	merged := defs[mergedName].Schema
	require.ElementsMatch(t, []string{"spec", "sources"}, merged.Required)
	specProp := merged.Properties["spec"]
	require.Equal(t, refPrefix+specName, specProp.Ref.String())
	sources := merged.Properties["sources"]
	require.NotNil(t, sources.AdditionalProperties)
	require.NotNil(t, sources.AdditionalProperties.Schema)
	require.Equal(t, refPrefix+sourceName, sources.AdditionalProperties.Schema.Ref.String())

	mergedSpec := defs[specName].Schema
	require.Contains(t, mergedSpec.Properties, "dashboard")
	require.Contains(t, mergedSpec.Properties, "panels")
	require.NotContains(t, mergedSpec.Properties, "reset")
	dashboardProp := mergedSpec.Properties["dashboard"]
	require.Equal(t, refPrefix+dashv2beta1.DashboardPreferencesDashboardDefaults{}.OpenAPIModelName(), dashboardProp.Ref.String())

	source := defs[sourceName].Schema
	require.Equal(t, []string{"tier"}, source.Required)
	require.ElementsMatch(t, []any{"folder", "org", "user"}, source.Properties["tier"].Enum)
}
