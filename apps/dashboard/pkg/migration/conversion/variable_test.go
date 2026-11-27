package conversion

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	dashv2 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2"
	dashv2beta1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2beta1"
)

// variableSpecFixtures sets every field of each variable kind so a field that
// the conversion drops shows up as a JSON difference.
var variableSpecFixtures = map[string]string{
	"QueryVariable": `{
		"kind": "QueryVariable",
		"spec": {
			"name": "service",
			"current": {"selected": true, "text": ["a", "b"], "value": ["a", "b"], "properties": {"env": "prod"}},
			"label": "Service",
			"hide": "hideLabel",
			"refresh": "onTimeRangeChanged",
			"skipUrlSync": true,
			"description": "Services in the cluster",
			"query": {
				"kind": "DataQuery",
				"group": "prometheus",
				"version": "v0",
				"labels": {"team": "dashboards"},
				"datasource": {"name": "prom-uid"},
				"spec": {"expr": "label_values(up, service)", "refId": "A"}
			},
			"regex": "/(.*)/",
			"regexApplyTo": "text",
			"sort": "naturalDesc",
			"definition": "label_values(up, service)",
			"options": [{"text": "a", "value": "a"}, {"text": "b", "value": "b"}],
			"multi": true,
			"includeAll": true,
			"allValue": ".*",
			"placeholder": "Pick a service",
			"allowCustomValue": false,
			"staticOptions": [{"text": "static", "value": "static"}],
			"staticOptionsOrder": "after",
			"origin": {"type": "datasource", "group": "prometheus"}
		}
	}`,
	"TextVariable": `{
		"kind": "TextVariable",
		"spec": {
			"name": "filter",
			"current": {"text": "x", "value": "x"},
			"query": "x",
			"label": "Filter",
			"hide": "dontHide",
			"skipUrlSync": false,
			"description": "Free text",
			"origin": {"type": "datasource", "group": "loki"}
		}
	}`,
	"ConstantVariable": `{
		"kind": "ConstantVariable",
		"spec": {
			"name": "region",
			"query": "eu-west-1",
			"current": {"text": "eu-west-1", "value": "eu-west-1"},
			"label": "Region",
			"hide": "hideVariable",
			"skipUrlSync": true,
			"description": "Deployment region"
		}
	}`,
	"DatasourceVariable": `{
		"kind": "DatasourceVariable",
		"spec": {
			"name": "ds",
			"pluginId": "prometheus",
			"refresh": "onDashboardLoad",
			"regex": "prod-.*",
			"current": {"text": "prod-1", "value": "prod-1-uid"},
			"options": [{"text": "prod-1", "value": "prod-1-uid"}],
			"multi": false,
			"includeAll": true,
			"allValue": "*",
			"label": "Data source",
			"hide": "inControlsMenu",
			"skipUrlSync": false,
			"description": "Prometheus instance",
			"allowCustomValue": true
		}
	}`,
	"IntervalVariable": `{
		"kind": "IntervalVariable",
		"spec": {
			"name": "interval",
			"query": "1m,5m,1h",
			"current": {"text": "5m", "value": "5m"},
			"options": [{"text": "1m", "value": "1m"}, {"text": "5m", "value": "5m", "selected": true}],
			"auto": true,
			"auto_min": "10s",
			"auto_count": 30,
			"refresh": "onTimeRangeChanged",
			"label": "Interval",
			"hide": "dontHide",
			"skipUrlSync": false,
			"description": "Step"
		}
	}`,
	"CustomVariable": `{
		"kind": "CustomVariable",
		"spec": {
			"name": "env",
			"query": "dev,prod",
			"current": {"text": "prod", "value": "prod"},
			"options": [{"text": "dev", "value": "dev"}, {"text": "prod", "value": "prod"}],
			"multi": true,
			"includeAll": false,
			"allValue": "all",
			"label": "Environment",
			"hide": "dontHide",
			"skipUrlSync": false,
			"description": "Target environment",
			"allowCustomValue": false,
			"valuesFormat": "json"
		}
	}`,
	"GroupByVariable": `{
		"kind": "GroupByVariable",
		"group": "prometheus",
		"labels": {"team": "dashboards"},
		"datasource": {"name": "prom-uid"},
		"spec": {
			"name": "groupBy",
			"defaultValue": {"text": "job", "value": "job"},
			"current": {"text": ["job"], "value": ["job"]},
			"options": [{"text": "job", "value": "job"}],
			"multi": true,
			"label": "Group by",
			"hide": "dontHide",
			"skipUrlSync": false,
			"description": "Grouping"
		}
	}`,
	"AdhocVariable": `{
		"kind": "AdhocVariable",
		"group": "loki",
		"labels": {"team": "dashboards"},
		"datasource": {"name": "loki-uid"},
		"spec": {
			"name": "filters",
			"baseFilters": [{"key": "cluster", "operator": "=", "value": "a", "origin": "dashboard"}],
			"filters": [{"key": "app", "operator": "=~", "value": "x|y", "values": ["x", "y"], "keyLabel": "App", "valueLabels": ["X", "Y"], "forceEdit": true, "condition": "AND"}],
			"defaultKeys": [{"text": "app", "value": "app", "group": "labels", "expandable": true}, {"text": "code", "value": 200}],
			"label": "Filters",
			"hide": "dontHide",
			"skipUrlSync": false,
			"description": "Ad hoc filters",
			"allowCustomValue": true,
			"enableGroupBy": true
		}
	}`,
	"SwitchVariable": `{
		"kind": "SwitchVariable",
		"spec": {
			"name": "debug",
			"current": "true",
			"enabledValue": "on",
			"disabledValue": "off",
			"label": "Debug",
			"hide": "dontHide",
			"skipUrlSync": true,
			"description": "Debug mode"
		}
	}`,
}

