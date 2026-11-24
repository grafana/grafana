package legacypermissions

import (
	"context"
	"testing"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	authzv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
)

func TestLegacyPermissionsMetrics(t *testing.T) {
	reg := prometheus.NewRegistry()
	for _, implementation := range []string{"embedded", "remote"} {
		m := newMetrics(reg, implementation)
		m.observe(time.Now(), "ok")
		m.observe(time.Now(), "error")
	}
	families, err := reg.Gather()
	require.NoError(t, err)
	require.Len(t, families, 1)
	require.Equal(t, "grafana_authz_legacy_get_user_permissions_duration_seconds", families[0].GetName())
	require.Len(t, families[0].Metric, 4)
	for _, metric := range families[0].Metric {
		require.Equal(t, uint64(1), metric.Histogram.GetSampleCount())
	}
}

func TestLegacyPermissionsMetricsValidationError(t *testing.T) {
	reg := prometheus.NewRegistry()
	guard := new(int)
	server := &embeddedServer{guard: guard, metrics: newMetrics(reg, "embedded")}
	stream := embeddedStream{ctx: context.WithValue(t.Context(), embeddedCallKey{}, guard)}
	err := server.LegacyGetUserPermissions(nil, &grpc.GenericServerStream[authzv1.LegacyGetUserPermissionsRequest, authzv1.LegacyGetUserPermissionsResponse]{ServerStream: stream})
	require.Equal(t, codes.InvalidArgument, status.Code(err))
	families, err := reg.Gather()
	require.NoError(t, err)
	require.Len(t, families, 1)
	for _, metric := range families[0].Metric {
		labels := map[string]string{}
		for _, label := range metric.Label {
			labels[label.GetName()] = label.GetValue()
		}
		require.Equal(t, "embedded", labels["implementation"])
		var count uint64
		if labels["status"] == "error" {
			count = 1
		}
		require.Equal(t, count, metric.Histogram.GetSampleCount())
	}
}
