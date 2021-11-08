package setting

import (
	"errors"
	"strconv"
	"strings"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend/gtime"
	"github.com/grafana/grafana/pkg/util"

	"github.com/prometheus/alertmanager/cluster"
	"gopkg.in/ini.v1"
)

const (
	alertmanagerDefaultClusterAddr        = "0.0.0.0:9094"
	alertmanagerDefaultPeerTimeout        = 15 * time.Second
	alertmanagerDefaultGossipInterval     = cluster.DefaultGossipInterval
	alertmanagerDefaultPushPullInterval   = cluster.DefaultPushPullInterval
	alertmanagerDefaultConfigPollInterval = 60 * time.Second
	// To start, the alertmanager needs at least one route defined.
	// TODO: we should move this to Grafana settings and define this as the default.
	alertmanagerDefaultConfiguration = `{
	"alertmanager_config": {
		"route": {
			"receiver": "grafana-default-email"
		},
		"receivers": [{
			"name": "grafana-default-email",
			"grafana_managed_receiver_configs": [{
				"uid": "",
				"name": "email receiver",
				"type": "email",
				"isDefault": true,
				"settings": {
					"addresses": "<example@email.com>"
				}
			}]
		}]
	}
}
`
	evaluatorDefaultEvaluationTimeout       = 30 * time.Second
	schedulerDefaultAdminConfigPollInterval = 60 * time.Second
	schedulereDefaultExecuteAlerts          = true
	schedulerDefaultMaxAttempts             = 3
	schedulerDefaultLegacyMinInterval       = 1
	schedulerDefaultMinInterval             = 10 * time.Second
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
	MinInterval                    time.Duration
	EvaluationTimeout              time.Duration
	ExecuteAlerts                  bool
	DefaultConfiguration           string
	Enabled                        bool
	DisabledOrgs                   map[int64]struct{}
}

