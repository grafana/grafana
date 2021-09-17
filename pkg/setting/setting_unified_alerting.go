package setting

import (
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/components/gtime"

	"github.com/prometheus/alertmanager/cluster"
	"gopkg.in/ini.v1"
)

const (
	AlertmanagerDefaultClusterAddr          = "0.0.0.0:9094"
	AlertmanagerDefaultPeerTimeout          = 15 * time.Second
	AlertmanagerDefaultGossipInterval       = cluster.DefaultGossipInterval
	AlertmanagerDefaultPushPullInterval     = cluster.DefaultPushPullInterval
	SchedulerDefaultAdminConfigPollInterval = 60 * time.Second
	AlertmanagerDefaultConfigPollInterval   = 60 * time.Second
)

func (cfg *Cfg) ReadUnifiedAlertingSettings(iniFile *ini.File) error {
	ua := iniFile.Section("unified_alerting")
	var err error
	cfg.AdminConfigPollInterval, err = gtime.ParseDuration(valueAsString(ua, "admin_config_poll_interval", (SchedulerDefaultAdminConfigPollInterval).String()))
	if err != nil {
		return err
	}
	cfg.AlertmanagerConfigPollInterval, err = gtime.ParseDuration(valueAsString(ua, "alertmanager_config_poll_interval", (AlertmanagerDefaultConfigPollInterval).String()))
	if err != nil {
		return err
	}
	cfg.HAPeerTimeout, err = gtime.ParseDuration(valueAsString(ua, "ha_peer_timeout", (AlertmanagerDefaultPeerTimeout).String()))
	if err != nil {
		return err
	}
	cfg.HAGossipInterval, err = gtime.ParseDuration(valueAsString(ua, "ha_gossip_interval", (AlertmanagerDefaultGossipInterval).String()))
	if err != nil {
		return err
	}
	cfg.HAPushPullInterval, err = gtime.ParseDuration(valueAsString(ua, "ha_push_pull_interval", (AlertmanagerDefaultPushPullInterval).String()))
	if err != nil {
		return err
	}
	cfg.HAListenAddr = ua.Key("ha_listen_address").MustString(AlertmanagerDefaultClusterAddr)
	cfg.HAAdvertiseAddr = ua.Key("ha_advertise_address").MustString("")
	peers := ua.Key("ha_peers").MustString("")
	cfg.HAPeers = make([]string, 0)
	if peers != "" {
		for _, peer := range strings.Split(peers, ",") {
			peer = strings.TrimSpace(peer)
			cfg.HAPeers = append(cfg.HAPeers, peer)
		}
	}

	alerting := iniFile.Section("alerting")

	unifiedAlertingExecuteAlerts := ua.Key("execute_alerts").MustBool(defaultAlertingExecuteAlerts)
	if unifiedAlertingExecuteAlerts { // true by default
		unifiedAlertingExecuteAlerts = alerting.Key("execute_alerts").MustBool(defaultAlertingExecuteAlerts)
	}
	cfg.UnifiedAlertingExecuteAlerts = unifiedAlertingExecuteAlerts

	// if the unified alerting options equal the defaults, apply the respective legacy one
	unifiedEvaluationTimeoutSeconds := ua.Key("evaluation_timeout_seconds").MustInt64(defaultAlertingEvaluationTimeoutSec)
	if unifiedEvaluationTimeoutSeconds == defaultAlertingEvaluationTimeoutSec {
		unifiedEvaluationTimeoutSeconds = alerting.Key("evaluation_timeout_seconds").MustInt64(defaultAlertingEvaluationTimeoutSec)
	}
	cfg.UnifiedAlertingEvaluationTimeout = time.Second * time.Duration(unifiedEvaluationTimeoutSeconds)

	unifiedAlertingMaxAttempts := ua.Key("max_attempts").MustInt64(defaultAlertingMaxAttempts)
	if unifiedAlertingMaxAttempts == defaultAlertingMaxAttempts {
		unifiedAlertingMaxAttempts = alerting.Key("max_attempts").MustInt64(defaultAlertingMaxAttempts)
	}
	cfg.UnifiedAlertingMaxAttempts = unifiedAlertingMaxAttempts

	unifiedAlertingMinInterval := ua.Key("min_interval_seconds").MustInt64(defaultUnifiedAlertingMinInterval)
	if unifiedAlertingMinInterval == defaultUnifiedAlertingMinInterval {
		// if the legacy option is invalid, fallback to 10 (unified alerting min interval default)
		unifiedAlertingMinInterval = alerting.Key("min_interval_seconds").MustInt64(defaultUnifiedAlertingMinInterval)
	}
	cfg.UnifiedAlertingMinInterval = unifiedAlertingMinInterval

	return nil
}
