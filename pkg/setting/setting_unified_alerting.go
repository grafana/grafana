package setting

import (
	"errors"
	"fmt"
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
	screenshotsDefaultEnabled               = false
	screenshotsDefaultMaxConcurrent         = 5
	screenshotsDefaultUploadImageStorage    = false
	// SchedulerBaseInterval base interval of the scheduler. Controls how often the scheduler fetches database for new changes as well as schedules evaluation of a rule
	// changing this value is discouraged because this could cause existing alert definition
	// with intervals that are not exactly divided by this number not to be evaluated
	SchedulerBaseInterval = 10 * time.Second
	// DefaultRuleEvaluationInterval indicates a default interval of for how long a rule should be evaluated to change state from Pending to Alerting
	DefaultRuleEvaluationInterval = SchedulerBaseInterval * 6 // == 60 seconds
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
	Enabled                        *bool // determines whether unified alerting is enabled. If it is nil then user did not define it and therefore its value will be determined during migration. Services should not use it directly.
	DisabledOrgs                   map[int64]struct{}
	// BaseInterval interval of time the scheduler updates the rules and evaluates rules.
	// Only for internal use and not user configuration.
	BaseInterval time.Duration
	// DefaultRuleEvaluationInterval default interval between evaluations of a rule.
	DefaultRuleEvaluationInterval time.Duration
	Screenshots                   UnifiedAlertingScreenshotSettings
}

type UnifiedAlertingScreenshotSettings struct {
	Enabled                    bool
	MaxConcurrentScreenshots   int64
	UploadExternalImageStorage bool
}

// IsEnabled returns true if UnifiedAlertingSettings.Enabled is either nil or true.
// It hides the implementation details of the Enabled and simplifies its usage.
func (u *UnifiedAlertingSettings) IsEnabled() bool {
	return u.Enabled == nil || *u.Enabled
}

func (cfg *Cfg) readUnifiedAlertingEnabledSetting(section *ini.Section) (*bool, error) {
	enabled, err := section.Key("enabled").Bool()
	// the unified alerting is not enabled by default. First, check the feature flag
	if err != nil {
		// TODO: Remove in Grafana v9
		if cfg.IsFeatureToggleEnabled("ngalert") {
			cfg.Logger.Warn("ngalert feature flag is deprecated: use unified alerting enabled setting instead")
			enabled = true
			// feature flag overrides the legacy alerting setting.
			legacyAlerting := false
			AlertingEnabled = &legacyAlerting
			return &enabled, nil
		}
		if IsEnterprise {
			enabled = false
			if AlertingEnabled == nil {
				legacyEnabled := true
				AlertingEnabled = &legacyEnabled
			}
			return &enabled, nil
		}
		// next, check whether legacy flag is set
		if AlertingEnabled != nil && !*AlertingEnabled {
			enabled = true
			return &enabled, nil // if legacy alerting is explicitly disabled, enable the unified alerting by default.
		}
		// NOTE: If the enabled flag is still not defined, the final decision is made during migration (see sqlstore.migrations.ualert.CheckUnifiedAlertingEnabledByDefault).
		cfg.Logger.Info("The state of unified alerting is still not defined. The decision will be made during as we run the database migrations")
		return nil, nil // the flag is not defined
	}

	// If unified alerting is defined explicitly as well as legacy alerting and both are enabled, return error.
	if enabled && AlertingEnabled != nil && *AlertingEnabled {
		return nil, errors.New("both legacy and Grafana 8 Alerts are enabled. Disable one of them and restart")
	}
	// if legacy alerting is not defined but unified is determined then update the legacy with inverted value
	if AlertingEnabled == nil {
		legacyEnabled := !enabled
		AlertingEnabled = &legacyEnabled
	}
	return &enabled, nil
}

// ReadUnifiedAlertingSettings reads both the `unified_alerting` and `alerting` sections of the configuration while preferring configuration the `alerting` section.
// It first reads the `unified_alerting` section, then looks for non-defaults on the `alerting` section and prefers those.
func (cfg *Cfg) ReadUnifiedAlertingSettings(iniFile *ini.File) error {
	var err error
	uaCfg := UnifiedAlertingSettings{}
	ua := iniFile.Section("unified_alerting")
	uaCfg.Enabled, err = cfg.readUnifiedAlertingEnabledSetting(ua)
	if err != nil {
		return err
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

	uaCfg.BaseInterval = SchedulerBaseInterval

	uaMinInterval, err := gtime.ParseDuration(valueAsString(ua, "min_interval", uaCfg.BaseInterval.String()))
	if err != nil || uaMinInterval == uaCfg.BaseInterval { // unified option is invalid duration or equals the default
		// if the legacy option is invalid, fallback to 10 (unified alerting min interval default)
		legacyMinInterval := time.Duration(alerting.Key("min_interval_seconds").MustInt64(int64(uaCfg.BaseInterval.Seconds()))) * time.Second
		if legacyMinInterval > uaCfg.BaseInterval {
			cfg.Logger.Warn("falling back to legacy setting of 'min_interval_seconds'; please use the configuration option in the `unified_alerting` section if Grafana 8 alerts are enabled.")
			uaMinInterval = legacyMinInterval
		} else {
			// if legacy interval is smaller than the base interval, adjust it to the base interval
			uaMinInterval = uaCfg.BaseInterval
		}
	}

	if uaMinInterval < uaCfg.BaseInterval {
		return fmt.Errorf("value of setting 'min_interval' should be greater than the base interval (%v)", uaCfg.BaseInterval)
	}
	if uaMinInterval%uaCfg.BaseInterval != 0 {
		return fmt.Errorf("value of setting 'min_interval' should be times of base interval (%v)", uaCfg.BaseInterval)
	}
	uaCfg.MinInterval = uaMinInterval

	uaCfg.DefaultRuleEvaluationInterval = DefaultRuleEvaluationInterval
	if uaMinInterval > uaCfg.DefaultRuleEvaluationInterval {
		uaCfg.DefaultRuleEvaluationInterval = uaMinInterval
	}

	screenshots := iniFile.Section("unified_alerting.screenshots")
	uaCfgScreenshots := uaCfg.Screenshots

	uaCfgScreenshots.Enabled = screenshots.Key("enabled").MustBool(screenshotsDefaultEnabled)
	uaCfgScreenshots.MaxConcurrentScreenshots = screenshots.Key("max_concurrent_screenshots").MustInt64(screenshotsDefaultMaxConcurrent)
	uaCfgScreenshots.UploadExternalImageStorage = screenshots.Key("upload_external_image_storage").MustBool(screenshotsDefaultUploadImageStorage)
	uaCfg.Screenshots = uaCfgScreenshots

	cfg.UnifiedAlerting = uaCfg
	return nil
}

func GetAlertmanagerDefaultConfiguration() string {
	return alertmanagerDefaultConfiguration
}
