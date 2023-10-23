package grafanaapiserver

import (
	"fmt"
	"path/filepath"
	"strconv"

	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
)

type config struct {
	enabled bool
	devMode bool

	ip     string
	port   int
	host   string
	apiURL string

	etcdServers []string
	dataPath    string

	logLevel int
}

func newConfig(cfg *setting.Cfg) *config {
	defaultLogLevel := 0
	ip := cfg.HTTPAddr
	apiURL := cfg.AppURL
	port, err := strconv.Atoi(cfg.HTTPPort)
	if err != nil {
		port = 3000
	}

	if cfg.Env == setting.Dev {
		defaultLogLevel = 10
		port = 6443
		ip = "127.0.0.1"
		apiURL = fmt.Sprintf("https://%s:%d", ip, port)
	}

	host := fmt.Sprintf("%s:%d", ip, port)

	return &config{
		enabled:     cfg.IsFeatureToggleEnabled(featuremgmt.FlagGrafanaAPIServer),
		devMode:     cfg.Env == setting.Dev,
		dataPath:    filepath.Join(cfg.DataPath, "grafana-apiserver"),
		ip:          ip,
		port:        port,
		host:        host,
		logLevel:    cfg.SectionWithEnvOverrides("grafana-apiserver").Key("log_level").MustInt(defaultLogLevel),
		etcdServers: cfg.SectionWithEnvOverrides("grafana-apiserver").Key("etcd_servers").Strings(","),
		apiURL:      apiURL,
	}
}
