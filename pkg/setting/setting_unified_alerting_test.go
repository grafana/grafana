package setting

import (
	"math/rand"
	"strconv"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"gopkg.in/ini.v1"
)

func TestCfg_ReadUnifiedAlertingSettings(t *testing.T) {
	cfg := NewCfg()
	err := cfg.Load(CommandLineArgs{HomePath: "../../", Config: "../../conf/defaults.ini"})
	require.NoError(t, err)

	// It sets the correct defaults.
	{
		require.Equal(t, time.Minute, cfg.UnifiedAlerting.AdminConfigPollInterval)
		require.Equal(t, time.Minute, cfg.UnifiedAlerting.AlertmanagerConfigPollInterval)
		require.Equal(t, 15*time.Second, cfg.UnifiedAlerting.HAPeerTimeout)
		require.Equal(t, "0.0.0.0:9094", cfg.UnifiedAlerting.HAListenAddr)
		require.Equal(t, "", cfg.UnifiedAlerting.HAAdvertiseAddr)
		require.Len(t, cfg.UnifiedAlerting.HAPeers, 0)
		require.Equal(t, 200*time.Millisecond, cfg.UnifiedAlerting.HAGossipInterval)
		require.Equal(t, time.Minute, cfg.UnifiedAlerting.HAPushPullInterval)
	}

	// With peers set, it correctly parses them.
	{
		require.Len(t, cfg.UnifiedAlerting.HAPeers, 0)
		s, err := cfg.Raw.NewSection("unified_alerting")
		require.NoError(t, err)
		_, err = s.NewKey("ha_peers", "hostname1:9090,hostname2:9090,hostname3:9090")
		require.NoError(t, err)

		require.NoError(t, cfg.ReadUnifiedAlertingSettings(cfg.Raw))
		require.Len(t, cfg.UnifiedAlerting.HAPeers, 3)
		require.ElementsMatch(t, []string{"hostname1:9090", "hostname2:9090", "hostname3:9090"}, cfg.UnifiedAlerting.HAPeers)
	}
}

