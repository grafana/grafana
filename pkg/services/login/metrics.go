package login

import (
	"sync"

	"github.com/prometheus/client_golang/prometheus"
)

const ExporterName = "grafana"

var once sync.Once
var Initialised bool = false

var (
	// duplicateUserLogins is a metric gauge for total number of users with duplicate logins
	duplicateUserLogins prometheus.Gauge

	// duplicateUserEmails is a metric gauge for total number of users with duplicate emails
	duplicateUserEmails prometheus.Gauge
)

func InitMetrics() {
	once.Do(func() {
		duplicateUserLogins = prometheus.NewGauge(prometheus.GaugeOpts{
			Name:    "user_duplicate_logins",
			Help:    "Number of duplicate logins",
			Namespace:ExporterName,
		})

		duplicateUserEmails = prometheus.NewGauge(prometheus.GaugeOpts{
			Name:      "user_duplicate_emails",
			Help:      "Number of duplicate emails",
			Namespace: ExporterName,
		})

		prometheus.MustRegister(
			duplicateUserLogins,
			duplicateUserEmails,
		)
	})
}
