package setting

import (
	"slices"
	"strings"

	"gopkg.in/ini.v1"
)

type MeticulousSettings struct {
	Enabled        bool
	Production     bool
	RecordingToken string
	AllowedHosts   []string
}

func (cfg *Cfg) readMeticulousSettings(file *ini.File) {
	section := file.Section("meticulous")
	cfg.Meticulous = MeticulousSettings{
		Enabled:        section.Key("enabled").MustBool(false),
		Production:     section.Key("production").MustBool(true),
		RecordingToken: section.Key("recording_token").String(),
	}
	for _, host := range strings.Split(section.Key("allowed_hosts").String(), ",") {
		if host = strings.TrimSpace(host); host != "" {
			cfg.Meticulous.AllowedHosts = append(cfg.Meticulous.AllowedHosts, host)
		}
	}
}

func (cfg MeticulousSettings) EnabledForHost(host string) bool {
	return cfg.Enabled && cfg.RecordingToken != "" &&
		(len(cfg.AllowedHosts) == 0 || slices.Contains(cfg.AllowedHosts, host))
}
