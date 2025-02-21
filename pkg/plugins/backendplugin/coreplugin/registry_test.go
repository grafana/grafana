package coreplugin

import (
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/plugins/log"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/require"
)

func TestNewPlugin(t *testing.T) {
	tcs := []struct {
		ID                  string
		ExpectedID          string
		ExpectedAlias       string
		ExpectedNotFoundErr bool
	}{
		{ID: AzureMonitor},
		{ID: CloudMonitoring},
		{ID: CloudWatch},
		{ID: Elasticsearch},
		{ID: Grafana, ExpectedNotFoundErr: true},
		{ID: Graphite},
		{ID: InfluxDB},
		{ID: Loki},
		{ID: MSSQL},
		{ID: MySQL},
		{ID: OpenTSDB},
		{ID: Parca},
		{ID: PostgreSQL},
		{ID: Prometheus},
		{ID: Pyroscope},
		{ID: Tempo},
		{ID: TestData, ExpectedAlias: TestDataAlias},
		{ID: TestDataAlias, ExpectedID: TestData, ExpectedAlias: TestDataAlias},
		{ID: Zipkin},
		{ID: Jaeger},
	}

	for _, tc := range tcs {
		t.Run(tc.ID, func(t *testing.T) {
			if tc.ExpectedID == "" {
				tc.ExpectedID = tc.ID
			}

			p, err := NewPlugin(tc.ID, setting.NewCfg(), httpclient.NewProvider(), tracing.InitializeTracerForTest(), featuremgmt.WithFeatures())
			if tc.ExpectedNotFoundErr {
				require.ErrorIs(t, err, ErrCorePluginNotFound)
				require.Nil(t, p)
			} else {
				require.NoError(t, err)
				require.NotNil(t, p)
				require.Equal(t, tc.ExpectedID, p.ID)
				if tc.ExpectedAlias != "" {
					require.Equal(t, tc.ExpectedAlias, p.AliasIDs[0])
				}
				c, exists := p.Client()
				require.True(t, exists)
				require.NotNil(t, c)
			}
		})
	}
}

func TestLogger(t *testing.T) {
	t.Run("logger.With should create a new logger", func(t *testing.T) {
		wrapper := &logWrapper{
			logger: log.New("test"),
		}
		newLogger := wrapper.With("key", "value")

		require.NotSame(t, newLogger.(*logWrapper).logger, wrapper.logger, "`With` should not return the same instance")
	})
}
