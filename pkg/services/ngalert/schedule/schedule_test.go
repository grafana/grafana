package schedule

import (
	"context"
	"net/url"
	"testing"
	"time"

	"github.com/benbjohnson/clock"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"golang.org/x/sync/errgroup"

	"github.com/grafana/grafana/pkg/services/ngalert/image"
	"github.com/grafana/grafana/pkg/services/ngalert/metrics"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/state"
	"github.com/grafana/grafana/pkg/setting"
)

type evalAppliedInfo struct {
	alertDefKey models.AlertRuleKey
	now         time.Time
}

func TestProcessTicks(t *testing.T) {
	testMetrics := metrics.NewNGAlert(prometheus.NewPedanticRegistry())
	ctx := context.Background()
	dispatcherGroup, ctx := errgroup.WithContext(ctx)

	ruleStore := newFakeRulesStore()

	cfg := setting.UnifiedAlertingSettings{
		BaseInterval:            1 * time.Second,
		AdminConfigPollInterval: 10 * time.Minute, // do not poll in unit tests.
	}

	const mainOrgID int64 = 1

	mockedClock := clock.NewMock()

	notifier := &AlertsSenderMock{}
	notifier.EXPECT().Send(mock.Anything, mock.Anything).Return()

	schedCfg := SchedulerCfg{
		Cfg:         cfg,
		C:           mockedClock,
		RuleStore:   ruleStore,
		Metrics:     testMetrics.GetSchedulerMetrics(),
		AlertSender: notifier,
	}
	st := state.NewManager(testMetrics.GetStateMetrics(), nil, nil, &image.NoopImageService{}, mockedClock, &state.FakeHistorian{})

	appUrl := &url.URL{
		Scheme: "http",
		Host:   "localhost",
	}
	sched := NewScheduler(schedCfg, appUrl, st)

	evalAppliedCh := make(chan evalAppliedInfo, 1)
	stopAppliedCh := make(chan models.AlertRuleKey, 1)

	sched.evalAppliedFunc = func(alertDefKey models.AlertRuleKey, now time.Time) {
		evalAppliedCh <- evalAppliedInfo{alertDefKey: alertDefKey, now: now}
	}
	sched.stopAppliedFunc = func(alertDefKey models.AlertRuleKey) {
		stopAppliedCh <- alertDefKey
	}

	tick := time.Time{}

	// create alert rule under main org with one second interval
	alertRule1 := models.AlertRuleGen(models.WithOrgID(mainOrgID), models.WithInterval(cfg.BaseInterval), models.WithTitle("rule-1"))()
	ruleStore.PutRule(ctx, alertRule1)

	t.Run("on 1st tick alert rule should be evaluated", func(t *testing.T) {
		tick = tick.Add(cfg.BaseInterval)

		scheduled, stopped := sched.processTick(ctx, dispatcherGroup, tick)

		require.Len(t, scheduled, 1)
		require.Equal(t, alertRule1, scheduled[0].rule)
		require.Equal(t, tick, scheduled[0].scheduledAt)
		require.Emptyf(t, stopped, "None rules are expected to be stopped")

		assertEvalRun(t, evalAppliedCh, tick, alertRule1.GetKey())
	})

	// add alert rule under main org with three base intervals
	alertRule2 := models.AlertRuleGen(models.WithOrgID(mainOrgID), models.WithInterval(3*cfg.BaseInterval), models.WithTitle("rule-2"))()
	ruleStore.PutRule(ctx, alertRule2)

	t.Run("on 2nd tick first alert rule should be evaluated", func(t *testing.T) {
		tick = tick.Add(cfg.BaseInterval)
		scheduled, stopped := sched.processTick(ctx, dispatcherGroup, tick)

		require.Len(t, scheduled, 1)
		require.Equal(t, alertRule1, scheduled[0].rule)
		require.Equal(t, tick, scheduled[0].scheduledAt)
		require.Emptyf(t, stopped, "None rules are expected to be stopped")
		assertEvalRun(t, evalAppliedCh, tick, alertRule1.GetKey())
	})

	t.Run("on 3rd tick two alert rules should be evaluated", func(t *testing.T) {
		tick = tick.Add(cfg.BaseInterval)
		scheduled, stopped := sched.processTick(ctx, dispatcherGroup, tick)
		require.Len(t, scheduled, 2)
		var keys []models.AlertRuleKey
		for _, item := range scheduled {
			keys = append(keys, item.rule.GetKey())
			require.Equal(t, tick, item.scheduledAt)
		}
		require.Contains(t, keys, alertRule1.GetKey())
		require.Contains(t, keys, alertRule2.GetKey())

		require.Emptyf(t, stopped, "None rules are expected to be stopped")

		assertEvalRun(t, evalAppliedCh, tick, keys...)
	})

	t.Run("on 4th tick only one alert rule should be evaluated", func(t *testing.T) {
		tick = tick.Add(cfg.BaseInterval)
		scheduled, stopped := sched.processTick(ctx, dispatcherGroup, tick)

		require.Len(t, scheduled, 1)
		require.Equal(t, alertRule1, scheduled[0].rule)
		require.Equal(t, tick, scheduled[0].scheduledAt)
		require.Emptyf(t, stopped, "None rules are expected to be stopped")

		assertEvalRun(t, evalAppliedCh, tick, alertRule1.GetKey())
	})

	t.Run("on 5th tick deleted rule should not be evaluated but stopped", func(t *testing.T) {
		tick = tick.Add(cfg.BaseInterval)

		ruleStore.DeleteRule(alertRule1)

		scheduled, stopped := sched.processTick(ctx, dispatcherGroup, tick)

		require.Empty(t, scheduled)
		require.Len(t, stopped, 1)

		require.Contains(t, stopped, alertRule1.GetKey())

		assertStopRun(t, stopAppliedCh, alertRule1.GetKey())
	})

	t.Run("on 6th tick one alert rule should be evaluated", func(t *testing.T) {
		tick = tick.Add(cfg.BaseInterval)

		scheduled, stopped := sched.processTick(ctx, dispatcherGroup, tick)

		require.Len(t, scheduled, 1)
		require.Equal(t, alertRule2, scheduled[0].rule)
		require.Equal(t, tick, scheduled[0].scheduledAt)
		require.Emptyf(t, stopped, "None rules are expected to be stopped")

		assertEvalRun(t, evalAppliedCh, tick, alertRule2.GetKey())
	})

	t.Run("on 7th tick a new alert rule should be evaluated", func(t *testing.T) {
		// create alert rule with one base interval
		alertRule3 := models.AlertRuleGen(models.WithOrgID(mainOrgID), models.WithInterval(cfg.BaseInterval), models.WithTitle("rule-3"))()
		ruleStore.PutRule(ctx, alertRule3)
		tick = tick.Add(cfg.BaseInterval)

		scheduled, stopped := sched.processTick(ctx, dispatcherGroup, tick)

		require.Len(t, scheduled, 1)
		require.Equal(t, alertRule3, scheduled[0].rule)
		require.Equal(t, tick, scheduled[0].scheduledAt)
		require.Emptyf(t, stopped, "None rules are expected to be stopped")

		assertEvalRun(t, evalAppliedCh, tick, alertRule3.GetKey())
	})
}

