package httpclientprovider

import (
	"net/http"

	sdkhttpclient "github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/grafana/grafana/pkg/infra/httpclient"
	"github.com/grafana/grafana/pkg/infra/metrics/metricutil"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

var datasourceRequestCounter = prometheus.NewCounterVec(
	prometheus.CounterOpts{
		Namespace: "grafana",
		Name:      "datasource_request_total",
		Help:      "A counter for outgoing requests for a datasource",
	},
	[]string{"datasource", "code", "method"},
)

var datasourceRequestSummary = prometheus.NewSummaryVec(
	prometheus.SummaryOpts{
		Namespace:  "grafana",
		Name:       "datasource_request_duration_seconds",
		Help:       "summary of outgoing datasource requests sent from Grafana",
		Objectives: map[float64]float64{0.5: 0.05, 0.9: 0.01, 0.99: 0.001},
	}, []string{"datasource", "code", "method"},
)

var datasourceResponseSummary = prometheus.NewSummaryVec(
	prometheus.SummaryOpts{
		Namespace:  "grafana",
		Name:       "datasource_response_size_bytes",
		Help:       "summary of datasource response sizes returned to Grafana",
		Objectives: map[float64]float64{0.5: 0.05, 0.9: 0.01, 0.99: 0.001},
	}, []string{"datasource"},
)

var datasourceRequestsInFlight = prometheus.NewGaugeVec(
	prometheus.GaugeOpts{
		Namespace: "grafana",
		Name:      "datasource_request_in_flight",
		Help:      "A gauge of outgoing datasource requests currently being sent by Grafana",
	},
	[]string{"datasource"},
)

func init() {
	prometheus.MustRegister(datasourceRequestSummary,
		datasourceRequestCounter,
		datasourceRequestsInFlight,
		datasourceResponseSummary)
}

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
		requestSummary := datasourceRequestSummary.MustCurryWith(datasourceLabel)
		requestInFlight := datasourceRequestsInFlight.With(datasourceLabel)
		responseSizeSummary := datasourceResponseSummary.With(datasourceLabel)

		res, err := promhttp.InstrumentRoundTripperDuration(requestSummary,
			promhttp.InstrumentRoundTripperCounter(requestCounter,
				promhttp.InstrumentRoundTripperInFlight(requestInFlight, next))).
			RoundTrip(r)
		if err != nil {
			return nil, err
		}

		if res != nil && res.StatusCode != http.StatusSwitchingProtocols {
			res.Body = httpclient.CountBytesReader(res.Body, func(bytesRead int64) {
				responseSizeSummary.Observe(float64(bytesRead))
			})
		}

		return res, nil
	})
}
