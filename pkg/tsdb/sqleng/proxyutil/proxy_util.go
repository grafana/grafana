package proxyutil

import (
	sdkproxy "github.com/grafana/grafana-plugin-sdk-go/backend/proxy"
	"github.com/grafana/grafana/pkg/tsdb/sqleng"
)

func GetSQLProxyOptions(dsInfo sqleng.DataSourceInfo) *sdkproxy.Options {
	return &sdkproxy.Options{
		Enabled: dsInfo.JsonData.SecureDSProxy,
		Auth: &sdkproxy.AuthOptions{
			Username: dsInfo.UID,
		},
	}
}
