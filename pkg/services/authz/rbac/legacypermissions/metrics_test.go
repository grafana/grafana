package legacypermissions

import (
	"context"
	"errors"
	"testing"

	authzv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"
)

type metricTestServer struct {
	authzv1.UnimplementedLegacyAuthzServiceServer
	call func() error
}

func (s metricTestServer) LegacyGetUserPermissions(*authzv1.LegacyGetUserPermissionsRequest, authzv1.LegacyAuthzService_LegacyGetUserPermissionsServer) error {
	return s.call()
}

func TestLegacyPermissionsMetrics(t *testing.T) {
	for _, implementation := range []string{"embedded", "remote"} {
		for _, err := range []error{nil, errors.New("load failed"), context.Canceled, context.DeadlineExceeded} {
			t.Run(implementation+"/"+statusLabel(err), func(t *testing.T) {
				reg := prometheus.NewRegistry()
				calls := 0
				server := InstrumentServer(metricTestServer{call: func() error { calls++; return err }}, reg, implementation)
				require.ErrorIs(t, server.LegacyGetUserPermissions(nil, nil), err)
				require.Equal(t, 1, calls)
				families, gatherErr := reg.Gather()
				require.NoError(t, gatherErr)
				require.Len(t, families, 1)
				require.Equal(t, "grafana_authz_legacy_get_user_permissions_duration_seconds", families[0].GetName())
				for _, metric := range families[0].Metric {
					labels := map[string]string{}
					for _, label := range metric.Label {
						labels[label.GetName()] = label.GetValue()
					}
					require.Equal(t, implementation, labels["implementation"])
					var count uint64
					if labels["status"] == statusLabel(err) {
						count = 1
					}
					require.Equal(t, count, metric.Histogram.GetSampleCount())
				}
			})
		}
	}
}

func statusLabel(err error) string {
	if err != nil {
		return "error"
	}
	return "ok"
}

func TestLegacyPermissionsMetricsPanic(t *testing.T) {
	reg := prometheus.NewRegistry()
	server := InstrumentServer(metricTestServer{call: func() error { panic("loader panic") }}, reg, "embedded")
	require.PanicsWithValue(t, "loader panic", func() { _ = server.LegacyGetUserPermissions(nil, nil) })
	families, err := reg.Gather()
	require.NoError(t, err)
	for _, metric := range families[0].Metric {
		for _, label := range metric.Label {
			if label.GetName() == "status" && label.GetValue() == "error" {
				require.Equal(t, uint64(1), metric.Histogram.GetSampleCount())
				return
			}
		}
	}
	t.Fatal("missing error observation")
}

func TestLegacyPermissionsMetricsSharedRegistry(t *testing.T) {
	reg := prometheus.NewRegistry()
	for _, implementation := range []string{"embedded", "remote"} {
		server := InstrumentServer(metricTestServer{call: func() error { return nil }}, reg, implementation)
		require.NoError(t, server.LegacyGetUserPermissions(nil, nil))
	}
	families, err := reg.Gather()
	require.NoError(t, err)
	require.Len(t, families, 1)
	require.Len(t, families[0].Metric, 4)
}
