package expr

import (
	"encoding/json"
	"reflect"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/data/utils/jsoniter"
	data "github.com/grafana/grafana-plugin-sdk-go/experimental/apis/data/v0alpha1"
	"github.com/grafana/grafana/pkg/expr/mathexp"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/stretchr/testify/require"
)

func TestReaderReduceMode(t *testing.T) {
	testData := []struct {
		name        string
		bytes       []byte
		expectError bool
		hasMapper   bool
		mapperType  reflect.Type
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
			expectError: false,
			hasMapper:   false,
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
			expectError: false,
			hasMapper:   true,
			mapperType:  reflect.TypeOf(mathexp.DropNonNumber{}),
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
			expectError: false,
			hasMapper:   true,
			mapperType:  reflect.TypeOf(mathexp.ReplaceNonNumberWithValue{}),
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
			expectError: false,
			hasMapper:   false,
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
			expectError: true,
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

			eq, err := reader.ReadQuery(t.Context(), q, iter)

			if test.expectError {
				require.Error(t, err)
			} else {
				require.NoError(t, err)
				rc, ok := eq.Command.(*ReduceCommand)
				require.True(t, ok)

				if test.hasMapper {
					require.NotNil(t, rc.seriesMapper)
					require.Equal(t, test.mapperType, reflect.TypeOf(rc.seriesMapper))
				} else {
					require.Nil(t, rc.seriesMapper)
				}
			}
		})
	}
}
