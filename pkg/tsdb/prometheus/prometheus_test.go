package prometheus

import (
	"context"
	"net/http"
	"testing"
	"time"

	sdkhttpclient "github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/httpclient"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	p "github.com/prometheus/common/model"
	"github.com/stretchr/testify/require"
)

func TestPrometheus(t *testing.T) {
	json, _ := simplejson.NewJson([]byte(`
		{ "customQueryParameters": "custom=par/am&second=f oo"}
	`))
	dsInfo := &models.DataSource{
		JsonData: json,
	}
	var capturedRequest *http.Request
	mw := sdkhttpclient.MiddlewareFunc(func(opts sdkhttpclient.Options, next http.RoundTripper) http.RoundTripper {
		return sdkhttpclient.RoundTripperFunc(func(req *http.Request) (*http.Response, error) {
			capturedRequest = req
			return &http.Response{StatusCode: http.StatusOK}, nil
		})
	})
	provider := httpclient.NewProvider(sdkhttpclient.ProviderOptions{
		Middlewares: []sdkhttpclient.Middleware{mw},
	})
	plug, err := New(provider)(dsInfo)
	require.NoError(t, err)
	executor := plug.(*PrometheusExecutor)

	t.Run("converting metric name", func(t *testing.T) {
		metric := map[p.LabelName]p.LabelValue{
			p.LabelName("app"):    p.LabelValue("backend"),
			p.LabelName("device"): p.LabelValue("mobile"),
		}

		query := &PrometheusQuery{
			LegendFormat: "legend {{app}} {{ device }} {{broken}}",
		}

		require.Equal(t, "legend backend mobile ", formatLegend(metric, query))
	})

	t.Run("build full series name", func(t *testing.T) {
		metric := map[p.LabelName]p.LabelValue{
			p.LabelName(p.MetricNameLabel): p.LabelValue("http_request_total"),
			p.LabelName("app"):             p.LabelValue("backend"),
			p.LabelName("device"):          p.LabelValue("mobile"),
		}

		query := &PrometheusQuery{
			LegendFormat: "",
		}

		require.Equal(t, `http_request_total{app="backend", device="mobile"}`, formatLegend(metric, query))
	})

	t.Run("parsing query model with step", func(t *testing.T) {
		query := queryContext(`{
			"expr": "go_goroutines",
			"format": "time_series",
			"refId": "A"
		}`)
		timerange := plugins.NewDataTimeRange("12h", "now")
		query.TimeRange = &timerange
		models, err := executor.parseQuery(dsInfo, query)
		require.NoError(t, err)
		require.Equal(t, time.Second*30, models[0].Step)
	})

	t.Run("parsing query model without step parameter", func(t *testing.T) {
		query := queryContext(`{
			"expr": "go_goroutines",
			"format": "time_series",
			"intervalFactor": 1,
			"refId": "A"
		}`)
		models, err := executor.parseQuery(dsInfo, query)
		require.NoError(t, err)
		require.Equal(t, time.Minute*2, models[0].Step)

		timeRange := plugins.NewDataTimeRange("1h", "now")
		query.TimeRange = &timeRange
		models, err = executor.parseQuery(dsInfo, query)
		require.NoError(t, err)
		require.Equal(t, time.Second*15, models[0].Step)
	})

	t.Run("parsing query model with high intervalFactor", func(t *testing.T) {
		models, err := executor.parseQuery(dsInfo, queryContext(`{
			"expr": "go_goroutines",
			"format": "time_series",
			"intervalFactor": 10,
			"refId": "A"
		}`))
		require.NoError(t, err)
		require.Equal(t, time.Minute*20, models[0].Step)
	})

	t.Run("parsing query model with low intervalFactor", func(t *testing.T) {
		models, err := executor.parseQuery(dsInfo, queryContext(`{
			"expr": "go_goroutines",
			"format": "time_series",
			"intervalFactor": 1,
			"refId": "A"
		}`))
		require.NoError(t, err)
		require.Equal(t, time.Minute*2, models[0].Step)
	})

	t.Run("runs query with custom params", func(t *testing.T) {
		query := queryContext(`{
			"expr": "go_goroutines",
			"format": "time_series",
			"intervalFactor": 1,
			"refId": "A"
		}`)
		_, _ = executor.DataQuery(context.Background(), dsInfo, query)
		require.NotNil(t, capturedRequest)
		require.Equal(t, "custom=par%2Fam&second=f+oo", capturedRequest.URL.RawQuery)
	})
}

func queryContext(json string) plugins.DataQuery {
	jsonModel, _ := simplejson.NewJson([]byte(json))
	queryModels := []plugins.DataSubQuery{
		{Model: jsonModel},
	}

	timeRange := plugins.NewDataTimeRange("48h", "now")
	return plugins.DataQuery{
		TimeRange: &timeRange,
		Queries:   queryModels,
	}
}

func TestParseResponse(t *testing.T) {
	t.Run("value is not of type matrix", func(t *testing.T) {
		//nolint: staticcheck // plugins.DataQueryResult deprecated
		queryRes := plugins.DataQueryResult{}
		value := p.Vector{}
		res, err := parseResponse(value, nil)

		require.Equal(t, queryRes, res)
		require.Error(t, err)
	})

	t.Run("response should be parsed normally", func(t *testing.T) {
		values := []p.SamplePair{
			{Value: 1, Timestamp: 1000},
			{Value: 2, Timestamp: 2000},
			{Value: 3, Timestamp: 3000},
			{Value: 4, Timestamp: 4000},
			{Value: 5, Timestamp: 5000},
		}
		value := p.Matrix{
			&p.SampleStream{
				Metric: p.Metric{"app": "Application", "tag2": "tag2"},
				Values: values,
			},
		}
		query := &PrometheusQuery{
			LegendFormat: "legend {{app}}",
		}
		res, err := parseResponse(value, query)
		require.NoError(t, err)

		decoded, _ := res.Dataframes.Decoded()
		require.Len(t, decoded, 1)
		require.Equal(t, decoded[0].Name, "legend Application")
		require.Len(t, decoded[0].Fields, 2)
		require.Len(t, decoded[0].Fields[0].Labels, 0)
		require.Equal(t, decoded[0].Fields[0].Name, "time")
		require.Len(t, decoded[0].Fields[1].Labels, 2)
		require.Equal(t, decoded[0].Fields[1].Labels.String(), "app=Application, tag2=tag2")
		require.Equal(t, decoded[0].Fields[1].Name, "value")
		require.Equal(t, decoded[0].Fields[1].Config.DisplayNameFromDS, "legend Application")

		// Ensure the timestamps are UTC zoned
		testValue := decoded[0].Fields[0].At(0)
		require.Equal(t, "UTC", testValue.(time.Time).Location().String())
	})
}
