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
			Namespace:                       "grafana",
			Name:                            "datasource_response_size_bytes",
			Help:                            "histogram of data source response sizes returned to Grafana",
			Buckets:                         []float64{128, 256, 512, 1024, 2048, 4096, 8192, 16384, 32768, 65536, 131072, 262144, 524288, 1048576},
			NativeHistogramBucketFactor:     1.1,
			NativeHistogramMaxBucketNumber:  100,
			NativeHistogramMinResetDuration: time.Hour,
		}, []string{"datasource", "datasource_type", "secure_socks_ds_proxy_enabled"},
	)

	datasourceResponseGauge = promauto.NewGaugeVec(
		prometheus.GaugeOpts{
			Namespace: "plugins",
			Name:      "datasource_response_size",
			Help:      "gauge of external data source response sizes returned to Grafana in bytes",
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
		responseSizeGauge := datasourceResponseGauge.With(labels)

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
				responseSizeGauge.Set(float64(bytesRead))
			})
		}

		return res, nil
	})
}
