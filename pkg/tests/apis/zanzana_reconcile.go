package apis

import (
	"bytes"
	"context"
	"net/http"
	"testing"
	"time"

	dto "github.com/prometheus/client_model/go"
	"github.com/prometheus/common/expfmt"
	"github.com/prometheus/common/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/featuremgmt"
)

const zanzanaReconcileLastSuccessMetric = "grafana_zanzana_reconcile_last_success_timestamp_seconds"

// AwaitZanzanaReconcileNext waits for a Zanzana reconciliation cycle whose last-success timestamp
// is greater than "now + 2s" (the metrics report to the nearest second).
// This avoids races where a reconcile completed just before the call (and we'd otherwise treat it as "the next" reconcile).
//
// It is a no-op unless the `zanzana` feature toggle is enabled for the running test env.
func AwaitZanzanaReconcileNext(t *testing.T, helper *K8sTestHelper) {
	t.Helper()

	enabled := false
	if helper != nil {
		enabled = helper.GetEnv().FeatureToggles.GetEnabled(context.Background())[featuremgmt.FlagZanzana]
	}
	if helper == nil || !enabled {
		return
	}

	thresholdSeconds := float64(time.Now().Add(2*time.Second).UnixNano()) / float64(time.Second)

	require.EventuallyWithT(t, func(c *assert.CollectT) {
		ts, ok := getZanzanaReconcileLastSuccessTimestampSeconds(t, helper)
		assert.True(c, ok, "expected to find %s in /metrics", zanzanaReconcileLastSuccessMetric)
		if !ok {
			return
		}
		assert.Greater(c, ts, thresholdSeconds, "expected %s (%v) > %v", zanzanaReconcileLastSuccessMetric, ts, thresholdSeconds)
	}, 30*time.Second, 50*time.Millisecond)
}

func getZanzanaReconcileLastSuccessTimestampSeconds(t *testing.T, helper *K8sTestHelper) (float64, bool) {
	t.Helper()

	rsp := DoRequest(helper, RequestParams{
		User:   helper.Org1.Admin,
		Path:   "/metrics",
		Accept: "text/plain",
	}, &struct{}{})
	if rsp.Response == nil || rsp.Response.StatusCode != http.StatusOK {
		return 0, false
	}

	parser := expfmt.NewTextParser(model.UTF8Validation)
	metrics, err := parser.TextToMetricFamilies(bytes.NewReader(rsp.Body))
	if err != nil {
		return 0, false
	}

	metric := metrics[zanzanaReconcileLastSuccessMetric]
	if metric == nil || len(metric.Metric) == 0 {
		return 0, false
	}

	m := metric.Metric[0]
	switch metric.GetType() {
	case dto.MetricType_GAUGE:
		if m.Gauge == nil {
			return 0, false
		}
		return m.Gauge.GetValue(), true
	case dto.MetricType_UNTYPED:
		if m.Untyped == nil {
			return 0, false
		}
		return m.Untyped.GetValue(), true
	default:
		return 0, false
	}
}