// ReadUnifiedAlertingSettings reads both the `unified_alerting` and `alerting` sections of the configuration while preferring configuration the `alerting` section.
// It first reads the `unified_alerting` section, then looks for non-defaults on the `alerting` section and prefers those.
func (cfg *Cfg) ReadUnifiedAlertingSettings(iniFile *ini.File) error {
	uaCfg := UnifiedAlertingSettings{}
	ua := iniFile.Section("unified_alerting")
	uaCfg.Enabled = ua.Key("enabled").MustBool(false)

	// TODO: Deprecate this in v8.4, if the old feature toggle ngalert is set, enable Grafana 8 Unified Alerting anyway.
	if !uaCfg.Enabled && cfg.FeatureToggles["ngalert"] {
		cfg.Logger.Warn("ngalert feature flag is deprecated: use unified alerting enabled setting instead")
		uaCfg.Enabled = true
		AlertingEnabled = false
	}

	if uaCfg.Enabled && AlertingEnabled {
		return errors.New("both legacy and Grafana 8 Alerts are enabled")
	}

	uaCfg.DisabledOrgs = make(map[int64]struct{})
	orgsStr := valueAsString(ua, "disabled_orgs", "")
	for _, org := range util.SplitString(orgsStr) {
		orgID, err := strconv.ParseInt(org, 10, 64)
		if err != nil {
			return err
		}
		uaCfg.DisabledOrgs[orgID] = struct{}{}
	}

	var err error
	uaCfg.AdminConfigPollInterval, err = gtime.ParseDuration(valueAsString(ua, "admin_config_poll_interval", (schedulerDefaultAdminConfigPollInterval).String()))
	if err != nil {
		return err
	}
	uaCfg.AlertmanagerConfigPollInterval, err = gtime.ParseDuration(valueAsString(ua, "alertmanager_config_poll_interval", (alertmanagerDefaultConfigPollInterval).String()))
	if err != nil {
		return err
	}
	uaCfg.HAPeerTimeout, err = gtime.ParseDuration(valueAsString(ua, "ha_peer_timeout", (alertmanagerDefaultPeerTimeout).String()))
	if err != nil {
		return err
	}
	uaCfg.HAGossipInterval, err = gtime.ParseDuration(valueAsString(ua, "ha_gossip_interval", (alertmanagerDefaultGossipInterval).String()))
	if err != nil {
		return err
	}
	uaCfg.HAPushPullInterval, err = gtime.ParseDuration(valueAsString(ua, "ha_push_pull_interval", (alertmanagerDefaultPushPullInterval).String()))
	if err != nil {
		return err
	}
	uaCfg.HAListenAddr = ua.Key("ha_listen_address").MustString(alertmanagerDefaultClusterAddr)
	uaCfg.HAAdvertiseAddr = ua.Key("ha_advertise_address").MustString("")
	peers := ua.Key("ha_peers").MustString("")
	uaCfg.HAPeers = make([]string, 0)
	if peers != "" {
		for _, peer := range strings.Split(peers, ",") {
			peer = strings.TrimSpace(peer)
			uaCfg.HAPeers = append(uaCfg.HAPeers, peer)
		}
	}

	// TODO load from ini file
	uaCfg.DefaultConfiguration = alertmanagerDefaultConfiguration

	alerting := iniFile.Section("alerting")

	uaExecuteAlerts := ua.Key("execute_alerts").MustBool(schedulereDefaultExecuteAlerts)
	if uaExecuteAlerts { // unified option equals the default (true)
		legacyExecuteAlerts := alerting.Key("execute_alerts").MustBool(schedulereDefaultExecuteAlerts)
		if !legacyExecuteAlerts {
			cfg.Logger.Warn("falling back to legacy setting of 'execute_alerts'; please use the configuration option in the `unified_alerting` section if Grafana 8 alerts are enabled.")
		}
		uaExecuteAlerts = legacyExecuteAlerts
	}
	uaCfg.ExecuteAlerts = uaExecuteAlerts

	// if the unified alerting options equal the defaults, apply the respective legacy one
	uaEvaluationTimeout, err := gtime.ParseDuration(valueAsString(ua, "evaluation_timeout", evaluatorDefaultEvaluationTimeout.String()))
	if err != nil || uaEvaluationTimeout == evaluatorDefaultEvaluationTimeout { // unified option is invalid duration or equals the default
		legaceEvaluationTimeout := time.Duration(alerting.Key("evaluation_timeout_seconds").MustInt64(int64(evaluatorDefaultEvaluationTimeout.Seconds()))) * time.Second
		if legaceEvaluationTimeout != evaluatorDefaultEvaluationTimeout {
			cfg.Logger.Warn("falling back to legacy setting of 'evaluation_timeout_seconds'; please use the configuration option in the `unified_alerting` section if Grafana 8 alerts are enabled.")
		}
		uaEvaluationTimeout = legaceEvaluationTimeout
	}
	uaCfg.EvaluationTimeout = uaEvaluationTimeout

	uaMaxAttempts := ua.Key("max_attempts").MustInt64(schedulerDefaultMaxAttempts)
	if uaMaxAttempts == schedulerDefaultMaxAttempts { // unified option or equals the default
		legacyMaxAttempts := alerting.Key("max_attempts").MustInt64(schedulerDefaultMaxAttempts)
		if legacyMaxAttempts != schedulerDefaultMaxAttempts {
			cfg.Logger.Warn("falling back to legacy setting of 'max_attempts'; please use the configuration option in the `unified_alerting` section if Grafana 8 alerts are enabled.")
		}
		uaMaxAttempts = legacyMaxAttempts
	}
	uaCfg.MaxAttempts = uaMaxAttempts

	uaMinInterval, err := gtime.ParseDuration(valueAsString(ua, "min_interval", schedulerDefaultMinInterval.String()))
	if err != nil || uaMinInterval == schedulerDefaultMinInterval { // unified option is invalid duration or equals the default
		// if the legacy option is invalid, fallback to 10 (unified alerting min interval default)
		legacyMinInterval := time.Duration(alerting.Key("min_interval_seconds").MustInt64(int64(schedulerDefaultMinInterval.Seconds()))) * time.Second
		if legacyMinInterval != schedulerDefaultLegacyMinInterval {
			cfg.Logger.Warn("falling back to legacy setting of 'min_interval_seconds'; please use the configuration option in the `unified_alerting` section if Grafana 8 alerts are enabled.")
		}
		uaMinInterval = legacyMinInterval
	}
	uaCfg.MinInterval = uaMinInterval

	cfg.UnifiedAlerting = uaCfg
	return nil
}

func GetAlertmanagerDefaultConfiguration() string {
	return alertmanagerDefaultConfiguration
}
