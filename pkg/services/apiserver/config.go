package apiserver

import (
	"fmt"
	"net"
	"path/filepath"
	"strconv"

	"github.com/grafana/grafana/pkg/services/apiserver/options"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
)

func applyGrafanaConfig(cfg *setting.Cfg, features featuremgmt.FeatureToggles, o *options.Options) {
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

	o.RecommendedOptions.Etcd.StorageConfig.Transport.ServerList = cfg.SectionWithEnvOverrides("grafana-apiserver").Key("etcd_servers").Strings(",")

	o.RecommendedOptions.SecureServing.BindAddress = ip
	o.RecommendedOptions.SecureServing.BindPort = port
	o.RecommendedOptions.Authentication.RemoteKubeConfigFileOptional = true
	o.RecommendedOptions.Authorization.RemoteKubeConfigFileOptional = true

	o.RecommendedOptions.Admission = nil
	o.RecommendedOptions.CoreAPI = nil

	o.StorageOptions.StorageType = options.StorageType(cfg.SectionWithEnvOverrides("grafana-apiserver").Key("storage_type").MustString(string(options.StorageTypeLegacy)))
	o.StorageOptions.DataPath = filepath.Join(cfg.DataPath, "grafana-apiserver")
	o.ExtraOptions.DevMode = features.IsEnabledGlobally(featuremgmt.FlagGrafanaAPIServerEnsureKubectlAccess)
	o.ExtraOptions.ExternalAddress = host
	o.ExtraOptions.APIURL = apiURL
	o.ExtraOptions.Verbosity = defaultLogLevel
}
