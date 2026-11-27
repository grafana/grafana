package provisioning

import (
	"testing"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"
)

func TestInformerMetrics_RegistersOnce(t *testing.T) {
	m := ProvideInformerMetrics(prometheus.NewRegistry())

	// Both controller services call get on the same instance; a second
	// registration on the registry would panic.
	relist, freshness := m.get()
	require.NotNil(t, relist)
	require.NotNil(t, freshness)

	relist2, freshness2 := m.get()
	require.Same(t, relist, relist2)
	require.Same(t, freshness, freshness2)
}
