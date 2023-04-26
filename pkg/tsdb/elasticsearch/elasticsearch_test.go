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