func assertEvalRun(t *testing.T, ch <-chan evalAppliedInfo, tick time.Time, keys ...models.AlertRuleKey) {
	timeout := time.After(time.Second)

	expected := make(map[models.AlertRuleKey]struct{}, len(keys))
	for _, k := range keys {
		expected[k] = struct{}{}
	}

	for {
		select {
		case info := <-ch:
			_, ok := expected[info.alertDefKey]
			if !ok {
				t.Fatalf("alert rule: %v should not have been evaluated at: %v", info.alertDefKey, info.now)
			}
			t.Logf("alert rule: %v evaluated at: %v", info.alertDefKey, info.now)
			assert.Equal(t, tick, info.now)
			delete(expected, info.alertDefKey)
			if len(expected) == 0 {
				return
			}
		case <-timeout:
			if len(expected) == 0 {
				return
			}
			t.Fatal("cycle has expired")
		}
	}
}

func assertStopRun(t *testing.T, ch <-chan models.AlertRuleKey, keys ...models.AlertRuleKey) {
	timeout := time.After(time.Second)

	expected := make(map[models.AlertRuleKey]struct{}, len(keys))
	for _, k := range keys {
		expected[k] = struct{}{}
	}

	for {
		select {
		case alertDefKey := <-ch:
			_, ok := expected[alertDefKey]
			t.Logf("alert rule: %v stopped", alertDefKey)
			assert.True(t, ok)
			delete(expected, alertDefKey)
			if len(expected) == 0 {
				return
			}
		case <-timeout:
			if len(expected) == 0 {
				return
			}
			t.Fatal("cycle has expired")
		}
	}
}
