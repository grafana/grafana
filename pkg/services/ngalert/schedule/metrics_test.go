package schedule

import (
	"bytes"
	"context"
	"testing"
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
	const orgID int64 = 1

	ruleStore := newFakeRulesStore()
	reg := prometheus.NewPedanticRegistry()
	mockedClock := clock.NewMock()
	sch := setupScheduler(t, ruleStore, nil, reg, nil, nil, nil, withSchedulerClock(mockedClock))

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

	// Advance mock clock to trigger ticks and populate metrics
	for i := 0; i < 3; i++ {
		mockedClock.Add(time.Second)
	}

	require.Eventually(t, func() bool {
		return testutil.ToFloat64(sch.metrics.SchedulableAlertRules) > 0
	}, time.Second, 50*time.Millisecond)

	groupRulesCount, err := testutil.GatherAndCount(reg, "grafana_alerting_rule_group_rules")
	require.NoError(t, err)
	require.Greater(t, groupRulesCount, 0)

	cancel()
	<-stopped

	// Verify metrics are reset after stop
	require.Equal(t, 0.0, testutil.ToFloat64(sch.metrics.BehindSeconds))
	require.Equal(t, 0.0, testutil.ToFloat64(sch.metrics.SchedulableAlertRules))
	require.Equal(t, 0.0, testutil.ToFloat64(sch.metrics.SchedulableAlertRulesHash))

	err = testutil.GatherAndCompare(reg, bytes.NewBufferString(""), "grafana_alerting_rule_group_rules")
	require.NoError(t, err)
	err = testutil.GatherAndCompare(reg, bytes.NewBufferString(""), "grafana_alerting_rule_groups")
	require.NoError(t, err)
}
