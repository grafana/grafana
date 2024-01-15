package proxyutil

import (
	sdkproxy "github.com/grafana/grafana-plugin-sdk-go/backend/proxy"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tsdb/sqleng"
)

func GetSQLProxyOptions(cfg setting.SecureSocksDSProxySettings, dsInfo sqleng.DataSourceInfo) *sdkproxy.Options {
	opts := &sdkproxy.Options{
		Enabled: dsInfo.JsonData.SecureDSProxy && cfg.Enabled,
		Auth: &sdkproxy.AuthOptions{
			Username: dsInfo.UID,
		},
		ClientCfg: &sdkproxy.ClientCfg{
			ClientCert:    cfg.ClientCert,
			ClientKey:     cfg.ClientKey,
			ServerName:    cfg.ServerName,
			RootCA:        cfg.RootCA,
			ProxyAddress:  cfg.ProxyAddress,
			AllowInsecure: cfg.AllowInsecure,
		},
	}
	if dsInfo.JsonData.SecureDSProxyUsername != "" {
		opts.Auth.Username = dsInfo.JsonData.SecureDSProxyUsername
	}
	return opts
}
