package metrics

import (
	"testing"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"
)

func TestRegister(t *testing.T) {
	reg := prometheus.NewRegistry()
	Register(reg)

	var alreadyRegistered prometheus.AlreadyRegisteredError
	require.ErrorAs(t, reg.Register(MInstanceStart), &alreadyRegistered)
	require.Contains(t, FrontendMetrics, "frontend_boot_load_time_seconds")
}

func TestSetBuildInformation(t *testing.T) {
	for _, tc := range []struct {
		isEnterprise bool
		edition      string
	}{
		{false, "oss"},
		{true, "enterprise"},
	} {
		t.Run(tc.edition, func(t *testing.T) {
			reg := prometheus.NewRegistry()
			SetBuildInformation(reg, "1.2.3", "abc123", "main", 1700000000, tc.isEnterprise)

			mfs, err := reg.Gather()
			require.NoError(t, err)
			require.Len(t, mfs, 2)

			for _, mf := range mfs {
				labels := map[string]string{}
				for _, l := range mf.GetMetric()[0].GetLabel() {
					labels[l.GetName()] = l.GetValue()
				}
				require.Equal(t, tc.edition, labels["edition"], mf.GetName())
				require.Equal(t, "1.2.3", labels["version"], mf.GetName())
			}
		})
	}
}
