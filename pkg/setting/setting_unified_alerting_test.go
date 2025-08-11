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
		require.Equal(t, 6*time.Hour, cfg.UnifiedAlerting.HAReconnectTimeout)
		require.Equal(t, alertingDefaultInitializationTimeout, cfg.UnifiedAlerting.InitializationTimeout)
	}

	// With peers set, it correctly parses them.
	{
		require.Len(t, cfg.UnifiedAlerting.HAPeers, 0)
		s, err := cfg.Raw.NewSection("unified_alerting")
		require.NoError(t, err)
		_, err = s.NewKey("ha_peers", "hostname1:9090,hostname2:9090,hostname3:9090")
		require.NoError(t, err)
		_, err = s.NewKey("initialization_timeout", "123s")
		require.NoError(t, err)

		require.NoError(t, cfg.ReadUnifiedAlertingSettings(cfg.Raw))
		require.Len(t, cfg.UnifiedAlerting.HAPeers, 3)
		require.ElementsMatch(t, []string{"hostname1:9090", "hostname2:9090", "hostname3:9090"}, cfg.UnifiedAlerting.HAPeers)
		require.Equal(t, 123*time.Second, cfg.UnifiedAlerting.InitializationTimeout)
	}

	t.Run("should read 'scheduler_tick_interval'", func(t *testing.T) {
		tmp := cfg.IsFeatureToggleEnabled
		t.Cleanup(func() {
			cfg.IsFeatureToggleEnabled = tmp
		})
		cfg.IsFeatureToggleEnabled = func(key string) bool { return key == "configurableSchedulerTick" }

		s, err := cfg.Raw.NewSection("unified_alerting")
		require.NoError(t, err)
		_, err = s.NewKey("scheduler_tick_interval", "1m")
		require.NoError(t, err)
		_, err = s.NewKey("min_interval", "3m")
		require.NoError(t, err)

		require.NoError(t, cfg.ReadUnifiedAlertingSettings(cfg.Raw))
		require.Equal(t, time.Minute, cfg.UnifiedAlerting.BaseInterval)
		require.Equal(t, 3*time.Minute, cfg.UnifiedAlerting.MinInterval)

		t.Run("and fail if it is wrong", func(t *testing.T) {
			_, err = s.NewKey("scheduler_tick_interval", "test")
			require.NoError(t, err)

			require.Error(t, cfg.ReadUnifiedAlertingSettings(cfg.Raw))
		})

		t.Run("and use default if not specified", func(t *testing.T) {
			s.DeleteKey("scheduler_tick_interval")
			require.NoError(t, cfg.ReadUnifiedAlertingSettings(cfg.Raw))

			require.Equal(t, SchedulerBaseInterval, cfg.UnifiedAlerting.BaseInterval)
		})
	})
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
				"execute_alerts":             strconv.FormatBool(schedulerDefaultExecuteAlerts),
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
				"min_interval":               SchedulerBaseInterval.String(),
				"execute_alerts":             strconv.FormatBool(schedulerDefaultExecuteAlerts),
				"evaluation_timeout":         evaluatorDefaultEvaluationTimeout.String(),
			},
			alertingOptions: map[string]string{
				"max_attempts":               "1", // Note: Ignored, setting does not exist.
				"min_interval_seconds":       "120",
				"execute_alerts":             "true",
				"evaluation_timeout_seconds": "160",
			},
			verifyCfg: func(t *testing.T, cfg Cfg) {
				require.Equal(t, 120*time.Second, cfg.UnifiedAlerting.AdminConfigPollInterval)
				require.Equal(t, int64(3), cfg.UnifiedAlerting.MaxAttempts)
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
				require.Equal(t, schedulerDefaultExecuteAlerts, cfg.UnifiedAlerting.ExecuteAlerts)
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
				"max_attempts":               "1", // Note: Ignored, setting does not exist.
				"min_interval_seconds":       "120",
				"execute_alerts":             "false",
				"evaluation_timeout_seconds": "160",
			},
			verifyCfg: func(t *testing.T, cfg Cfg) {
				require.Equal(t, alertmanagerDefaultConfigPollInterval, cfg.UnifiedAlerting.AdminConfigPollInterval)
				require.Equal(t, int64(3), cfg.UnifiedAlerting.MaxAttempts)
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

func TestHARedisTLSSettings(t *testing.T) {
	// Initialize .ini file with new HA Redis TLS Settings
	f := ini.Empty()
	section, err := f.NewSection("unified_alerting")
	require.NoError(t, err)

	const (
		tlsEnabled         = true
		certPath           = "path/to/cert"
		keyPath            = "path/to/key"
		caPath             = "path/to/ca"
		serverName         = "server_name"
		insecureSkipVerify = true
		cipherSuites       = "TLS_AES_128_GCM_SHA256"
		minVersion         = "VersionTLS13"
	)
	_, err = section.NewKey("ha_redis_tls_enabled", strconv.FormatBool(tlsEnabled))
	require.NoError(t, err)
	_, err = section.NewKey("ha_redis_tls_cert_path", certPath)
	require.NoError(t, err)
	_, err = section.NewKey("ha_redis_tls_key_path", keyPath)
	require.NoError(t, err)
	_, err = section.NewKey("ha_redis_tls_ca_path", caPath)
	require.NoError(t, err)
	_, err = section.NewKey("ha_redis_tls_server_name", serverName)
	require.NoError(t, err)
	_, err = section.NewKey("ha_redis_tls_insecure_skip_verify", strconv.FormatBool(insecureSkipVerify))
	require.NoError(t, err)
	_, err = section.NewKey("ha_redis_tls_cipher_suites", cipherSuites)
	require.NoError(t, err)
	_, err = section.NewKey("ha_redis_tls_min_version", minVersion)
	require.NoError(t, err)

	cfg := NewCfg()
	err = cfg.ReadUnifiedAlertingSettings(f)
	require.Nil(t, err)

	require.Equal(t, tlsEnabled, cfg.UnifiedAlerting.HARedisTLSEnabled)
	require.Equal(t, certPath, cfg.UnifiedAlerting.HARedisTLSConfig.CertPath)
	require.Equal(t, keyPath, cfg.UnifiedAlerting.HARedisTLSConfig.KeyPath)
	require.Equal(t, caPath, cfg.UnifiedAlerting.HARedisTLSConfig.CAPath)
	require.Equal(t, serverName, cfg.UnifiedAlerting.HARedisTLSConfig.ServerName)
	require.Equal(t, insecureSkipVerify, cfg.UnifiedAlerting.HARedisTLSConfig.InsecureSkipVerify)
	require.Equal(t, cipherSuites, cfg.UnifiedAlerting.HARedisTLSConfig.CipherSuites)
	require.Equal(t, minVersion, cfg.UnifiedAlerting.HARedisTLSConfig.MinVersion)
}

func TestHARedisSentinelModeSettings(t *testing.T) {
	testCases := []struct {
		desc                       string
		haRedisSentinelModeEnabled bool
		haRedisClusterModeEnabled  bool
		haRedisSentinelMasterName  string
		haRedisSentinelUsername    string
		haRedisSentinelPassword    string
		expectedErr                error
	}{
		{
			desc:                       "should not fail when Sentinel mode is enabled and master name is set",
			haRedisSentinelModeEnabled: true,
			haRedisSentinelMasterName:  "exampleMasterName",
		},
		{
			desc:                       "should not fail when Sentinel mode is enabled, master name is set, and Sentinel username and password are provided",
			haRedisSentinelModeEnabled: true,
			haRedisSentinelMasterName:  "exampleMasterName",
			haRedisSentinelUsername:    "exampleSentinelUsername",
			haRedisSentinelPassword:    "exampleSentinelPassword",
		},
		{
			desc:                       "should fail when Sentinel mode is enabled but master name is not set",
			haRedisSentinelModeEnabled: true,
			expectedErr:                errHARedisSentinelMasterNameRequired,
		},
		{
			desc:                       "should fail when both Sentinel mode and Cluster mode are enabled",
			haRedisSentinelModeEnabled: true,
			haRedisClusterModeEnabled:  true,
			expectedErr:                errHARedisBothClusterAndSentinel,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.desc, func(t *testing.T) {
			f := ini.Empty()
			section, err := f.NewSection("unified_alerting")
			require.NoError(t, err)

			_, err = section.NewKey("ha_redis_sentinel_mode_enabled", strconv.FormatBool(tc.haRedisSentinelModeEnabled))
			require.NoError(t, err)
			_, err = section.NewKey("ha_redis_cluster_mode_enabled", strconv.FormatBool(tc.haRedisClusterModeEnabled))
			require.NoError(t, err)
			_, err = section.NewKey("ha_redis_sentinel_master_name", tc.haRedisSentinelMasterName)
			require.NoError(t, err)
			_, err = section.NewKey("ha_redis_sentinel_username", tc.haRedisSentinelUsername)
			require.NoError(t, err)
			_, err = section.NewKey("ha_redis_sentinel_password", tc.haRedisSentinelPassword)
			require.NoError(t, err)

			cfg := NewCfg()
			err = cfg.ReadUnifiedAlertingSettings(f)
			if tc.expectedErr == nil {
				require.NoError(t, err)
			} else {
				require.ErrorIs(t, err, tc.expectedErr)
				return
			}

			require.Equal(t, tc.haRedisSentinelModeEnabled, cfg.UnifiedAlerting.HARedisSentinelModeEnabled)
			require.Equal(t, tc.haRedisSentinelMasterName, cfg.UnifiedAlerting.HARedisSentinelMasterName)
			require.Equal(t, tc.haRedisSentinelUsername, cfg.UnifiedAlerting.HARedisSentinelUsername)
			require.Equal(t, tc.haRedisSentinelPassword, cfg.UnifiedAlerting.HARedisSentinelPassword)
		})
	}
}
