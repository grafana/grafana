package setting

import (
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
		require.Equal(t, 60*time.Second, cfg.UnifiedAlerting.AdminConfigPollInterval)
		require.Equal(t, 60*time.Second, cfg.UnifiedAlerting.AlertmanagerConfigPollInterval)
		require.Equal(t, 15*time.Second, cfg.UnifiedAlerting.HAPeerTimeout)
		require.Equal(t, "0.0.0.0:9094", cfg.UnifiedAlerting.HAListenAddr)
		require.Equal(t, "", cfg.UnifiedAlerting.HAAdvertiseAddr)
		require.Len(t, cfg.UnifiedAlerting.HAPeers, 0)
		require.Equal(t, 200*time.Millisecond, cfg.UnifiedAlerting.HAGossipInterval)
		require.Equal(t, 60*time.Second, cfg.UnifiedAlerting.HAPushPullInterval)
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
				require.Equal(t, 60*time.Second, cfg.UnifiedAlerting.MinInterval)
				require.Equal(t, false, cfg.UnifiedAlerting.ExecuteAlerts)
				require.Equal(t, 90*time.Second, cfg.UnifiedAlerting.EvaluationTimeout)
			},
		},
		{
			desc: "when the unified options equal the defaults, it should apply the legacy ones",
			unifiedAlertingOptions: map[string]string{
				"admin_config_poll_interval": "120s",
				"max_attempts":               strconv.FormatInt(schedulerDefaultMaxAttempts, 10),
				"min_interval":               schedulerDefaultMinInterval.String(),
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
				require.Equal(t, schedulerDefaultMinInterval, cfg.UnifiedAlerting.MinInterval)
				require.Equal(t, schedulereDefaultExecuteAlerts, cfg.UnifiedAlerting.ExecuteAlerts)
				require.Equal(t, evaluatorDefaultEvaluationTimeout, cfg.UnifiedAlerting.EvaluationTimeout)
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
