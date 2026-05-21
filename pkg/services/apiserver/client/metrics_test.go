package client

import (
	"errors"
	"testing"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	dto "github.com/prometheus/client_model/go"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

func TestClassifyStatus(t *testing.T) {
	cases := []struct {
		name string
		err  error
		want string
	}{
		{"nil", nil, "2xx"},
		{"not_found", apierrors.NewNotFound(schema.GroupResource{Resource: "folders"}, "x"), "4xx"},
		{"conflict", apierrors.NewConflict(schema.GroupResource{Resource: "folders"}, "x", errors.New("boom")), "4xx"},
		{"internal", apierrors.NewInternalError(errors.New("boom")), "5xx"},
		{"plain", errors.New("network"), "error"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			require.Equal(t, tc.want, classifyStatus(tc.err))
		})
	}
}

func TestRecordRequest_EmitsLabelledMetrics(t *testing.T) {
	clientRequests.Reset()
	clientRequestDuration.Reset()

	RecordRequest("folder_service", "get", "folder.grafana.app", "folders", time.Now(), apierrors.NewNotFound(schema.GroupResource{Resource: "folders"}, "missing"))
	RecordRequest("folder_service", "get", "folder.grafana.app", "folders", time.Now(), nil)
	RecordRequest("folder_service", "create", "folder.grafana.app", "folders", time.Now(), nil)

	require.Equal(t, float64(1), counterValue(t, "folder_service", "get", "folder.grafana.app", "folders", "4xx"))
	require.Equal(t, float64(1), counterValue(t, "folder_service", "get", "folder.grafana.app", "folders", "2xx"))
	require.Equal(t, float64(1), counterValue(t, "folder_service", "create", "folder.grafana.app", "folders", "2xx"))
}

func counterValue(t *testing.T, caller, verb, group, resource, status string) float64 {
	t.Helper()
	c, err := clientRequests.GetMetricWithLabelValues(caller, verb, group, resource, status)
	require.NoError(t, err)
	m := &dto.Metric{}
	require.NoError(t, c.(prometheus.Metric).Write(m))
	return m.Counter.GetValue()
}
