package metrics

import (
	"testing"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"
)

func Test_NewAlertmanagerConfigMetrics(t *testing.T) {
	t.Run("Successfully registers collectors despite previous call", func(t *testing.T) {
		r := prometheus.NewRegistry()
		l := log.NewNopLogger()

		require.NotPanics(t, func() {
			for i := 0; i < 3; i++ {
				m := NewAlertmanagerConfigMetrics(r, l)
				m.ConfigHash.WithLabelValues("test").Set(1)
				m.Matchers.Set(1)
				m.MatchRE.Set(1)
				m.Match.Set(1)
				m.ObjectMatchers.Set(1)

				mf, err := r.Gather()
				require.NoError(t, err)

				for j := 0; j < len(mf); j++ {
					require.Equal(t, float64(1), mf[j].GetMetric()[0].GetGauge().GetValue())
				}
			}
		})
	})
}
