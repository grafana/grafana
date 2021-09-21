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

type UnifiedAlertingSettings struct {
	AdminConfigPollInterval        time.Duration
	AlertmanagerConfigPollInterval time.Duration
	HAListenAddr                   string
	HAAdvertiseAddr                string
	HAPeers                        []string
	HAPeerTimeout                  time.Duration
	HAGossipInterval               time.Duration
	HAPushPullInterval             time.Duration
	MaxAttempts                    int64
	MinInterval                    int64
	EvaluationTimeout              time.Duration
	ExecuteAlerts                  bool
}

func (cfg *Cfg) ReadUnifiedAlertingSettings(iniFile *ini.File) error {
	uaCfg := UnifiedAlertingSettings{}
	ua := iniFile.Section("unified_alerting")
	var err error
	uaCfg.AdminConfigPollInterval, err = gtime.ParseDuration(valueAsString(ua, "admin_config_poll_interval", (SchedulerDefaultAdminConfigPollInterval).String()))
	if err != nil {
		return err
	}
	uaCfg.AlertmanagerConfigPollInterval, err = gtime.ParseDuration(valueAsString(ua, "alertmanager_config_poll_interval", (AlertmanagerDefaultConfigPollInterval).String()))
	if err != nil {
		return err
	}
	uaCfg.HAPeerTimeout, err = gtime.ParseDuration(valueAsString(ua, "ha_peer_timeout", (AlertmanagerDefaultPeerTimeout).String()))
	if err != nil {
		return err
	}
	uaCfg.HAGossipInterval, err = gtime.ParseDuration(valueAsString(ua, "ha_gossip_interval", (AlertmanagerDefaultGossipInterval).String()))
	if err != nil {
		return err
	}
	uaCfg.HAPushPullInterval, err = gtime.ParseDuration(valueAsString(ua, "ha_push_pull_interval", (AlertmanagerDefaultPushPullInterval).String()))
	if err != nil {
		return err
	}
	uaCfg.HAListenAddr = ua.Key("ha_listen_address").MustString(AlertmanagerDefaultClusterAddr)
	uaCfg.HAAdvertiseAddr = ua.Key("ha_advertise_address").MustString("")
	peers := ua.Key("ha_peers").MustString("")
	uaCfg.HAPeers = make([]string, 0)
	if peers != "" {
		for _, peer := range strings.Split(peers, ",") {
			peer = strings.TrimSpace(peer)
			uaCfg.HAPeers = append(uaCfg.HAPeers, peer)
		}
	}

	alerting := iniFile.Section("alerting")

	uaExecuteAlerts := ua.Key("execute_alerts").MustBool(defaultAlertingExecuteAlerts)
	if uaExecuteAlerts { // true by default
		uaExecuteAlerts = alerting.Key("execute_alerts").MustBool(defaultAlertingExecuteAlerts)
	}
	uaCfg.ExecuteAlerts = uaExecuteAlerts

	// if the unified alerting options equal the defaults, apply the respective legacy one
	uaEvaluationTimeoutSeconds := ua.Key("evaluation_timeout_seconds").MustInt64(defaultAlertingEvaluationTimeoutSec)
	if uaEvaluationTimeoutSeconds == defaultAlertingEvaluationTimeoutSec {
		uaEvaluationTimeoutSeconds = alerting.Key("evaluation_timeout_seconds").MustInt64(defaultAlertingEvaluationTimeoutSec)
	}
	uaCfg.EvaluationTimeout = time.Second * time.Duration(uaEvaluationTimeoutSeconds)

	uaMaxAttempts := ua.Key("max_attempts").MustInt64(defaultAlertingMaxAttempts)
	if uaMaxAttempts == defaultAlertingMaxAttempts {
		uaMaxAttempts = alerting.Key("max_attempts").MustInt64(defaultAlertingMaxAttempts)
	}
	uaCfg.MaxAttempts = uaMaxAttempts

	uaMinInterval := ua.Key("min_interval_seconds").MustInt64(defaultUnifiedAlertingMinInterval)
	if uaMinInterval == defaultUnifiedAlertingMinInterval {
		// if the legacy option is invalid, fallback to 10 (unified alerting min interval default)
		uaMinInterval = alerting.Key("min_interval_seconds").MustInt64(defaultUnifiedAlertingMinInterval)
	}
	uaCfg.MinInterval = uaMinInterval

	cfg.UnifiedAlerting = uaCfg
	return nil
}
