package writer

import (
	"context"
	"net/http"
	"testing"
	"time"

	"github.com/benbjohnson/clock"
	sdkhttpclient "github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/httpclient"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/datasources"
	dsfakes "github.com/grafana/grafana/pkg/services/datasources/fakes"
	"github.com/grafana/grafana/pkg/services/ngalert/metrics"
)

type mockHTTPClientProvider struct {
	client      *http.Client
	lastOptions *sdkhttpclient.Options
	callCount   int
}

type mockPluginContextProvider struct{}

func (m *mockPluginContextProvider) GetWithDataSource(ctx context.Context, pluginID string, user identity.Requester, ds *datasources.DataSource) (backend.PluginContext, error) {
	return backend.PluginContext{}, nil
}

func newMockHTTPClientProvider() *mockHTTPClientProvider {
	return &mockHTTPClientProvider{
		client: &http.Client{},
	}
}

func (m *mockHTTPClientProvider) New(options ...sdkhttpclient.Options) (*http.Client, error) {
	m.callCount++
	if len(options) > 0 {
		opt := options[0]
		m.lastOptions = &opt
	}
	return m.client, nil
}

type testDataSources struct {
	dsfakes.FakeDataSourceService

	prom1, prom2, prom3 *TestRemoteWriteTarget
}

func (t *testDataSources) Reset() {
	t.prom1.Reset()
	t.prom2.Reset()
	t.prom3.Reset()
}

func setupDataSources(t *testing.T) *testDataSources {
	res := &testDataSources{
		prom1: NewTestRemoteWriteTarget(t),
		prom2: NewTestRemoteWriteTarget(t),
		prom3: NewTestRemoteWriteTarget(t),
	}

	t.Cleanup(func() {
		res.prom1.Close()
	})
	t.Cleanup(func() {
		res.prom2.Close()
	})
	t.Cleanup(func() {
		res.prom3.Close()
	})

	p1, _ := res.AddDataSource(context.Background(), &datasources.AddDataSourceCommand{
		Name:     "prom-1",
		UID:      "prom-1",
		Type:     datasources.DS_PROMETHEUS,
		JsonData: simplejson.MustJson([]byte(`{"prometheusType":"Prometheus"}`)),
	})
	p1.URL = res.prom1.srv.URL
	res.prom1.ExpectedPath = "/api/v1/write"

	p2, _ := res.AddDataSource(context.Background(), &datasources.AddDataSourceCommand{
		Name:     "prom-2",
		UID:      "prom-2",
		Type:     datasources.DS_PROMETHEUS,
		JsonData: simplejson.MustJson([]byte(`{"prometheusType":"Mimir"}`)),
	})
	p2.URL = res.prom2.srv.URL + "/api/prom"
	res.prom2.ExpectedPath = "/api/prom/push"

	// Add a non-Prometheus datasource.
	_, _ = res.AddDataSource(context.Background(), &datasources.AddDataSourceCommand{
		Name: "loki-1",
		UID:  "loki-1",
		Type: datasources.DS_LOKI,
	})

	// Add a third Prometheus datasource that uses PDC
	p3, _ := res.AddDataSource(context.Background(), &datasources.AddDataSourceCommand{
		Name: "prom-3",
		UID:  "prom-3",
		Type: datasources.DS_PROMETHEUS,
		JsonData: simplejson.MustJson([]byte(`{
			"prometheusType": "Prometheus",
			"enableSecureSocksProxy": true,
			"secureSocksProxyUsername": "testuser"
		}`)),
	})
	p3.URL = res.prom3.srv.URL
	res.prom3.ExpectedPath = "/api/v1/write"

	require.True(t, p3.IsSecureSocksDSProxyEnabled())

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
	pluginContextProvider := &mockPluginContextProvider{}
	writer := NewDatasourceWriter(cfg, datasources, httpclient.NewProvider(), pluginContextProvider, clock.New(), log.New("test"), met)

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

		err := writer.WriteDatasource(context.Background(), "prom-unknown", "metric", time.Now(), frames, 1, map[string]string{})
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

	t.Run("when custom headers are configured, they are passed to the request", func(t *testing.T) {
		datasources.Reset()

		header1 := "X-Custom-Header"
		header2 := "X-Another-Header"
		headers := map[string]string{
			header1: "test-value",
			header2: "another-value",
		}

		cfg = DatasourceWriterConfig{
			Timeout:              time.Second * 5,
			DefaultDatasourceUID: "prom-2",
			CustomHeaders:        headers,
		}
		writer = NewDatasourceWriter(cfg, datasources, httpclient.NewProvider(), pluginContextProvider, clock.New(), log.New("test"), met)

		err := writer.WriteDatasource(context.Background(), "prom-1", "metric", time.Now(), frames, 1, map[string]string{})
		require.NoError(t, err)

		assert.Equal(t, headers[header1], datasources.prom1.LastHeaders.Get(header1))
		assert.Equal(t, headers[header2], datasources.prom1.LastHeaders.Get(header2))
	})

	t.Run("when PDC is enabled proxy options are passed to HTTP client provider", func(t *testing.T) {
		datasources.Reset()

		mockProvider := newMockHTTPClientProvider()

		cfg := DatasourceWriterConfig{
			Timeout:              time.Second * 5,
			DefaultDatasourceUID: "prom-3",
		}

		met := metrics.NewRemoteWriterMetrics(prometheus.NewRegistry())
		writer := NewDatasourceWriter(cfg, datasources, mockProvider, &mockPluginContextProvider{}, clock.New(), log.New("test"), met)

		err := writer.WriteDatasource(context.Background(), "prom-3", "metric", time.Now(), frames, 1, map[string]string{})
		require.NoError(t, err)

		assert.Equal(t, 1, mockProvider.callCount)
		require.NotNil(t, mockProvider.lastOptions)

		// Verify that proxy options were configured
		require.NotNil(t, mockProvider.lastOptions.ProxyOptions)
		require.True(t, mockProvider.lastOptions.ProxyOptions.Enabled)
		require.Equal(t, "prom-3", mockProvider.lastOptions.ProxyOptions.DatasourceName)
		require.Equal(t, "prometheus", mockProvider.lastOptions.ProxyOptions.DatasourceType)
	})

	t.Run("when PDC is disabled proxy options are not set", func(t *testing.T) {
		datasources.Reset()

		mockProvider := newMockHTTPClientProvider()

		cfg := DatasourceWriterConfig{
			Timeout:              time.Second * 5,
			DefaultDatasourceUID: "prom-1",
		}

		met := metrics.NewRemoteWriterMetrics(prometheus.NewRegistry())
		writer := NewDatasourceWriter(cfg, datasources, mockProvider, &mockPluginContextProvider{}, clock.New(), log.New("test"), met)

		err := writer.WriteDatasource(context.Background(), "prom-1", "metric", time.Now(), frames, 1, map[string]string{})
		require.NoError(t, err)

		require.Equal(t, 1, mockProvider.callCount)
		require.NotNil(t, mockProvider.lastOptions)
		require.Nil(t, mockProvider.lastOptions.ProxyOptions)
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
