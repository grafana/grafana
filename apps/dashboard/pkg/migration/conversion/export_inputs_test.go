package conversion

import (
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	dashv0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	dashv1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1"
	dashv2beta1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2beta1"
	"github.com/grafana/grafana/apps/dashboard/pkg/migration/schemaversion"
	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
)

// externallySharedExport mirrors the shape produced by the classic "Export for
// sharing externally" flow for a dashboard with a constant variable
// (name: speed, value: 100) rendered by a text panel, plus a datasource input.
func externallySharedExport() map[string]interface{} {
	return map[string]interface{}{
		"__inputs": []interface{}{
			map[string]interface{}{
				"name":        "VAR_SPEED",
				"type":        "constant",
				"label":       "speed",
				"value":       "100",
				"description": "",
			},
			map[string]interface{}{
				"name":     "DS_PROMETHEUS",
				"type":     "datasource",
				"label":    "Prometheus",
				"pluginId": "prometheus",
			},
		},
		"title":         "speed",
		"schemaVersion": schemaversion.LATEST_VERSION,
		"panels": []interface{}{
			map[string]interface{}{
				"id":   float64(1),
				"type": "text",
				"options": map[string]interface{}{
					"content": "value is ${VAR_SPEED}",
				},
				"datasource": map[string]interface{}{
					"type": "prometheus",
					"uid":  "${DS_PROMETHEUS}",
				},
			},
		},
		"templating": map[string]interface{}{
			"list": []interface{}{
				map[string]interface{}{
					"name":  "speed",
					"type":  "constant",
					"query": "${VAR_SPEED}",
					"current": map[string]interface{}{
						"text":  "${VAR_SPEED}",
						"value": "${VAR_SPEED}",
					},
				},
			},
		},
	}
}

func TestResolveConstantExportInputs(t *testing.T) {
	t.Run("substitutes constant placeholders everywhere except __inputs", func(t *testing.T) {
		dash := externallySharedExport()
		resolveConstantExportInputs(dash)

		variable := dash["templating"].(map[string]interface{})["list"].([]interface{})[0].(map[string]interface{})
		require.Equal(t, "100", variable["query"])
		require.Equal(t, "100", variable["current"].(map[string]interface{})["text"])
		require.Equal(t, "100", variable["current"].(map[string]interface{})["value"])

		panel := dash["panels"].([]interface{})[0].(map[string]interface{})
		require.Equal(t, "value is 100", panel["options"].(map[string]interface{})["content"])

		// input definitions themselves are left untouched
		constantInput := dash["__inputs"].([]interface{})[0].(map[string]interface{})
		require.Equal(t, "100", constantInput["value"])
	})

	t.Run("leaves datasource inputs unresolved", func(t *testing.T) {
		dash := externallySharedExport()
		resolveConstantExportInputs(dash)

		panel := dash["panels"].([]interface{})[0].(map[string]interface{})
		require.Equal(t, "${DS_PROMETHEUS}", panel["datasource"].(map[string]interface{})["uid"])
	})

	t.Run("no-op without __inputs", func(t *testing.T) {
		dash := map[string]interface{}{
			"query": "${VAR_SPEED}",
		}
		resolveConstantExportInputs(dash)
		require.Equal(t, "${VAR_SPEED}", dash["query"])
	})

	t.Run("ignores constant inputs without a string value", func(t *testing.T) {
		dash := map[string]interface{}{
			"__inputs": []interface{}{
				map[string]interface{}{"name": "VAR_SPEED", "type": "constant"},
			},
			"query": "${VAR_SPEED}",
		}
		resolveConstantExportInputs(dash)
		require.Equal(t, "${VAR_SPEED}", dash["query"])
	})

	t.Run("substitutes multiple occurrences within one string", func(t *testing.T) {
		dash := map[string]interface{}{
			"__inputs": []interface{}{
				map[string]interface{}{"name": "VAR_SPEED", "type": "constant", "value": "100"},
			},
			"description": "from ${VAR_SPEED} to ${VAR_SPEED}",
		}
		resolveConstantExportInputs(dash)
		require.Equal(t, "from 100 to 100", dash["description"])
	})
}

func externallySharedV0Dashboard() *dashv0.Dashboard {
	return &dashv0.Dashboard{
		ObjectMeta: metav1.ObjectMeta{
			Namespace: "default",
			Name:      "speed-tf",
		},
		Spec: common.Unstructured{Object: externallySharedExport()},
	}
}

func TestV0ToV1ResolvesConstantExportInputs(t *testing.T) {
	scheme := newTestScheme(t)

	t.Run("v0 to v1 resolves constant and drops __inputs", func(t *testing.T) {
		target := &dashv1.Dashboard{}
		require.NoError(t, scheme.Convert(externallySharedV0Dashboard(), target, nil))

		variable := target.Spec.Object["templating"].(map[string]interface{})["list"].([]interface{})[0].(map[string]interface{})
		require.Equal(t, "100", variable["query"], "constant placeholder should be resolved before migration drops __inputs")

		_, hasInputs := target.Spec.Object["__inputs"]
		require.False(t, hasInputs, "__inputs should be removed by schema migration")
	})

	t.Run("v0 to v2 carries the resolved constant inline", func(t *testing.T) {
		target := &dashv2beta1.Dashboard{}
		require.NoError(t, scheme.Convert(externallySharedV0Dashboard(), target, nil))

		found := false
		for _, v := range target.Spec.Variables {
			if v.ConstantVariableKind != nil && v.ConstantVariableKind.Spec.Name == "speed" {
				require.Equal(t, "100", v.ConstantVariableKind.Spec.Query)
				require.Equal(t, "100", *v.ConstantVariableKind.Spec.Current.Value.String)
				found = true
			}
		}
		require.True(t, found, "expected the constant variable to survive conversion to v2")
	})
}
