package ml

import (
	"testing"
	"time"

	jsoniter "github.com/json-iterator/go"
	"github.com/stretchr/testify/require"
)

func TestUnmarshalCommand(t *testing.T) {
	appURL := "https://grafana.com"

	getData := func(cmd string) map[string]interface{} {
		var d map[string]interface{}
		require.NoError(t, json.UnmarshalFromString(cmd, &d))
		return d
	}
	t.Run("should parse outlier command", func(t *testing.T) {
		q := getData(outlierQuery)
		cfg, err := json.Marshal(q["config"])
		require.NoError(t, err)
		cmd, err := UnmarshalCommand(q, appURL)
		require.NoError(t, err)
		require.IsType(t, &OutlierCommand{}, cmd)
		outlier := cmd.(*OutlierCommand)
		require.Equal(t, 1234*time.Millisecond, outlier.interval)
		require.Equal(t, appURL, outlier.appURL)
		require.Equal(t, "a4ce599c-4c93-44b9-be5b-76385b8c01be", outlier.datasourceUID)
		require.Equal(t, jsoniter.RawMessage(cfg), outlier.query)
	})
	t.Run("should fallback to default if 'intervalMs' is not specified", func(t *testing.T) {
		q := getData(outlierQuery)
		delete(q, "intervalMs")
		cmd, err := UnmarshalCommand(q, appURL)
		require.NoError(t, err)
		outlier := cmd.(*OutlierCommand)
		require.Equal(t, defaultInterval, outlier.interval)
	})
	t.Run("fails when", func(t *testing.T) {
		testCases := []struct {
			name  string
			query func() map[string]interface{}
			err   string
		}{
			{
				name: "field 'type' is missing",
				query: func() map[string]interface{} {
					cmd := getData(outlierQuery)
					delete(cmd, "type")
					return cmd
				},
				err: "field 'type' is required and should be string",
			},
			{
				name: "field 'type' is not known",
				query: func() map[string]interface{} {
					cmd := getData(outlierQuery)
					cmd["type"] = "test"
					return cmd
				},
				err: "unsupported command type 'test'. Supported only 'outlier'",
			},
			{
				name: "field 'type' is not string",
				query: func() map[string]interface{} {
					cmd := getData(outlierQuery)
					cmd["type"] = map[string]interface{}{
						"data": 1,
					}
					return cmd
				},
				err: "field 'type' is required and should be string",
			},
			{
				name: "field 'config' is missing",
				query: func() map[string]interface{} {
					cmd := getData(outlierQuery)
					delete(cmd, "config")
					return cmd
				},
				err: "field `config` is required and should be object",
			},
			{
				name: "field 'config' is not object",
				query: func() map[string]interface{} {
					cmd := getData(outlierQuery)
					cmd["config"] = "test"
					return cmd
				},
				err: "field `config` is required and should be object",
			},
			{
				name: "field 'intervalMs' is not number",
				query: func() map[string]interface{} {
					cmd := getData(outlierQuery)
					cmd["intervalMs"] = "test"
					return cmd
				},
				err: "field `intervalMs` is expected to be a number",
			},
			{
				name: "field 'config.datasource_uid' is not specified",
				query: func() map[string]interface{} {
					cmd := getData(outlierQuery)
					cfg := cmd["config"].(map[string]interface{})
					delete(cfg, "datasource_uid")
					return cmd
				},
				err: "field `config.datasource_uid` is required and should be string",
			},
		}

		for _, testCase := range testCases {
			t.Run(testCase.name, func(t *testing.T) {
				_, err := UnmarshalCommand(testCase.query(), appURL)
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