func testVariableObjectMeta() metav1.ObjectMeta {
	return metav1.ObjectMeta{
		Name:            "service--folder-1",
		Namespace:       "org-1",
		UID:             "variable-uid",
		ResourceVersion: "42",
		Generation:      3,
		Labels:          map[string]string{"grafana.app/folder": "folder-1"},
		Annotations:     map[string]string{"grafana.app/folder": "folder-1"},
	}
}

func TestVariableConversionRoundTrip(t *testing.T) {
	scheme := newTestScheme(t)

	for kind, fixture := range variableSpecFixtures {
		t.Run(kind, func(t *testing.T) {
			in := &dashv2beta1.Variable{
				TypeMeta:   metav1.TypeMeta{APIVersion: dashv2beta1.APIVERSION, Kind: "Variable"},
				ObjectMeta: testVariableObjectMeta(),
			}
			require.NoError(t, json.Unmarshal([]byte(fixture), &in.Spec))

			v2 := &dashv2.Variable{}
			require.NoError(t, scheme.Convert(in, v2, nil))

			assert.Equal(t, dashv2.APIVERSION, v2.APIVersion)
			assert.Equal(t, "Variable", v2.Kind)
			assert.Equal(t, testVariableObjectMeta(), v2.ObjectMeta)
			v2Spec, err := json.Marshal(v2.Spec)
			require.NoError(t, err)
			assert.JSONEq(t, fixture, string(v2Spec))

			back := &dashv2beta1.Variable{}
			require.NoError(t, scheme.Convert(v2, back, nil))

			assert.Equal(t, dashv2beta1.APIVERSION, back.APIVersion)
			assert.Equal(t, in.ObjectMeta, back.ObjectMeta)
			assert.Equal(t, in.Spec, back.Spec)
		})
	}
}

func TestVariableConversionDoesNotShareMetadata(t *testing.T) {
	in := &dashv2beta1.Variable{ObjectMeta: testVariableObjectMeta()}
	out := &dashv2.Variable{}
	require.NoError(t, Convert_Variable_V2beta1_to_V2(in, out, nil))

	out.Labels["grafana.app/folder"] = "other"
	assert.Equal(t, "folder-1", in.Labels["grafana.app/folder"])
}

func TestVariableConversionEmptySpec(t *testing.T) {
	out := &dashv2.Variable{}
	require.NoError(t, Convert_Variable_V2beta1_to_V2(&dashv2beta1.Variable{}, out, nil))
	assert.Equal(t, dashv2.VariableSpec{}, out.Spec)

	back := &dashv2beta1.Variable{}
	require.NoError(t, Convert_Variable_V2_to_V2beta1(out, back, nil))
	assert.Equal(t, dashv2beta1.VariableSpec{}, back.Spec)
}
