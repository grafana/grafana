package httpclientprovider

import (
	"net/http"
	"strconv"
	"time"

	sdkhttpclient "github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/grafana/grafana/pkg/infra/metrics/metricutil"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

const kb = 1024
const mb = kb * kb
const gb = mb * kb

var (
	datasourceRequestCounter = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Namespace: "grafana",
			Name:      "datasource_request_total",
			Help:      "A counter for outgoing requests for a data source",
		},
		[]string{"datasource", "datasource_type", "code", "method", "secure_socks_ds_proxy_enabled"},
	)

	datasourceRequestHistogram = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Namespace: "grafana",
			Name:      "datasource_request_duration_seconds",
			Help:      "histogram of durations of outgoing data source requests sent from Grafana",
			Buckets:   []float64{.005, .01, .025, .05, .1, .25, .5, 1, 2.5, 5, 10, 25, 50, 100},
		}, []string{"datasource", "datasource_type", "code", "method", "secure_socks_ds_proxy_enabled"},
	)

	datasourceResponseHistogram = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Namespace: "grafana",
			Name:      "datasource_response_size_bytes",
			Help:      "histogram of data source response sizes returned to Grafana",
			Buckets: []float64{128, 256, 512, 1 * kb, 2 * kb, 4 * kb, 8 * kb, 16 * kb, 32 * kb, 64 * kb, 128 * kb, 256 * kb, 512 * kb, 1 * mb,
				2 * mb, 4 * mb, 8 * mb, 16 * mb, 32 * mb, 64 * mb, 128 * mb, 256 * mb, 512 * mb, 1 * gb,
				2 * gb, 4 * gb, 8 * gb},
			NativeHistogramBucketFactor:     1.1,
			NativeHistogramMaxBucketNumber:  100,
			NativeHistogramMinResetDuration: time.Hour,
		}, []string{"datasource", "datasource_type", "secure_socks_ds_proxy_enabled"},
	)

	datasourceRequestsInFlight = promauto.NewGaugeVec(
		prometheus.GaugeOpts{
			Namespace: "grafana",
			Name:      "datasource_request_in_flight",
			Help:      "A gauge of outgoing data source requests currently being sent by Grafana",
		},
		[]string{"datasource", "datasource_type", "secure_socks_ds_proxy_enabled"},
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

		datasourceType, exists := opts.Labels["datasource_type"]
		if !exists {
			return next
		}
		datasourceLabelType, err := metricutil.SanitizeLabelName(datasourceType)
		// if the datasource type cannot be turned into a prometheus
		// label we will skip instrumenting these metrics.
		if err != nil {
			return next
		}

		labels := prometheus.Labels{
			"datasource":                    datasourceLabelName,
			"datasource_type":               datasourceLabelType,
			"secure_socks_ds_proxy_enabled": strconv.FormatBool(opts.ProxyOptions != nil && opts.ProxyOptions.Enabled),
		}

		return executeMiddlewareFunc(next, labels)
	})
}

func executeMiddleware(next http.RoundTripper, labels prometheus.Labels) http.RoundTripper {
	return sdkhttpclient.RoundTripperFunc(func(r *http.Request) (*http.Response, error) {
		requestCounter := datasourceRequestCounter.MustCurryWith(labels)
		requestHistogram := datasourceRequestHistogram.MustCurryWith(labels)
		requestInFlight := datasourceRequestsInFlight.With(labels)
		responseSizeHistogram := datasourceResponseHistogram.With(labels)

		res, err := promhttp.InstrumentRoundTripperDuration(requestHistogram,
			promhttp.InstrumentRoundTripperCounter(requestCounter,
				promhttp.InstrumentRoundTripperInFlight(requestInFlight, next))).
			RoundTrip(r)
		if err != nil {
			return nil, err
		}

		if res != nil && res.StatusCode != http.StatusSwitchingProtocols {
			res.Body = sdkhttpclient.CountBytesReader(res.Body, func(bytesRead int64) {
				responseSizeHistogram.Observe(float64(bytesRead))
			})
		}

		return res, nil
	})
}
