package connection

import (
	"sync"

	"github.com/prometheus/client_golang/prometheus"
)

type DecryptMetrics struct {
	secretsDecryptedTotal *prometheus.CounterVec
	decryptErrorsTotal    *prometheus.CounterVec
	decryptedDuration     *prometheus.HistogramVec
}

var (
	decryptMetricsOnce sync.Once
	decryptMetrics     *DecryptMetrics
)

func RegisterDecryptMetrics(reg prometheus.Registerer) *DecryptMetrics {
	decryptMetricsOnce.Do(func() {
		secretsDecryptedTotal := prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Name: "grafana_provisioning_connection_secret_decrypted_total",
				Help: "Total number of connection secrets decrypted successfully",
			},
			[]string{"secret_type"},
		)
		reg.MustRegister(secretsDecryptedTotal)

		decryptErrorsTotal := prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Name: "grafana_provisioning_connection_secret_decrypt_errors_total",
				Help: "Total number of connection secret decrypt errors",
			},
			[]string{"secret_type"},
		)
		reg.MustRegister(decryptErrorsTotal)

		decryptedDuration := prometheus.NewHistogramVec(
			prometheus.HistogramOpts{
				Name:    "grafana_provisioning_connection_secret_decrypted_duration_seconds",
				Help:    "Duration of connection secret decrypt operations",
				Buckets: []float64{0.01, 0.05, 0.1, 0.25, 0.5, 1.0, 2.0, 5.0},
			},
			[]string{"secret_type"},
		)
		reg.MustRegister(decryptedDuration)

		decryptMetrics = &DecryptMetrics{
			secretsDecryptedTotal: secretsDecryptedTotal,
			decryptErrorsTotal:    decryptErrorsTotal,
			decryptedDuration:     decryptedDuration,
		}
	})
	return decryptMetrics
}

func (m *DecryptMetrics) recordSuccess(st secretTypeLabel, seconds float64) {
	if m == nil {
		return
	}
	m.secretsDecryptedTotal.WithLabelValues(string(st)).Inc()
	m.decryptedDuration.WithLabelValues(string(st)).Observe(seconds)
}

func (m *DecryptMetrics) recordError(st secretTypeLabel) {
	if m == nil {
		return
	}
	m.decryptErrorsTotal.WithLabelValues(string(st)).Inc()
}