func TestUnifiedAlertingSettings(t *testing.T) {
	testCases := []struct {
		desc                   string
		unifiedAlertingOptions map[string]string
		alertingOptions        map[string]string
		verifyCfg              func(*testing.T, Cfg)
	}{
		{
			desc: "when the unified options do not equal the defaults, it should not apply the legacy ones",
			unifiedAlertingOptions: map[string]string{
				"admin_config_poll_interval": "120s",
				"max_attempts":               "6",
				"min_interval":               "60s",
				"execute_alerts":             "false",
				"evaluation_timeout":         "90s",
			},
			alertingOptions: map[string]string{
				"max_attempts":               strconv.FormatInt(schedulerDefaultMaxAttempts, 10),
				"min_interval_seconds":       strconv.FormatInt(schedulerDefaultLegacyMinInterval, 10),
				"execute_alerts":             strconv.FormatBool(schedulereDefaultExecuteAlerts),
				"evaluation_timeout_seconds": strconv.FormatInt(int64(evaluatorDefaultEvaluationTimeout.Seconds()), 10),
			},
			verifyCfg: func(t *testing.T, cfg Cfg) {
				require.Equal(t, 120*time.Second, cfg.UnifiedAlerting.AdminConfigPollInterval)
				require.Equal(t, int64(6), cfg.UnifiedAlerting.MaxAttempts)
				require.Equal(t, time.Minute, cfg.UnifiedAlerting.MinInterval)
				require.Equal(t, false, cfg.UnifiedAlerting.ExecuteAlerts)
				require.Equal(t, 90*time.Second, cfg.UnifiedAlerting.EvaluationTimeout)
				require.Equal(t, SchedulerBaseInterval, cfg.UnifiedAlerting.BaseInterval)
				require.Equal(t, DefaultRuleEvaluationInterval, cfg.UnifiedAlerting.DefaultRuleEvaluationInterval)
			},
		},
		{
			desc: "when the unified options equal the defaults, it should apply the legacy ones",
			unifiedAlertingOptions: map[string]string{
				"admin_config_poll_interval": "120s",
				"max_attempts":               strconv.FormatInt(schedulerDefaultMaxAttempts, 10),
				"min_interval":               SchedulerBaseInterval.String(),
				"execute_alerts":             strconv.FormatBool(schedulereDefaultExecuteAlerts),
				"evaluation_timeout":         evaluatorDefaultEvaluationTimeout.String(),
			},
			alertingOptions: map[string]string{
				"max_attempts":               "12",
				"min_interval_seconds":       "120",
				"execute_alerts":             "true",
				"evaluation_timeout_seconds": "160",
			},
			verifyCfg: func(t *testing.T, cfg Cfg) {
				require.Equal(t, 120*time.Second, cfg.UnifiedAlerting.AdminConfigPollInterval)
				require.Equal(t, int64(12), cfg.UnifiedAlerting.MaxAttempts)
				require.Equal(t, 120*time.Second, cfg.UnifiedAlerting.MinInterval)
				require.Equal(t, true, cfg.UnifiedAlerting.ExecuteAlerts)
				require.Equal(t, 160*time.Second, cfg.UnifiedAlerting.EvaluationTimeout)
				require.Equal(t, SchedulerBaseInterval, cfg.UnifiedAlerting.BaseInterval)
				require.Equal(t, 120*time.Second, cfg.UnifiedAlerting.DefaultRuleEvaluationInterval)
			},
		},
		{
			desc: "when both unified and legacy options are invalid, apply the defaults",
			unifiedAlertingOptions: map[string]string{
				"max_attempts":        "invalid",
				"min_interval":        "invalid",
				"execute_alerts":      "invalid",
				"evaluation_timeouts": "invalid",
			},
			alertingOptions: map[string]string{
				"max_attempts":               "invalid",
				"min_interval_seconds":       "invalid",
				"execute_alerts":             "invalid",
				"evaluation_timeout_seconds": "invalid",
			},
			verifyCfg: func(t *testing.T, cfg Cfg) {
				require.Equal(t, alertmanagerDefaultConfigPollInterval, cfg.UnifiedAlerting.AdminConfigPollInterval)
				require.Equal(t, int64(schedulerDefaultMaxAttempts), cfg.UnifiedAlerting.MaxAttempts)
				require.Equal(t, SchedulerBaseInterval, cfg.UnifiedAlerting.MinInterval)
				require.Equal(t, schedulereDefaultExecuteAlerts, cfg.UnifiedAlerting.ExecuteAlerts)
				require.Equal(t, evaluatorDefaultEvaluationTimeout, cfg.UnifiedAlerting.EvaluationTimeout)
				require.Equal(t, SchedulerBaseInterval, cfg.UnifiedAlerting.BaseInterval)
				require.Equal(t, DefaultRuleEvaluationInterval, cfg.UnifiedAlerting.DefaultRuleEvaluationInterval)
			},
		},
		{
			desc: "when unified alerting options are invalid, apply legacy options",
			unifiedAlertingOptions: map[string]string{
				"max_attempts":       "invalid",
				"min_interval":       "invalid",
				"execute_alerts":     "invalid",
				"evaluation_timeout": "invalid",
			},
			alertingOptions: map[string]string{
				"max_attempts":               "12",
				"min_interval_seconds":       "120",
				"execute_alerts":             "false",
				"evaluation_timeout_seconds": "160",
			},
			verifyCfg: func(t *testing.T, cfg Cfg) {
				require.Equal(t, alertmanagerDefaultConfigPollInterval, cfg.UnifiedAlerting.AdminConfigPollInterval)
				require.Equal(t, int64(12), cfg.UnifiedAlerting.MaxAttempts)
				require.Equal(t, 120*time.Second, cfg.UnifiedAlerting.MinInterval)
				require.Equal(t, false, cfg.UnifiedAlerting.ExecuteAlerts)
				require.Equal(t, 160*time.Second, cfg.UnifiedAlerting.EvaluationTimeout)
				require.Equal(t, SchedulerBaseInterval, cfg.UnifiedAlerting.BaseInterval)
				require.Equal(t, 120*time.Second, cfg.UnifiedAlerting.DefaultRuleEvaluationInterval)
			},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.desc, func(t *testing.T) {
			f := ini.Empty()
			cfg := NewCfg()
			cfg.IsFeatureToggleEnabled = func(key string) bool { return false }
			unifiedAlertingSec, err := f.NewSection("unified_alerting")
			require.NoError(t, err)
			for k, v := range tc.unifiedAlertingOptions {
				_, err = unifiedAlertingSec.NewKey(k, v)
				require.NoError(t, err)
			}
			alertingSec, err := f.NewSection("alerting")
			require.NoError(t, err)
			for k, v := range tc.alertingOptions {
				_, err = alertingSec.NewKey(k, v)
				require.NoError(t, err)
			}
			err = cfg.ReadUnifiedAlertingSettings(f)
			require.NoError(t, err)
			tc.verifyCfg(t, *cfg)
		})
	}
}

