package notifier

import (
	"bytes"
	"context"
	"io"
	"net/url"
	"testing"
	"time"

	alertingModels "github.com/grafana/alerting/models"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/ngalert/client"
	"github.com/grafana/grafana/pkg/services/ngalert/lokiclient"
	"github.com/grafana/grafana/pkg/services/ngalert/metrics"
	"github.com/prometheus/alertmanager/notify"
	"github.com/prometheus/alertmanager/types"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/testutil"
	"github.com/prometheus/common/model"
	"github.com/stretchr/testify/require"
)

var testNow = time.Date(2025, time.July, 15, 16, 55, 0, 0, time.UTC)
var testAlerts = []*types.Alert{
	{
		Alert: model.Alert{
			Labels:       model.LabelSet{"alertname": "Alert1", alertingModels.RuleUIDLabel: "testRuleUID"},
			Annotations:  model.LabelSet{"foo": "bar", "__private__": "baz"},
			StartsAt:     testNow,
			EndsAt:       testNow,
			GeneratorURL: "http://localhost/test",
		},
	},
}

func TestRecord(t *testing.T) {
	t.Run("write notification history to Loki", func(t *testing.T) {
		req := lokiclient.NewFakeRequester()
		met := metrics.NewNotificationHistorianMetrics(prometheus.NewRegistry())
		h := createTestNotificationHistorian(req, met)

		err := <-h.Record(recordCtx(), testAlerts, false, nil, time.Second)
		require.NoError(t, err)

		reqBody, err := io.ReadAll(req.LastRequest.Body)
		require.NoError(t, err)
		expected := "{\"streams\":[{\"stream\":{\"externalLabelKey\":\"externalLabelValue\",\"from\":\"notify-history\"},\"values\":[[\"1752598500000000000\",\"{\\\"schemaVersion\\\":1,\\\"ruleUIDs\\\":[\\\"testRuleUID\\\"],\\\"receiver\\\":\\\"testReceiverName\\\",\\\"status\\\":\\\"resolved\\\",\\\"groupLabels\\\":{\\\"foo\\\":\\\"bar\\\"},\\\"alerts\\\":[{\\\"status\\\":\\\"resolved\\\",\\\"labels\\\":{\\\"alertname\\\":\\\"Alert1\\\"},\\\"annotations\\\":{\\\"foo\\\":\\\"bar\\\"},\\\"startsAt\\\":\\\"2025-07-15T16:55:00Z\\\",\\\"endsAt\\\":\\\"2025-07-15T16:55:00Z\\\"}],\\\"retry\\\":false,\\\"duration\\\":1000}\"]]}]}"
		require.Equal(t, expected, string(reqBody))
	})

	t.Run("emits expected write metrics", func(t *testing.T) {
		reg := prometheus.NewRegistry()
		met := metrics.NewNotificationHistorianMetrics(reg)
		goodHistorian := createTestNotificationHistorian(lokiclient.NewFakeRequester(), met)
		badHistorian := createTestNotificationHistorian(lokiclient.NewFakeRequester().WithResponse(lokiclient.BadResponse()), met)

		<-goodHistorian.Record(recordCtx(), testAlerts, false, nil, time.Second)
		<-badHistorian.Record(recordCtx(), testAlerts, false, nil, time.Second)

		exp := bytes.NewBufferString(`
# HELP grafana_alerting_notification_history_writes_failed_total The total number of failed writes of notification history batches.
# TYPE grafana_alerting_notification_history_writes_failed_total counter
grafana_alerting_notification_history_writes_failed_total 1
# HELP grafana_alerting_notification_history_writes_total The total number of notification history batches that were attempted to be written.
# TYPE grafana_alerting_notification_history_writes_total counter
grafana_alerting_notification_history_writes_total 2
`)
		err := testutil.GatherAndCompare(reg, exp,
			"grafana_alerting_notification_history_transitions_total",
			"grafana_alerting_notification_history_transitions_failed_total",
			"grafana_alerting_notification_history_writes_total",
			"grafana_alerting_notification_history_writes_failed_total",
		)
		require.NoError(t, err)
	})
}

func createTestNotificationHistorian(req client.Requester, met *metrics.NotificationHistorian) *NotificationHistorian {
	writePathURL, _ := url.Parse("http://some.url")
	cfg := lokiclient.LokiConfig{
		WritePathURL:   writePathURL,
		ExternalLabels: map[string]string{"externalLabelKey": "externalLabelValue"},
		Encoder:        lokiclient.JsonEncoder{},
	}
	tracer := tracing.InitializeTracerForTest()
	return NewNotificationHistorian(log.NewNopLogger(), cfg, req, met, tracer)
}

func recordCtx() context.Context {
	ctx := notify.WithReceiverName(context.Background(), "testReceiverName")
	ctx = notify.WithGroupLabels(ctx, model.LabelSet{"foo": "bar"})
	ctx = notify.WithNow(ctx, testNow)
	return ctx
}
