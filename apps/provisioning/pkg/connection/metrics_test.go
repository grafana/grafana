package connection

import (
	"testing"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// Shared registry for all tests to work with sync.Once singleton pattern
var testRegistry = prometheus.NewRegistry()
var testDecryptMetrics = RegisterDecryptMetrics(testRegistry)

func TestRegisterDecryptMetrics(t *testing.T) {
	t.Run("does not panic on pedantic registry", func(t *testing.T) {
		require.NotPanics(t, func() {
			RegisterDecryptMetrics(prometheus.NewPedanticRegistry())
		})
	})

	t.Run("double registration is safe with sync.Once", func(t *testing.T) {
		require.NotPanics(t, func() {
			RegisterDecryptMetrics(testRegistry)
		})
	})

	t.Run("returns same instance on repeated calls", func(t *testing.T) {
		first := RegisterDecryptMetrics(testRegistry)
		second := RegisterDecryptMetrics(testRegistry)
		assert.Same(t, first, second, "repeated calls should return the same singleton")
	})

	t.Run("metrics are functional after registration", func(t *testing.T) {
		m := testDecryptMetrics
		require.NotNil(t, m)

		m.recordSuccess(secretTypeToken, 0.5)
		m.recordError(secretTypeToken)

		families, err := testRegistry.Gather()
		require.NoError(t, err)

		var found int
		for _, f := range families {
			switch f.GetName() {
			case "grafana_provisioning_connection_secret_decrypted_total",
				"grafana_provisioning_connection_secret_decrypt_errors_total",
				"grafana_provisioning_connection_secret_decrypted_duration_seconds":
				found++
			}
		}
		assert.Equal(t, 3, found, "all three connection decrypt metrics should be registered")
	})
}
