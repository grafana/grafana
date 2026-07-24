package dashboard

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apiserver/pkg/admission"

	dashv1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1"
	"github.com/grafana/grafana/apps/dashboard/pkg/migration"
	"github.com/grafana/grafana/apps/dashboard/pkg/migration/schemaversion"
	"github.com/grafana/grafana/apps/dashboard/pkg/migration/testutil"
	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
)

// externallySharedExport mirrors the shape produced by the classic
// "Export for sharing externally" flow for a dashboard with a constant
// variable (name: speed, value: 100) used by a text panel.
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
					"content": "value is ${speed}",
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
			"title": "plain",
			"templating": map[string]interface{}{
				"list": []interface{}{
					map[string]interface{}{"name": "speed", "type": "constant", "query": "${VAR_SPEED}"},
				},
			},
		}
		resolveConstantExportInputs(dash)

		variable := dash["templating"].(map[string]interface{})["list"].([]interface{})[0].(map[string]interface{})
		require.Equal(t, "${VAR_SPEED}", variable["query"])
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

func TestMutateResolvesConstantExportInputs(t *testing.T) {
	migration.Initialize(testutil.NewDataSourceProvider(testutil.StandardTestConfig), testutil.NewLibraryElementProvider(), migration.DefaultCacheTTL)

	obj := &dashv1.Dashboard{
		Spec: common.Unstructured{Object: externallySharedExport()},
	}

	b := &DashboardsAPIBuilder{}
	err := b.Mutate(context.Background(), admission.NewAttributesRecord(
		obj,
		nil,
		dashv1.DashboardResourceInfo.GroupVersionKind(),
		"",
		"test",
		dashv1.DashboardResourceInfo.GroupVersionResource(),
		"",
		admission.Create,
		&metav1.CreateOptions{FieldValidation: metav1.FieldValidationIgnore},
		false,
		nil,
	), nil)
	require.NoError(t, err)

	variable := obj.Spec.Object["templating"].(map[string]interface{})["list"].([]interface{})[0].(map[string]interface{})
	require.Equal(t, "100", variable["query"], "constant placeholder should be resolved from __inputs before migration drops them")

	_, hasInputs := obj.Spec.Object["__inputs"]
	require.False(t, hasInputs, "__inputs should be removed by schema migration")
}
