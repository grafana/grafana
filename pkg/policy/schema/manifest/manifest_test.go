package manifest

import (
	"testing"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

func TestNewResolver(t *testing.T) {
	vs, err := app.VersionSchemaFromMap(map[string]any{
		"AlertRule": map[string]any{
			"type": "object",
			"properties": map[string]any{
				"spec": map[string]any{"$ref": "#/components/schemas/spec"},
			},
		},
		"spec": map[string]any{
			"type": "object",
			"properties": map[string]any{
				"trigger": map[string]any{"$ref": "#/components/schemas/IntervalTrigger"},
			},
		},
		"IntervalTrigger": map[string]any{
			"type": "object",
			"properties": map[string]any{
				"interval": map[string]any{"type": "string"},
			},
		},
	}, "AlertRule")
	require.NoError(t, err)

	r, err := NewResolver(app.ManifestData{
		AppName: "alerting",
		Group:   "rules.alerting.grafana.app",
		Versions: []app.ManifestVersion{{
			Name:  "v0alpha1",
			Kinds: []app.ManifestVersionKind{{Kind: "AlertRule", Schema: vs}},
		}},
	})
	require.NoError(t, err)

	s, err := r.ResolveSchema(schema.GroupVersionKind{Group: "rules.alerting.grafana.app", Version: "v0alpha1", Kind: "AlertRule"})
	require.NoError(t, err)
	interval := s.Properties["spec"].Properties["trigger"].Properties["interval"]
	require.Equal(t, []string{"string"}, []string(interval.Type), "references must be inlined")

	_, err = r.ResolveSchema(schema.GroupVersionKind{Group: "rules.alerting.grafana.app", Version: "v0alpha1", Kind: "RecordingRule"})
	require.ErrorContains(t, err, "schema not found")
}

func TestNewResolverSkipsKindsWithoutSchemas(t *testing.T) {
	m := app.ManifestData{
		AppName:  "alerting",
		Group:    "rules.alerting.grafana.app",
		Versions: []app.ManifestVersion{{Name: "v0alpha1", Kinds: []app.ManifestVersionKind{{Kind: "AlertRule", Plural: "AlertRules"}}}},
	}
	r, err := NewResolver(m)
	require.NoError(t, err)
	gvk := schema.GroupVersionKind{Group: "rules.alerting.grafana.app", Version: "v0alpha1", Kind: "AlertRule"}
	_, err = r.ResolveSchema(gvk)
	require.ErrorContains(t, err, "schema not found")

	require.Equal(t, schema.GroupVersionResource{Group: gvk.Group, Version: gvk.Version, Resource: "alertrules"}, Resources(m)[gvk])
}
