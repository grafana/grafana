package ml

import (
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
)

func TestUnmarshalCommand(t *testing.T) {
	appURL := "https://grafana.com"

	updateJson := func(cmd string, f func(m map[string]interface{})) func(t *testing.T) []byte {
		return func(t *testing.T) []byte {
			var d map[string]interface{}
			require.NoError(t, json.UnmarshalFromString(cmd, &d))
			f(d)
			data, err := json.Marshal(d)
			require.NoError(t, err)
			return data
		}
	}
	t.Run("should parse outlier command", func(t *testing.T) {
		cmd, err := UnmarshalCommand([]byte(outlierQuery), appURL)
		require.NoError(t, err)
		require.IsType(t, &OutlierCommand{}, cmd)
		outlier := cmd.(*OutlierCommand)
		require.Equal(t, 1234*time.Millisecond, outlier.interval)
		require.Equal(t, appURL, outlier.appURL)
		require.Equal(t, OutlierCommandConfiguration{
			DatasourceType: "prometheus",
			DatasourceUID:  "a4ce599c-4c93-44b9-be5b-76385b8c01be",
			QueryParams: map[string]interface{}{
				"expr":  "go_goroutines{}",
				"range": true,
				"refId": "A",
			},
			Algorithm: map[string]interface{}{
				"name": "dbscan",
				"config": map[string]interface{}{
					"epsilon": 7.667,
				},
				"sensitivity": 0.83,
			},
			ResponseType: "binary",
		}, outlier.config)
	})
	t.Run("should fallback to default if 'intervalMs' is not specified", func(t *testing.T) {
		data := updateJson(outlierQuery, func(m map[string]interface{}) {
			delete(m, "intervalMs")
		})(t)
		cmd, err := UnmarshalCommand(data, appURL)
		require.NoError(t, err)
		outlier := cmd.(*OutlierCommand)
		require.Equal(t, defaultInterval, outlier.interval)
	})
	t.Run("fails when", func(t *testing.T) {
		testCases := []struct {
			name   string
			config func(t *testing.T) []byte
			err    string
		}{
			{
				name: "field 'type' is missing",
				config: updateJson(outlierQuery, func(cmd map[string]interface{}) {
					delete(cmd, "type")
				}),
				err: "required field 'type' is not specified or empty.  Should be one of [outlier]",
			},
			{
				name: "field 'type' is not known",
				config: updateJson(outlierQuery, func(cmd map[string]interface{}) {
					cmd["type"] = uuid.NewString()
				}),
				err: "unsupported command type. Should be one of [outlier]",
			},
			{
				name: "field 'type' is not string",
				config: updateJson(outlierQuery, func(cmd map[string]interface{}) {
					cmd["type"] = map[string]interface{}{
						"data": 1,
					}
				}),
				err: "failed to unmarshall Machine learning command",
			},
			{
				name: "field 'config' is missing",
				config: updateJson(outlierQuery, func(cmd map[string]interface{}) {
					delete(cmd, "config")
				}),
				err: "required field 'config' is not specified",
			},
			{
				name: "field 'intervalMs' is not number",
				config: updateJson(outlierQuery, func(cmd map[string]interface{}) {
					cmd["intervalMs"] = "test"
				}),
				err: "failed to unmarshall Machine learning command",
			},
			{
				name: "field 'config.datasource_uid' is not specified",
				config: updateJson(outlierQuery, func(cmd map[string]interface{}) {
					cfg := cmd["config"].(map[string]interface{})
					delete(cfg, "datasource_uid")
				}),
				err: "required field `config.datasource_uid` is not specified",
			},
			{
				name: "field 'config.algorithm' is not specified",
				config: updateJson(outlierQuery, func(cmd map[string]interface{}) {
					cfg := cmd["config"].(map[string]interface{})
					delete(cfg, "algorithm")
				}),
				err: "required field `config.algorithm` is not specified",
			},
			{
				name: "field 'config.response_type' is not specified",
				config: updateJson(outlierQuery, func(cmd map[string]interface{}) {
					cfg := cmd["config"].(map[string]interface{})
					delete(cfg, "response_type")
				}),
				err: "required field `config.response_type` is not specified",
			},
			{
				name: "fields 'config.query' and 'config.query_params' are not specified",
				config: updateJson(outlierQuery, func(cmd map[string]interface{}) {
					cfg := cmd["config"].(map[string]interface{})
					delete(cfg, "query")
					delete(cfg, "query_params")
				}),
				err: "neither of required fields `config.query_params` or `config.query` are specified",
			},
		}

		for _, testCase := range testCases {
			t.Run(testCase.name, func(t *testing.T) {
				_, err := UnmarshalCommand(testCase.config(t), appURL)
				require.ErrorContains(t, err, testCase.err)
			})
		}
	})
}

const outlierQuery = `
{
	"type": "outlier",
	"intervalMs": 1234,
	"config": {
		"datasource_uid": "a4ce599c-4c93-44b9-be5b-76385b8c01be",
		"datasource_type": "prometheus",
		"query_params": {
			"expr": "go_goroutines{}",
			"range": true,
			"refId": "A"
		},
		"response_type": "binary",
		"algorithm": {
			"name": "dbscan",
			"config": {
				"epsilon": 7.667
			},
			"sensitivity": 0.83
		}
	}
}
`
