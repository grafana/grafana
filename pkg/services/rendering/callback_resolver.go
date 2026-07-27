package rendering

import (
	"fmt"
	"net/url"
	"strings"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana/pkg/setting"
)

type RendererCallback struct {
	Domain           string
	URL              string
	Protocol         string
	HTTPPort         string
	SubURL           string
	ServeFromSubpath bool
}

func ResolveCallback(cfg setting.Provider) (RendererCallback, error) {
	// value used by the image renderer to make requests to Grafana
	rendererCallbackURL := cfg.KeyValue("renderer", "callback_url").MustString("")

	rendererServerURL := cfg.KeyValue("renderer", "server_url").MustString("")

	// copied from settings
	appURL := cfg.KeyValue("server", "root_url").MustString("")
	if appURL == "" {
		return RendererCallback{}, fmt.Errorf("root_url must be set")
	}
	if appURL[len(appURL)-1] != '/' {
		appURL += "/"
	}
	// Check if has app suburl.
	url, err := url.Parse(appURL)
	if err != nil {
		return RendererCallback{}, err
	}

	httpAddr := cfg.KeyValue("server", "http_addr").MustString(setting.DefaultHTTPAddr)
	httpPort := cfg.KeyValue("server", "http_port").MustString("3000")
	protocol := cfg.KeyValue("server", "protocol").MustString("http")
	serveFromSubpath := cfg.KeyValue("server", "serve_from_sub_path").MustBool(false)

	// Default value for callback URL using a remote renderer should be AppURL
	if rendererServerURL != "" && rendererCallbackURL == "" {
		rendererCallbackURL = appURL
	}

	domain := "localhost"
	switch {
	case rendererCallbackURL != "":
		if rendererCallbackURL[len(rendererCallbackURL)-1] != '/' {
			rendererCallbackURL += "/"
		}

		u, err := url.Parse(rendererCallbackURL)
		if err != nil {
			logging.DefaultLogger.Warn("Image renderer callback url is not valid. " +
				"Please provide a valid RendererCallbackUrl. " +
				"Read more at https://grafana.com/docs/grafana/latest/administration/image_rendering/")
			return RendererCallback{}, err
		}

		domain = u.Hostname()

	case httpAddr != setting.DefaultHTTPAddr:
		domain = httpAddr
	}

	return RendererCallback{
		Domain:           domain,
		URL:              rendererCallbackURL,
		Protocol:         protocol,
		HTTPPort:         httpPort,
		SubURL:           strings.TrimSuffix(url.Path, "/"),
		ServeFromSubpath: serveFromSubpath,
	}, nil
}
