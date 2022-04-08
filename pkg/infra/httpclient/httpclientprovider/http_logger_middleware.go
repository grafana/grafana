package httpclientprovider

import (
	"net/http"

	sdkhttpclient "github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	httplogger "github.com/grafana/grafana-plugin-sdk-go/experimental/http_logger"
	"github.com/grafana/grafana/pkg/setting"
)

const HTTPLoggerMiddlewareName = "http-logger"

func HTTPLoggerMiddleware(cfg setting.PluginSettings) sdkhttpclient.Middleware {
	return sdkhttpclient.NamedMiddlewareFunc(HTTPLoggerMiddlewareName, func(opts sdkhttpclient.Options, next http.RoundTripper) http.RoundTripper {
		datasourceType, exists := opts.Labels["datasource_type"]
		if !exists {
			return next
		}

		enabled, path := getLoggerSettings(datasourceType, cfg)
		if !enabled {
			return next
		}

		hl := httplogger.
			NewHTTPLogger(datasourceType, next).
			WithEnabledCheck(func() bool { return true })

		if path != "" {
			hl = hl.WithPath(path)
		}

		return hl
	})
}

func httpLoggingEnabled(cfg setting.PluginSettings) bool {
	for _, settings := range cfg {
		if enabled := settings["har_log_enabled"]; enabled == "true" {
			return true
		}
	}
	return false
}

func getLoggerSettings(datasourceType string, cfg setting.PluginSettings) (enabled bool, path string) {
	settings, ok := cfg[datasourceType]
	if !ok {
		return
	}
	if e, ok := settings["har_log_enabled"]; ok {
		enabled = e == "true"
	}
	if p, ok := settings["har_log_path"]; ok {
		path = p
	}
	return
}
