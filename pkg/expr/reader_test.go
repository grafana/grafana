package expr

import (
	"encoding/json"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/data/utils/jsoniter"
	data "github.com/grafana/grafana-plugin-sdk-go/experimental/apis/data/v0alpha1"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/stretchr/testify/require"
)

func TestReaderReduceMode(t *testing.T) {
	testData := []struct {
		name          string
		bytes         []byte
		expectedError string
	}{
		{
			name: "no_settings",
			bytes: []byte(`
				{
					"refId": "B",
					"datasource": {
						"type": "__expr__",
						"uid": "__expr__"
					},
					"reducer": "last",
					"expression": "A",
					"window": "",
					"type": "reduce"
				}
			`),
			expectedError: "",
		},
		{
			name: "mode_dropnn",
			bytes: []byte(`
				{
					"refId": "B",
					"datasource": {
						"type": "__expr__",
						"uid": "__expr__"
					},
					"reducer": "last",
					"expression": "A",
					"window": "",
					"settings": {
						"mode": "dropNN"
					},
					"type": "reduce"
				}
			`),
			expectedError: "",
		},
		{
			name: "mode_replacenn",
			bytes: []byte(`
				{
					"refId": "B",
					"datasource": {
						"type": "__expr__",
						"uid": "__expr__"
					},
					"reducer": "last",
					"expression": "A",
					"window": "",
					"settings": {
						"mode": "replaceNN",
						"replaceWithValue": 42
					},
					"type": "reduce"
				}
			`),
			expectedError: "",
		},
		{
			name: "mode_strict",
			bytes: []byte(`
				{
					"refId": "B",
					"datasource": {
						"type": "__expr__",
						"uid": "__expr__"
					},
					"reducer": "last",
					"expression": "A",
					"window": "",
					"settings": {
						"mode": ""
					},
					"type": "reduce"
				}
			`),
			expectedError: "",
		},
		{
			name: "mode_invalid",
			bytes: []byte(`
				{
					"refId": "B",
					"datasource": {
						"type": "__expr__",
						"uid": "__expr__"
					},
					"reducer": "last",
					"expression": "A",
					"window": "",
					"settings": {
						"mode": "invalid-mode"
					},
					"type": "reduce"
				}
			`),
			expectedError: "unsupported reduce mode",
		},
	}

	for _, test := range testData {
		t.Run("TestReduceReader:"+test.name, func(t *testing.T) {
			var q data.DataQuery

			err := json.Unmarshal(test.bytes, &q)
			require.NoError(t, err)

			raw, err := json.Marshal(q)
			require.NoError(t, err)

			iter, err := jsoniter.ParseBytes(jsoniter.ConfigDefault, raw)
			require.NoError(t, err)

			reader := NewExpressionQueryReader(featuremgmt.WithFeatures())

			_, err = reader.ReadQuery(q, iter)

			if test.expectedError == "" {
				require.NoError(t, err)
			} else {
				require.ErrorContains(t, err, test.expectedError)
			}
		})
	}
}
