package elasticsearch

import (
	"encoding/json"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/httpclient"
)

type datasourceInfo struct {
	TimeField                  interface{} `json:"timeField"`
	MaxConcurrentShardRequests int64       `json:"maxConcurrentShardRequests"`
	Interval                   string      `json:"interval"`
	TimeInterval               string      `json:"timeInterval"`
}

func TestCoerceVersion(t *testing.T) {
	t.Run("version is string", func(t *testing.T) {
		ver := "7.0.0"
		smvr, err := coerceVersion(ver)
		require.NoError(t, err)
		require.NotNil(t, smvr)
		require.Equal(t, "7.0.0", smvr.String())
	})

	t.Run("version is int", func(t *testing.T) {
		testCases := []struct {
			intVersion    float64
			stringVersion string
		}{
			{intVersion: 2, stringVersion: "2.0.0"},
			{intVersion: 5, stringVersion: "5.0.0"},
			{intVersion: 56, stringVersion: "5.6.0"},
			{intVersion: 60, stringVersion: "6.0.0"},
			{intVersion: 70, stringVersion: "7.0.0"},
		}

		for _, tc := range testCases {
			smvr, err := coerceVersion(tc.intVersion)
			require.NoError(t, err)
			require.Equal(t, tc.stringVersion, smvr.String())
		}

		smvr, err := coerceVersion(12345)
		require.Error(t, err)
		require.Nil(t, smvr)
	})
}

func TestNewInstanceSettings(t *testing.T) {
	t.Run("fields exist", func(t *testing.T) {
		dsInfo := datasourceInfo{
			TimeField:                  "@timestamp",
			MaxConcurrentShardRequests: 5,
		}
		settingsJSON, err := json.Marshal(dsInfo)
		require.NoError(t, err)

		dsSettings := backend.DataSourceInstanceSettings{
			JSONData: json.RawMessage(settingsJSON),
		}

		_, err = newInstanceSettings(httpclient.NewProvider())(dsSettings)
		require.NoError(t, err)
	})

	t.Run("timeField", func(t *testing.T) {
		t.Run("is nil", func(t *testing.T) {
			dsInfo := datasourceInfo{
				MaxConcurrentShardRequests: 5,
				Interval:                   "Daily",
				TimeInterval:               "TimeInterval",
			}

			settingsJSON, err := json.Marshal(dsInfo)
			require.NoError(t, err)

			dsSettings := backend.DataSourceInstanceSettings{
				JSONData: json.RawMessage(settingsJSON),
			}

			_, err = newInstanceSettings(httpclient.NewProvider())(dsSettings)
			require.EqualError(t, err, "timeField cannot be cast to string")
		})

		t.Run("is empty", func(t *testing.T) {
			dsInfo := datasourceInfo{
				MaxConcurrentShardRequests: 5,
				Interval:                   "Daily",
				TimeField:                  "",
				TimeInterval:               "TimeInterval",
			}

			settingsJSON, err := json.Marshal(dsInfo)
			require.NoError(t, err)

			dsSettings := backend.DataSourceInstanceSettings{
				JSONData: json.RawMessage(settingsJSON),
			}

			_, err = newInstanceSettings(httpclient.NewProvider())(dsSettings)
			require.EqualError(t, err, "elasticsearch time field name is required")
		})
	})
}
