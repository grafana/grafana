package grafanaapiserver

import (
	"fmt"
	"path/filepath"

	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
)

type config struct {
	enabled bool
	devMode bool

	host        string
	appURL      string
	etcdServers []string
	dataPath    string

	logLevel int
}

func newConfig(cfg *setting.Cfg) *config {
	defaultLogLevel := 0
	if cfg.Env == setting.Dev {
		defaultLogLevel = 10
	}

	return &config{
		enabled:     cfg.IsFeatureToggleEnabled(featuremgmt.FlagGrafanaAPIServer),
		devMode:     cfg.Env == setting.Dev,
		dataPath:    filepath.Join(cfg.DataPath, "grafana-apiserver"),
		host:        fmt.Sprintf("%s:%s", cfg.HTTPAddr, cfg.HTTPPort),
		logLevel:    cfg.SectionWithEnvOverrides("grafana-apiserver").Key("log_level").MustInt(defaultLogLevel),
		etcdServers: cfg.SectionWithEnvOverrides("grafana-apiserver").Key("etcd_servers").Strings(","),
		appURL:      cfg.AppURL,
	}
}
