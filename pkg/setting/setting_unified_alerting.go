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

	return nil
}
