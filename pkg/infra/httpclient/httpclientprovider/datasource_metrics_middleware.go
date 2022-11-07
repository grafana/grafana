package httpclientprovider

import (
	"net/http"

	sdkhttpclient "github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/grafana/grafana/pkg/infra/httpclient"
	"github.com/grafana/grafana/pkg/infra/metrics/metricutil"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

var (
	datasourceRequestCounter = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Namespace: "grafana",
			Name:      "datasource_request_total",
			Help:      "A counter for outgoing requests for a data source",
		},
		[]string{"datasource", "code", "method"},
	)

	datasourceRequestHistogram = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Namespace: "grafana",
			Name:      "datasource_request_duration_seconds",
			Help:      "histogram of durations of outgoing data source requests sent from Grafana",
			Buckets:   []float64{.005, .01, .025, .05, .1, .25, .5, 1, 2.5, 5, 10, 25, 50, 100},
		}, []string{"datasource", "code", "method"},
	)

	datasourceResponseHistogram = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Namespace: "grafana",
			Name:      "datasource_response_size_bytes",
			Help:      "histogram of data source response sizes returned to Grafana",
			Buckets:   []float64{128, 256, 512, 1024, 2048, 4096, 8192, 16384, 32768, 65536, 131072, 262144, 524288, 1048576},
		}, []string{"datasource"},
	)

	datasourceRequestsInFlight = promauto.NewGaugeVec(
		prometheus.GaugeOpts{
			Namespace: "grafana",
			Name:      "datasource_request_in_flight",
			Help:      "A gauge of outgoing data source requests currently being sent by Grafana",
		},
		[]string{"datasource"},
	)
)

const DataSourceMetricsMiddlewareName = "metrics"

var executeMiddlewareFunc = executeMiddleware

func DataSourceMetricsMiddleware() sdkhttpclient.Middleware {
	return sdkhttpclient.NamedMiddlewareFunc(DataSourceMetricsMiddlewareName, func(opts sdkhttpclient.Options, next http.RoundTripper) http.RoundTripper {
		if opts.Labels == nil {
			return next
		}

		datasourceName, exists := opts.Labels["datasource_name"]
		if !exists {
			return next
		}

		datasourceLabelName, err := metricutil.SanitizeLabelName(datasourceName)
		// if the datasource named cannot be turned into a prometheus
		// label we will skip instrumenting these metrics.
		if err != nil {
			return next
		}

		datasourceLabel := prometheus.Labels{"datasource": datasourceLabelName}

		return executeMiddlewareFunc(next, datasourceLabel)
	})
}

func executeMiddleware(next http.RoundTripper, datasourceLabel prometheus.Labels) http.RoundTripper {
	return sdkhttpclient.RoundTripperFunc(func(r *http.Request) (*http.Response, error) {
		requestCounter := datasourceRequestCounter.MustCurryWith(datasourceLabel)
		requestHistogram := datasourceRequestHistogram.MustCurryWith(datasourceLabel)
		requestInFlight := datasourceRequestsInFlight.With(datasourceLabel)
		responseSizeHistogram := datasourceResponseHistogram.With(datasourceLabel)

		res, err := promhttp.InstrumentRoundTripperDuration(requestHistogram,
			promhttp.InstrumentRoundTripperCounter(requestCounter,
				promhttp.InstrumentRoundTripperInFlight(requestInFlight, next))).
			RoundTrip(r)
		if err != nil {
			return nil, err
		}

		if res != nil && res.StatusCode != http.StatusSwitchingProtocols {
			res.Body = httpclient.CountBytesReader(res.Body, func(bytesRead int64) {
				responseSizeHistogram.Observe(float64(bytesRead))
			})
		}

		return res, nil
	})
}
