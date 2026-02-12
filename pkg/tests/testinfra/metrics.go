package testinfra

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
	"testing"

	"github.com/prometheus/common/expfmt"
	"github.com/prometheus/common/model"
	"github.com/stretchr/testify/require"
)

// GetMetricValue fetches a metric value from an instance's /metrics endpoint.
// Returns -1 if the metric is not found or on error.
func GetMetricValue(t *testing.T, addr, user, password, metricName string) float64 {
	t.Helper()

	url := fmt.Sprintf("http://%s/metrics", addr)
	req, err := http.NewRequest(http.MethodGet, url, nil)
	require.NoError(t, err)
	req.SetBasicAuth(user, password)

	resp, err := (&http.Client{}).Do(req)
	if err != nil {
		t.Logf("Failed to fetch metrics from %s: %v", addr, err)
		return -1
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		t.Logf("Metrics endpoint returned status %d for %s", resp.StatusCode, addr)
		return -1
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		t.Logf("Failed to read metrics body from %s: %v", addr, err)
		return -1
	}

	parser := expfmt.NewTextParser(model.UTF8Validation)
	metrics, err := parser.TextToMetricFamilies(bytes.NewReader(body))
	if err != nil {
		t.Logf("Failed to parse metrics from %s: %v", addr, err)
		return -1
	}

	metricFamily, ok := metrics[metricName]
	if !ok {
		t.Logf("Metric %s not found on %s", metricName, addr)
		return -1
	}

	if len(metricFamily.Metric) == 0 {
		return 0
	}
	m := metricFamily.Metric[0]
	if m.Gauge != nil {
		return m.Gauge.GetValue()
	}
	if m.Counter != nil {
		return m.Counter.GetValue()
	}
	return 0
}