func TestMinInterval(t *testing.T) {
	randPredicate := func(predicate func(dur time.Duration) bool) *time.Duration {
		for {
			v := time.Duration(rand.Intn(99)+1) * time.Second
			if predicate(v) {
				return &v
			}
		}
	}

	testCases := []struct {
		desc              string
		minInterval       *time.Duration
		legacyMinInterval *time.Duration
		verifyCfg         func(*testing.T, *Cfg, error)
	}{
		{
			desc:        "should fail if min interval is less than base interval",
			minInterval: randPredicate(func(dur time.Duration) bool { return dur < SchedulerBaseInterval }),
			verifyCfg: func(t *testing.T, cfg *Cfg, err error) {
				require.Error(t, err)
				require.Contains(t, err.Error(), "min_interval")
			},
		},
		{
			desc:        "should fail if min interval is not multiple of base interval",
			minInterval: randPredicate(func(dur time.Duration) bool { return dur > SchedulerBaseInterval && dur%SchedulerBaseInterval != 0 }),
			verifyCfg: func(t *testing.T, cfg *Cfg, err error) {
				require.Error(t, err)
				require.Contains(t, err.Error(), "min_interval")
			},
		},
		{
			desc:        "should not fail if min interval is  multiple of base interval",
			minInterval: randPredicate(func(dur time.Duration) bool { return dur > SchedulerBaseInterval && dur%SchedulerBaseInterval == 0 }),
			verifyCfg: func(t *testing.T, cfg *Cfg, err error) {
				require.NoError(t, err)
			},
		},
		{
			desc:              "should fail if fallback to legacy min interval and it is not multiple of base interval",
			legacyMinInterval: randPredicate(func(dur time.Duration) bool { return dur > SchedulerBaseInterval && dur%SchedulerBaseInterval != 0 }),
			verifyCfg: func(t *testing.T, cfg *Cfg, err error) {
				require.Error(t, err)
				require.Contains(t, err.Error(), "min_interval")
			},
		},
		{
			desc:              "should not fail if fallback to legacy min interval it is multiple of base interval",
			legacyMinInterval: randPredicate(func(dur time.Duration) bool { return dur >= SchedulerBaseInterval && dur%SchedulerBaseInterval == 0 }),
			verifyCfg: func(t *testing.T, cfg *Cfg, err error) {
				require.NoError(t, err)
			},
		},
		{
			desc: "should adjust DefaultRuleEvaluationInterval to min interval if it is greater",
			minInterval: randPredicate(func(dur time.Duration) bool {
				return dur%SchedulerBaseInterval == 0 && dur > DefaultRuleEvaluationInterval
			}),
			verifyCfg: func(t *testing.T, cfg *Cfg, err error) {
				require.Equal(t, cfg.UnifiedAlerting.MinInterval, cfg.UnifiedAlerting.DefaultRuleEvaluationInterval)
			},
		},
		{
			desc:              "should fallback to the default if legacy interval is less than base",
			legacyMinInterval: randPredicate(func(dur time.Duration) bool { return dur < SchedulerBaseInterval }),
			verifyCfg: func(t *testing.T, cfg *Cfg, err error) {
				require.Equal(t, SchedulerBaseInterval, cfg.UnifiedAlerting.MinInterval)
			},
		},
	}

	for _, testCase := range testCases {
		t.Run(testCase.desc, func(t *testing.T) {
			f := ini.Empty()
			if testCase.minInterval != nil {
				section, err := f.NewSection("unified_alerting")
				require.NoError(t, err)
				_, err = section.NewKey("min_interval", testCase.minInterval.String())
				require.NoError(t, err)
			}
			if testCase.legacyMinInterval != nil {
				alertingSec, err := f.NewSection("alerting")
				require.NoError(t, err)
				_, err = alertingSec.NewKey("min_interval_seconds", strconv.Itoa(int(testCase.legacyMinInterval.Seconds())))
				require.NoError(t, err)
			}
			cfg := NewCfg()
			cfg.IsFeatureToggleEnabled = func(key string) bool { return false }
			err := cfg.ReadUnifiedAlertingSettings(f)
			testCase.verifyCfg(t, cfg, err)
		})
	}
}
