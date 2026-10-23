package rendering

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"encoding/gob"
	"fmt"
	"net"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"

	"go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/remotecache"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
)

func ProvideService(cfg *setting.Cfg, features featuremgmt.FeatureToggles, remoteCache *remotecache.RemoteCache) (*RenderingService, error) {
	folders := []string{
		cfg.ImagesDir,
		cfg.CSVsDir,
		cfg.PDFsDir,
	}

	// ensure folders exists
	for _, f := range folders {
		err := os.MkdirAll(f, 0700)
		if err != nil {
			return nil, fmt.Errorf("failed to create directory %q: %w", f, err)
		}
	}

	logger := log.New("rendering")

	//  value used for domain attribute of renderKey cookie
	var domain string

	// value used by the image renderer to make requests to Grafana
	rendererCallbackURL := cfg.RendererCallbackUrl
	// Default value for callback URL using a remote renderer should be AppURL
	if cfg.RendererServerUrl != "" && rendererCallbackURL == "" {
		rendererCallbackURL = cfg.AppURL
	}

	switch {
	case rendererCallbackURL != "":
		if rendererCallbackURL[len(rendererCallbackURL)-1] != '/' {
			rendererCallbackURL += "/"
		}

		u, err := url.Parse(rendererCallbackURL)
		if err != nil {
			logger.Warn("Image renderer callback url is not valid. " +
				"Please provide a valid RendererCallbackUrl. " +
				"Read more at https://grafana.com/docs/grafana/latest/administration/image_rendering/")
			return nil, err
		}

		domain = u.Hostname()
	case cfg.HTTPAddr != setting.DefaultHTTPAddr:
		domain = cfg.HTTPAddr
	default:
		domain = "localhost"
	}

	var renderKeyProvider RenderKeyProvider
	if cfg.RendererServerUrl != "" {
		//nolint:staticcheck // not yet migrated to OpenFeature
		if features.IsEnabledGlobally(featuremgmt.FlagRenderAuthJWT) {
			// only check if the renderer is configured otherwise we dont need to force changing the default.
			if strings.TrimSpace(cfg.RendererAuthToken) == "" {
				err := "Using an empty [rendering]renderer_token is not allowed, set it to another value. " +
					"Read more at https://grafana.com/docs/grafana/latest/setup-grafana/image-rendering/#security"
				logger.Error(err)
				return nil, fmt.Errorf("failed to start rendering service: %v", err)
			}

			if cfg.RendererAuthToken == setting.DefaultRendererAuthToken {
				if cfg.Env == setting.Dev {
					logger.Warn("Using the default [rendering]renderer_token is not allowed for production settings, and Grafana will refuse to start.")
				} else {
					err := "Using the default [rendering]renderer_token is not allowed for production settings, set it to another value. " +
						"Read more at https://grafana.com/docs/grafana/latest/setup-grafana/image-rendering/#security"
					logger.Error(err)
					return nil, fmt.Errorf("failed to start rendering service: %v", err)
				}
			}

			// overwrite the default key provider when we know we have a better way.
			renderKeyProvider = &jwtRenderKeyProvider{
				log:       logger,
				authToken: []byte(cfg.RendererAuthToken),
				keyExpiry: cfg.RendererRenderKeyLifeTime,
			}
		} else {
			renderKeyProvider = &perRequestRenderKeyProvider{
				cache:     remoteCache,
				log:       logger,
				keyExpiry: cfg.RendererRenderKeyLifeTime,
			}
		}
	}

	netTransport := &http.Transport{
		Proxy: http.ProxyFromEnvironment,
		DialContext: (&net.Dialer{
			Timeout: 30 * time.Second,
		}).DialContext,
		TLSHandshakeTimeout: 5 * time.Second,
	}

	if cfg.RendererCACert != "" {
		caCert, err := os.ReadFile(cfg.RendererCACert)
		if err != nil {
			return nil, fmt.Errorf("failed to read renderer CA cert file: %w", err)
		}

		caCertPool := x509.NewCertPool()
		if !caCertPool.AppendCertsFromPEM(caCert) {
			return nil, fmt.Errorf("failed to parse renderer CA cert")
		}

		netTransport.TLSClientConfig = &tls.Config{
			RootCAs: caCertPool,
		}
	}

	netClient := &http.Client{
		Transport: otelhttp.NewTransport(netTransport),
	}

	renderer := ImageRendererConfig{URL: cfg.RendererServerUrl, AuthToken: cfg.RendererAuthToken}
	userAgent := StaticUserAgent("Grafana/" + cfg.BuildVersion)
	settings := Settings{CallbackURL: rendererCallbackURL, Domain: domain}
	if settings.CallbackURL == "" {
		protocol := cfg.Protocol
		if protocol == setting.HTTP2Scheme || protocol == setting.HTTPSScheme || protocol == setting.SocketHTTP2Scheme {
			protocol = "https"
		}

		subPath := ""
		if cfg.ServeFromSubPath {
			subPath = cfg.AppSubURL
		}

		settings.CallbackURL = fmt.Sprintf("%s://%s:%s%s/", protocol, domain, cfg.HTTPPort, subPath)
	}

	provider := func(context.Context) (Settings, error) { return settings, nil }
	s, err := NewService(Config{
		Renderer: renderer,
		Settings: provider, Keys: renderKeyProvider,
		Store:     FileStore{ImagesDir: cfg.ImagesDir, PDFsDir: cfg.PDFsDir, CSVsDir: cfg.CSVsDir, HomePath: cfg.HomePath},
		Client:    netClient,
		UserAgent: userAgent,
		Availability: ConfiguredAvailability{Monitor: NewRemoteAvailability(ProbeConfig{
			Renderer:  renderer,
			Client:    netClient,
			UserAgent: userAgent,
		})},
	})
	if err != nil {
		return nil, err
	}

	gob.Register(&RenderUser{})

	return s, nil
}
