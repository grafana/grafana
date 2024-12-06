package metrics

import (
	"sync"

	"github.com/prometheus/client_golang/prometheus"
)

const (
	namespace = "grafana"
	subsystem = "feedback"
)

type metrics struct {
	FeedbackCollected  *prometheus.CounterVec
	GithubIssueCreated *prometheus.CounterVec
}

var instantiated *metrics
var once sync.Once

func GetMetrics() *metrics {
	// are singletons in go naughty?
	once.Do(func() {
		instantiated = &metrics{
			FeedbackCollected: prometheus.NewCounterVec(prometheus.CounterOpts{
				Namespace: namespace,
				Subsystem: subsystem,
				Name:      "feedback_collected",
				Help:      "Total number of times feedback was collected",
			}, []string{"slug", "has_screenshot"}),
			GithubIssueCreated: prometheus.NewCounterVec(prometheus.CounterOpts{
				Namespace: namespace,
				Subsystem: subsystem,
				Name:      "github_issue_created",
				Help:      "Total number of github issues created",
			}, []string{"slug", "has_screenshot", "was_triaged"}),
		}
	})
	return instantiated

}

func (m *metrics) Collect(ch chan<- prometheus.Metric) {
	m.FeedbackCollected.Collect(ch)
	m.GithubIssueCreated.Collect(ch)
}

func (m *metrics) Describe(ch chan<- *prometheus.Desc) {
	m.FeedbackCollected.Describe(ch)
	m.GithubIssueCreated.Describe(ch)
}
