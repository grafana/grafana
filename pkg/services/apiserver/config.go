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

func applyGrafanaConfig(cfg *setting.Cfg, features featuremgmt.FeatureToggles, o *options.Options) error {
	defaultLogLevel := 0
	ip := net.ParseIP(cfg.HTTPAddr)
	if ip == nil {
		return fmt.Errorf("invalid IP address: %s", cfg.HTTPAddr)
	}
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

	host := net.JoinHostPort(cfg.HTTPAddr, strconv.Itoa(port))

	apiserverCfg := cfg.SectionWithEnvOverrides("grafana-apiserver")

	o.RecommendedOptions.Etcd.StorageConfig.Transport.ServerList = apiserverCfg.Key("etcd_servers").Strings(",")

	o.RecommendedOptions.SecureServing.BindAddress = ip
	o.RecommendedOptions.SecureServing.BindPort = port
	o.RecommendedOptions.Authentication.RemoteKubeConfigFileOptional = true
	o.RecommendedOptions.Authorization.RemoteKubeConfigFileOptional = true

	o.KubeAggregatorOptions.ProxyClientCertFile = apiserverCfg.Key("proxy_client_cert_file").MustString("")
	o.KubeAggregatorOptions.ProxyClientKeyFile = apiserverCfg.Key("proxy_client_key_file").MustString("")

	o.KubeAggregatorOptions.APIServiceCABundleFile = apiserverCfg.Key("apiservice_ca_bundle_file").MustString("")
	o.KubeAggregatorOptions.RemoteServicesFile = apiserverCfg.Key("remote_services_file").MustString("")

	o.RecommendedOptions.Admission = nil
	o.RecommendedOptions.CoreAPI = nil

	o.StorageOptions.StorageType = options.StorageType(apiserverCfg.Key("storage_type").MustString(string(options.StorageTypeLegacy)))
	o.StorageOptions.DataPath = apiserverCfg.Key("storage_path").MustString(filepath.Join(cfg.DataPath, "grafana-apiserver"))
	o.StorageOptions.Address = apiserverCfg.Key("address").MustString(o.StorageOptions.Address)

	// unified storage configs look like
	// [unified_storage.<group>.<resource>]
	// config = <value>
	unifiedStorageCfg := cfg.UnifiedStorage
	o.StorageOptions.UnifiedStorageConfig = unifiedStorageCfg

	o.ExtraOptions.DevMode = features.IsEnabledGlobally(featuremgmt.FlagGrafanaAPIServerEnsureKubectlAccess)
	o.ExtraOptions.ExternalAddress = host
	o.ExtraOptions.APIURL = apiURL
	o.ExtraOptions.Verbosity = apiserverCfg.Key("log_level").MustInt(defaultLogLevel)
	return nil
}
