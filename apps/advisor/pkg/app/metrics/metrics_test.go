package metrics

import (
	"testing"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestRegister(t *testing.T) {
	registry := prometheus.NewRegistry()
	MustRegister(registry)
	// Register with nil is a no-op
	MustRegister(nil)
}

func TestRegisterAndRecord(t *testing.T) {
	registry := prometheus.NewRegistry()
	MustRegister(registry)

	CheckProcessingTotal.WithLabelValues("process", "success", "datasource").Inc()
	CheckProcessingTotal.WithLabelValues("process", "error", "plugin").Inc()
	CheckProcessingDurationSeconds.WithLabelValues("process", "datasource").Observe(0.5)
	CheckRegistrationTotal.WithLabelValues("success").Inc()
	OrgIDErrorsTotal.Inc()
	StepPanicsTotal.WithLabelValues("step-1").Inc()

	metrics, err := registry.Gather()
	require.NoError(t, err)
	assert.GreaterOrEqual(t, len(metrics), 5)
}
