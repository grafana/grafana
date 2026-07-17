package pluginproxy

import (
	"context"

	"github.com/grafana/grafana-azure-sdk-go/v2/azsettings"

	"github.com/grafana/grafana/pkg/setting"
)

type DataSourceProxySettings struct {
	SendUserHeader            bool
	DataProxyUserAgent        string
	DataProxyForwardUserAgent bool
	LoginCookieName           string
	DataProxyLogging          bool
	DataProxyWhiteList        map[string]bool

	// Load azure settings (avoid fetching the settings unless we are running azure)
	GetAzureSettings func(context.Context) (*azsettings.AzureSettings, error)
}

func NewDataSourceProxySettings(cfg *setting.Cfg) *DataSourceProxySettings {
	return &DataSourceProxySettings{
		SendUserHeader:            cfg.SendUserHeader,
		DataProxyUserAgent:        cfg.DataProxyUserAgent,
		DataProxyForwardUserAgent: cfg.DataProxyForwardUserAgent,
		LoginCookieName:           cfg.LoginCookieName,
		DataProxyLogging:          cfg.DataProxyLogging,
		DataProxyWhiteList:        cfg.DataProxyWhiteList,

		GetAzureSettings: func(context.Context) (*azsettings.AzureSettings, error) {
			return cfg.Azure, nil
		},
	}
}
