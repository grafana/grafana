package grafanaapiserver

import (
	"fmt"
	"net"
	"path/filepath"
	"strconv"

	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
)

type config struct {
	enabled bool
	devMode bool

	ip     net.IP
	port   int
	host   string
	apiURL string

	storageType StorageType

	etcdServers []string
	dataPath    string

	aggregationEnabled        bool
	requestHeaderClientCAFile string

	logLevel int
}

func newConfig(cfg *setting.Cfg, features featuremgmt.FeatureToggles) *config {
	defaultLogLevel := 0
	ip := net.ParseIP(cfg.HTTPAddr)
	apiURL := cfg.AppURL
	port, err := strconv.Atoi(cfg.HTTPPort)
	if err != nil {
		port = 3000
	}

	if cfg.Env == setting.Dev {
		defaultLogLevel = 10
		port = 6443
		ip = net.ParseIP("127.0.0.1")
		apiURL = fmt.Sprintf("https://%s:%d", ip, port)
	}

	host := fmt.Sprintf("%s:%d", ip, port)

	return &config{
		enabled:                   features.IsEnabledGlobally(featuremgmt.FlagGrafanaAPIServer),
		devMode:                   features.IsEnabledGlobally(featuremgmt.FlagGrafanaAPIServerEnsureKubectlAccess),
		dataPath:                  filepath.Join(cfg.DataPath, "grafana-apiserver"),
		aggregationEnabled:        cfg.SectionWithEnvOverrides("grafana-apiserver").Key("aggregation_enabled").MustBool(),
		requestHeaderClientCAFile: cfg.SectionWithEnvOverrides("grafana-apiserver").Key("request_header_client_ca_file").MustString(filepath.Join(cfg.DataPath, "devenv-kind", "requestheader-client-ca-file")),
		ip:                        ip,
		port:                      port,
		host:                      host,
		logLevel:                  cfg.SectionWithEnvOverrides("grafana-apiserver").Key("log_level").MustInt(defaultLogLevel),
		etcdServers:               cfg.SectionWithEnvOverrides("grafana-apiserver").Key("etcd_servers").Strings(","),
		storageType:               StorageType(cfg.SectionWithEnvOverrides("grafana-apiserver").Key("storage_type").MustString(string(StorageTypeLegacy))),
		apiURL:                    apiURL,
	}
}
