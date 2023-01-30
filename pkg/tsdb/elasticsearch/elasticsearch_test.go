package elasticsearch

import (
	"encoding/json"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/httpclient"
)

type datasourceInfo struct {
	ESVersion                  interface{} `json:"esVersion"`
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
			ESVersion:                  "7.0.0",
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

	t.Run("esVersion", func(t *testing.T) {
		t.Run("correct version", func(t *testing.T) {
			dsInfo := datasourceInfo{
				ESVersion:                  5,
				TimeField:                  "@timestamp",
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
			require.NoError(t, err)
		})

		t.Run("faulty version int", func(t *testing.T) {
			dsInfo := datasourceInfo{
				ESVersion:                  1234,
				TimeField:                  "@timestamp",
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
			require.EqualError(t, err, "elasticsearch version is required, err=elasticsearch version=1234 is not supported")
		})

		t.Run("faulty version string", func(t *testing.T) {
			dsInfo := datasourceInfo{
				ESVersion:                  "NOT_VALID",
				TimeField:                  "@timestamp",
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
			require.EqualError(t, err, "elasticsearch version is required, err=Invalid Semantic Version")
		})

		t.Run("no version", func(t *testing.T) {
			dsInfo := datasourceInfo{
				TimeField:                  "@timestamp",
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
			require.EqualError(t, err, "elasticsearch version is required, err=elasticsearch version <nil>, cannot be cast to int")
		})
	})

	t.Run("timeField", func(t *testing.T) {
		t.Run("is nil", func(t *testing.T) {
			dsInfo := datasourceInfo{
				ESVersion:                  2,
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
				ESVersion:                  2,
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
