package writer

import (
	"context"
	"testing"
	"time"

	"github.com/benbjohnson/clock"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/httpclient"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/datasources"
	dsfakes "github.com/grafana/grafana/pkg/services/datasources/fakes"
	"github.com/grafana/grafana/pkg/services/ngalert/metrics"
)

type testDataSources struct {
	dsfakes.FakeDataSourceService

	prom1, prom2 *TestRemoteWriteTarget
}

func (t *testDataSources) Reset() {
	t.prom1.Reset()
	t.prom2.Reset()
}

func setupDataSources(t *testing.T) *testDataSources {
	res := &testDataSources{
		prom1: NewTestRemoteWriteTarget(t),
		prom2: NewTestRemoteWriteTarget(t),
	}

	t.Cleanup(func() {
		res.prom1.Close()
	})
	t.Cleanup(func() {
		res.prom2.Close()
	})

	p1, _ := res.AddDataSource(context.Background(), &datasources.AddDataSourceCommand{
		UID:      "prom-1",
		Type:     datasources.DS_PROMETHEUS,
		JsonData: simplejson.MustJson([]byte(`{"prometheusType":"Prometheus"}`)),
	})
	p1.URL = res.prom1.srv.URL
	res.prom1.ExpectedPath = "/api/v1/write"

	p2, _ := res.AddDataSource(context.Background(), &datasources.AddDataSourceCommand{
		UID:      "prom-2",
		Type:     datasources.DS_PROMETHEUS,
		JsonData: simplejson.MustJson([]byte(`{"prometheusType":"Mimir"}`)),
	})
	p2.URL = res.prom2.srv.URL + "/api/prom"
	res.prom2.ExpectedPath = "/api/prom/push"

	// Add a non-Prometheus datasource.
	_, _ = res.AddDataSource(context.Background(), &datasources.AddDataSourceCommand{
		UID:  "loki-1",
		Type: datasources.DS_LOKI,
	})

	return res
}

func TestDatasourceWriter(t *testing.T) {
	series := []map[string]string{{"foo": "1"}, {"foo": "2"}, {"foo": "3"}, {"foo": "4"}}
	frames := frameGenFromLabels(t, data.FrameTypeNumericWide, series)

	datasources := setupDataSources(t)

	cfg := DatasourceWriterConfig{
		Timeout:              time.Second * 5,
		DefaultDatasourceUID: "prom-2",
	}

	met := metrics.NewRemoteWriterMetrics(prometheus.NewRegistry())
	writer := NewDatasourceWriter(cfg, datasources, httpclient.NewProvider(), clock.New(), log.New("test"), met)

	t.Run("when writing a prometheus datasource then the request is made to the expected endpoint", func(t *testing.T) {
		datasources.Reset()

		err := writer.WriteDatasource(context.Background(), "prom-1", "metric", time.Now(), frames, 1, map[string]string{})
		require.NoError(t, err)

		assert.Equal(t, 1, datasources.prom1.RequestsCount)
		assert.Equal(t, 0, datasources.prom2.RequestsCount)

		err = writer.WriteDatasource(context.Background(), "prom-2", "metric", time.Now(), frames, 1, map[string]string{})
		require.NoError(t, err)

		assert.Equal(t, 1, datasources.prom1.RequestsCount)
		assert.Equal(t, 1, datasources.prom2.RequestsCount)
	})

	t.Run("when writing an unknown datasource then an error is returned", func(t *testing.T) {
		datasources.Reset()

		err := writer.WriteDatasource(context.Background(), "prom-3", "metric", time.Now(), frames, 1, map[string]string{})
		require.Error(t, err)
		require.EqualError(t, err, "data source not found")
	})

	t.Run("when writing a non-prometheus datasource then an error is returned", func(t *testing.T) {
		datasources.Reset()

		err := writer.WriteDatasource(context.Background(), "loki-1", "metric", time.Now(), frames, 1, map[string]string{})
		require.Error(t, err)
		require.EqualError(t, err, "can only write to data sources of type prometheus")
	})

	t.Run("when writing with an empty datasource uid then the default is written", func(t *testing.T) {
		datasources.Reset()

		err := writer.WriteDatasource(context.Background(), "", "metric", time.Now(), frames, 1, map[string]string{})
		require.NoError(t, err)
	})
}

func TestDatasourceWriterGetRemoteWriteURL(t *testing.T) {
	tc := []struct {
		name string
		ds   datasources.DataSource
		url  string
	}{
		{
			"prometheus",
			datasources.DataSource{
				JsonData: simplejson.MustJson([]byte(`{"prometheusType":"Prometheus"}`)),
				URL:      "http://example.com",
			},
			"http://example.com/api/v1/write",
		},
		{
			"prometheus with prefix",
			datasources.DataSource{
				JsonData: simplejson.MustJson([]byte(`{"prometheusType":"Prometheus"}`)),
				URL:      "http://example.com/myprom",
			},
			"http://example.com/myprom/api/v1/write",
		},
		{
			"mimir/cortex legacy routes",
			datasources.DataSource{
				JsonData: simplejson.MustJson([]byte(`{"prometheusType":"Anything"}`)),
				URL:      "http://example.com/api/prom",
			},
			"http://example.com/api/prom/push",
		},
		{
			"mimir/cortex legacy routes with prefix",
			datasources.DataSource{
				JsonData: simplejson.MustJson([]byte(`{"prometheusType":"Anything"}`)),
				URL:      "http://example.com/myprom/api/prom",
			},
			"http://example.com/myprom/api/prom/push",
		},
		{
			"mimir/cortex new routes",
			datasources.DataSource{
				JsonData: simplejson.MustJson([]byte(`{"prometheusType":"Anything"}`)),
				URL:      "http://example.com/prometheus",
			},
			"http://example.com/api/v1/push",
		},
		{
			"mimir/cortex new routes with prefix",
			datasources.DataSource{
				JsonData: simplejson.MustJson([]byte(`{"prometheusType":"Anything"}`)),
				URL:      "http://example.com/mymimir/prometheus",
			},
			"http://example.com/mymimir/api/v1/push",
		},
		{
			"mimir/cortex with unknown suffix",
			datasources.DataSource{
				JsonData: simplejson.MustJson([]byte(`{"prometheusType":"Anything"}`)),
				URL:      "http://example.com/foo/bar",
			},
			"http://example.com/api/v1/push",
		},
	}

	for _, tt := range tc {
		t.Run(tt.name, func(t *testing.T) {
			res, err := getRemoteWriteURL(&tt.ds)
			require.NoError(t, err)
			require.Equal(t, tt.url, res.String())
		})
	}
}
