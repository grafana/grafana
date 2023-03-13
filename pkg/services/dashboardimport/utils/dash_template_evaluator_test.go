package utils

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/services/dashboardimport"
)

func TestDashTemplateEvaluator(t *testing.T) {
	template, err := simplejson.NewJson([]byte(`{
		"__inputs": [
			{
				"name": "DS_NAME",
				"type": "datasource"
			}
		],
		"test": {
			"prop": "${DS_NAME}_${DS_NAME}"
		}
	}`))
	require.NoError(t, err)

	evaluator := &DashTemplateEvaluator{
		template: template,
		inputs: []dashboardimport.ImportDashboardInput{
			{Name: "*", Type: "datasource", Value: "my-server"},
		},
	}

	res, err := evaluator.Eval()
	require.NoError(t, err)

	require.Equal(t, "my-server_my-server", res.GetPath("test", "prop").MustString())

	inputs := res.Get("__inputs")
	require.Nil(t, inputs.Interface())
}
