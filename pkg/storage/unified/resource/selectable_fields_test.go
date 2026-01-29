package resource

import (
	"testing"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestSelectableFieldsForManifests(t *testing.T) {
	// No selectable fields
	m1 := app.NewEmbeddedManifest(app.ManifestData{
		Group: "test1.grafana.app",
		Versions: []app.ManifestVersion{
			{
				Name: "v1",
				Kinds: []app.ManifestVersionKind{
					{
						Kind:   "TestKind",
						Plural: "TestKinds",
					},
				},
			},
		},
	})

	// One version with selectable fields.
	m2 := app.NewEmbeddedManifest(app.ManifestData{
		Group: "test2.grafana.app",
		Versions: []app.ManifestVersion{
			{
				Name: "v1",
				Kinds: []app.ManifestVersionKind{
					{
						Kind:   "TestKind",
						Plural: "TestKinds",
						SelectableFields: []string{
							"spec.field1",
							"spec.field2",
						},
					},
				},
			},
		},
	})

	// Multiple versions with repeated and new fields.
	m3 := app.NewEmbeddedManifest(app.ManifestData{
		Group: "test3.grafana.app",
		Versions: []app.ManifestVersion{
			{
				Name: "v1alpha0",
				Kinds: []app.ManifestVersionKind{
					{
						Kind:   "TestKind",
						Plural: "TestKinds",
					},
				},
			},
			{
				Name: "v1alpha1",
				Kinds: []app.ManifestVersionKind{
					{
						Kind:   "TestKind",
						Plural: "TestKinds",
						SelectableFields: []string{
							"spec.field1",
							"spec.field2",
						},
					},
				},
			},
			{
				Name: "v1beta1",
				Kinds: []app.ManifestVersionKind{
					{
						Kind:   "TestKind",
						Plural: "TestKinds",
						SelectableFields: []string{
							"spec.field2", // duplicate
							"spec.field3", // new field
						},
					},
				},
			},
			{
				Name: "v1",
				Kinds: []app.ManifestVersionKind{
					{
						Kind:   "TestKind",
						Plural: "TestKinds",
						SelectableFields: []string{
							"spec.field3", // duplicate
							"spec.field4", // new
						},
					},
				},
			},
		},
	})

	// Multiple kinds in the same manifest.
	m4 := app.NewEmbeddedManifest(app.ManifestData{
		Group: "test4.grafana.app",
		Versions: []app.ManifestVersion{
			{
				Name: "v1",
				Kinds: []app.ManifestVersionKind{
					{
						Kind:   "KindA",
						Plural: "KindAs",
						SelectableFields: []string{
							"spec.fieldA",
						},
					},
					{
						Kind:   "KindB",
						Plural: "KindBs",
						SelectableFields: []string{
							"spec.fieldB",
						},
					},
				},
			},
		},
	})

	fields := SelectableFieldsForManifests([]app.Manifest{m1, m2, m3, m4})
	expected := map[string][]string{
		// Nothing for test1.grafana.app, as there were no selectable fields.
		"test2.grafana.app/testkind":  {"spec.field1", "spec.field2"},
		"test2.grafana.app/testkinds": {"spec.field1", "spec.field2"},
		"test3.grafana.app/testkind":  {"spec.field1", "spec.field2", "spec.field3", "spec.field4"},
		"test3.grafana.app/testkinds": {"spec.field1", "spec.field2", "spec.field3", "spec.field4"},
		"test4.grafana.app/kinda":     {"spec.fieldA"},
		"test4.grafana.app/kindas":    {"spec.fieldA"},
		"test4.grafana.app/kindb":     {"spec.fieldB"},
		"test4.grafana.app/kindbs":    {"spec.fieldB"},
	}
	require.Equal(t, expected, fields)
}

func TestSelectableFields(t *testing.T) {
	// Ensures SelectableFields works with actual manifests
	result := SelectableFields()

	// We know IAM manifest should have TeamBinding with selectable fields
	assert.Contains(t, result, "iam.grafana.app/teambinding")
	assert.Contains(t, result["iam.grafana.app/teambinding"], "spec.subject.name")
	assert.Contains(t, result["iam.grafana.app/teambinding"], "spec.teamRef.name")

	// Check the plural version too.
	assert.Contains(t, result, "iam.grafana.app/teambinding")
	assert.Contains(t, result["iam.grafana.app/teambindings"], "spec.subject.name")
	assert.Contains(t, result["iam.grafana.app/teambindings"], "spec.teamRef.name")
}
