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
		port = 6443
		ip = net.ParseIP("0.0.0.0")
		apiURL = fmt.Sprintf("https://%s:%d", ip, port)
	}

	// if grafana log level is set to debug, also increase the api server log level to 7,
	// which will log the request headers & more details about the request
	if cfg.Raw.Section("log").Key("level").MustString("info") == "debug" {
		defaultLogLevel = 7
	}

	host := net.JoinHostPort(cfg.HTTPAddr, strconv.Itoa(port))

	apiserverCfg := cfg.SectionWithEnvOverrides("grafana-apiserver")

	runtimeConfig := apiserverCfg.Key("runtime_config").String()
	if runtimeConfig != "" {
		if err := o.APIEnablementOptions.RuntimeConfig.Set(runtimeConfig); err != nil {
			return fmt.Errorf("failed to set runtime config: %w", err)
		}
	}

	o.RecommendedOptions.Etcd.StorageConfig.Transport.ServerList = apiserverCfg.Key("etcd_servers").Strings(",")

	o.RecommendedOptions.SecureServing.BindAddress = ip
	o.RecommendedOptions.SecureServing.BindPort = port
	o.RecommendedOptions.Authentication.RemoteKubeConfigFileOptional = true
	o.RecommendedOptions.Authorization.RemoteKubeConfigFileOptional = true

	o.RecommendedOptions.Admission = nil
	o.RecommendedOptions.CoreAPI = nil

	// nolint:staticcheck
	o.StorageOptions.StorageType = options.StorageType(apiserverCfg.Key("storage_type").MustString(string(options.StorageTypeUnified)))
	o.StorageOptions.DataPath = apiserverCfg.Key("storage_path").MustString(filepath.Join(cfg.DataPath, "grafana-apiserver"))
	o.StorageOptions.Address = apiserverCfg.Key("address").MustString(o.StorageOptions.Address)
	o.StorageOptions.BlobStoreURL = apiserverCfg.Key("blob_url").MustString(o.StorageOptions.BlobStoreURL)
	o.StorageOptions.BlobThresholdBytes = apiserverCfg.Key("blob_threshold_bytes").MustInt(o.StorageOptions.BlobThresholdBytes)

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
