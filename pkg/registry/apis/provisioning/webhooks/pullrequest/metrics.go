package pullrequest

import (
	"sync"
	"time"

	"github.com/prometheus/client_golang/prometheus"
)

var (
	pullRequestMetricsOnce     sync.Once
	pullRequestMetricsInstance pullRequestMetrics
)

type pullRequestMetrics struct {
	registry           prometheus.Registerer
	processingDuration *prometheus.HistogramVec
	commentsPosted     *prometheus.CounterVec
}

func registerPullRequestMetrics(registry prometheus.Registerer) pullRequestMetrics {
	// called by both ProvidePullRequestWorker and ProvideWebhooksWithImages
	// this ensures we only register the metric once
	pullRequestMetricsOnce.Do(func() {
		processingDuration := prometheus.NewHistogramVec(
			prometheus.HistogramOpts{
				Name:    "grafana_provisioning_pullrequest_processing_duration_seconds",
				Help:    "Duration of pull request processing",
				Buckets: []float64{0.5, 1.0, 2.0, 5.0, 10.0, 30.0},
			},
			[]string{"outcome"},
		)
		registry.MustRegister(processingDuration)

		commentsPosted := prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Name: "grafana_provisioning_pullrequest_comments_posted_total",
				Help: "Total number of comments posted to pull requests",
			},
			[]string{"outcome"},
		)
		registry.MustRegister(commentsPosted)

		pullRequestMetricsInstance = pullRequestMetrics{
			registry:           registry,
			processingDuration: processingDuration,
			commentsPosted:     commentsPosted,
		}
	})

	return pullRequestMetricsInstance
}

func (m *pullRequestMetrics) recordProcessed(outcome string, duration time.Duration) {
	m.processingDuration.WithLabelValues(outcome).Observe(duration.Seconds())
}

func (m *pullRequestMetrics) recordCommentPosted(outcome string) {
	m.commentsPosted.WithLabelValues(outcome).Inc()
}

type screenshotMetrics struct {
	registry           prometheus.Registerer
	screenshotDuration *prometheus.HistogramVec
}

var (
	screenshotMetricsOnce     sync.Once
	screenshotMetricsInstance screenshotMetrics
)

func registerScreenshotMetrics(registry prometheus.Registerer) screenshotMetrics {
	// called by both ProvidePullRequestWorker and ProvideWebhooksWithImages
	// this ensures we only register the metric once
	screenshotMetricsOnce.Do(func() {
		screenshotDuration := prometheus.NewHistogramVec(
			prometheus.HistogramOpts{
				Name:    "grafana_provisioning_pullrequest_screenshot_duration_seconds",
				Help:    "Duration of screenshot generation",
				Buckets: []float64{1.0, 2.0, 5.0, 10.0, 30.0, 60.0},
			},
			[]string{"outcome"},
		)
		registry.MustRegister(screenshotDuration)

		screenshotMetricsInstance = screenshotMetrics{
			registry:           registry,
			screenshotDuration: screenshotDuration,
		}
	})

	return screenshotMetricsInstance
}

func (m *screenshotMetrics) recordScreenshotDuration(outcome string, duration time.Duration) {
	m.screenshotDuration.WithLabelValues(outcome).Observe(duration.Seconds())
}
