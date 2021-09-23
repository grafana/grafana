package setting

import (
	"strings"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend/gtime"

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
	// To start, the alertmanager needs at least one route defined.
	// TODO: we should move this to Grafana settings and define this as the default.
	AlertmanagerDefaultConfiguration = `{
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
	DefaultConfiguration           string
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
	// TODO load from ini file
	uaCfg.DefaultConfiguration = AlertmanagerDefaultConfiguration
	cfg.UnifiedAlerting = uaCfg
	return nil
}
