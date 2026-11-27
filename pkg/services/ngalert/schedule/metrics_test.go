package schedule

import (
	"bytes"
	"context"
	"testing"
	"testing/synctest"
	"time"

	"github.com/benbjohnson/clock"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/testutil"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	models "github.com/grafana/grafana/pkg/services/ngalert/models"
)

func TestHashUIDs(t *testing.T) {
	r := []*models.AlertRule{{UID: "foo"}, {UID: "bar"}}
	assert.Equal(t, uint64(0xade76f55c76a1c48), hashUIDs(r))
	// expect the same hash irrespective of order
	r = []*models.AlertRule{{UID: "bar"}, {UID: "foo"}}
	assert.Equal(t, uint64(0xade76f55c76a1c48), hashUIDs(r))
	// expect a different hash
	r = []*models.AlertRule{{UID: "bar"}}
	assert.Equal(t, uint64(0xd8d9a5186bad3880), hashUIDs(r))
	// slice with no items
	r = []*models.AlertRule{}
	assert.Equal(t, uint64(0xcbf29ce484222325), hashUIDs(r))
	// a different slice with no items should have the same hash
	r = []*models.AlertRule{}
	assert.Equal(t, uint64(0xcbf29ce484222325), hashUIDs(r))
}

func TestSchedule_resetMetricsOnStop(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		const orgID int64 = 1

		ruleStore := newFakeRulesStore()
		reg := prometheus.NewPedanticRegistry()
		realClock := clock.New()
		sch := setupScheduler(t, ruleStore, nil, reg, nil, nil, nil, withSchedulerClock(realClock))

		alertRule := models.RuleGen.With(
			models.RuleGen.WithOrgID(orgID),
			models.RuleGen.WithInterval(time.Second),
			models.RuleGen.WithNotificationSettingsGen(models.NotificationSettingsGen()),
			models.RuleGen.WithEditorSettingsSimplifiedQueryAndExpressionsSection(true),
			models.RuleGen.WithPrometheusOriginalRuleDefinition("test"),
		).GenerateRef()
		ruleStore.PutRule(context.Background(), alertRule)

		ctx, cancel := context.WithCancel(context.Background())
		stopped := make(chan struct{})
		go func() {
			_ = sch.Run(ctx)
			close(stopped)
		}()

		// Initialize the scheduler ticker before advancing through rule evaluation.
		synctest.Wait()

		// Complete three scheduled ticks so rule and rule-group metrics are populated.
		synctest.Sleep(3 * time.Second)

		require.Positive(t, testutil.ToFloat64(sch.metrics.SchedulableAlertRules))

		groupRulesCount, err := testutil.GatherAndCount(reg, "grafana_alerting_rule_group_rules")
		require.NoError(t, err)
		require.Greater(t, groupRulesCount, 0)

		cancel()
		<-stopped

		// Verify metrics are reset after stop
		require.Equal(t, 0.0, testutil.ToFloat64(sch.metrics.BehindSeconds))
		require.Equal(t, 0.0, testutil.ToFloat64(sch.metrics.Ticker.LastTickTime))
		require.Equal(t, 0.0, testutil.ToFloat64(sch.metrics.Ticker.NextTickTime))
		require.Equal(t, 0.0, testutil.ToFloat64(sch.metrics.SchedulableAlertRules))
		require.Equal(t, 0.0, testutil.ToFloat64(sch.metrics.SchedulableAlertRulesHash))

		err = testutil.GatherAndCompare(reg, bytes.NewBufferString(""), "grafana_alerting_rule_group_rules")
		require.NoError(t, err)
		err = testutil.GatherAndCompare(reg, bytes.NewBufferString(""), "grafana_alerting_rule_groups")
		require.NoError(t, err)
		err = testutil.GatherAndCompare(reg, bytes.NewBufferString(""), "grafana_alerting_simple_routing_rules")
		require.NoError(t, err)
		err = testutil.GatherAndCompare(reg, bytes.NewBufferString(""), "grafana_alerting_simplified_editor_rules")
		require.NoError(t, err)
		err = testutil.GatherAndCompare(reg, bytes.NewBufferString(""), "grafana_alerting_prometheus_imported_rules")
		require.NoError(t, err)
	})
}

func TestIntervalBucketLabel(t *testing.T) {
	tests := []struct {
		seconds  int64
		expected string
	}{
		{1, "<=10s"},
		{10, "<=10s"},
		{11, "10s-30s"},
		{30, "10s-30s"},
		{31, "30s-1m"},
		{60, "30s-1m"},
		{61, "1m-5m"},
		{300, "1m-5m"},
		{301, "5m-15m"},
		{900, "5m-15m"},
		{901, "15m-30m"},
		{1800, "15m-30m"},
		{1801, "30m-1h"},
		{3600, "30m-1h"},
		{3601, "1h-6h"},
		{6 * 3600, "1h-6h"},
		{6*3600 + 1, "6h-12h"},
		{12 * 3600, "6h-12h"},
		{12*3600 + 1, "12h-1d"},
		{24 * 3600, "12h-1d"},
		{24*3600 + 1, ">1d"},
	}
	for _, tc := range tests {
		require.Equal(t, tc.expected, intervalBucketLabel(tc.seconds), "interval %ds", tc.seconds)
	}
}
