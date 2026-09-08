package v2

import (
	"context"
	"errors"
	"fmt"
	"net"
	"net/url"
	"strings"
	"time"
)

var ErrRenderingUnavailable = errors.New("rendering unavailable")

const rendererTenantIDBytesMax = 1024

type ConfigurationInput struct {
	RendererServerURL   string
	RendererCallbackURL string
	RendererAuthToken   string
	RendererTenantID    string
	RendererCACertPath  string
	RenderKeyLifetime   time.Duration
	BuildVersion        string

	AppURL           string
	HTTPAddress      string
	HTTPPort         string
	Protocol         string
	AppSubURL        string
	ServeFromSubPath bool
}

type Configuration struct {
	state configurationState
}

type configurationState interface {
	configurationState()
}

type disabledConfiguration struct{}

func (disabledConfiguration) configurationState() {}

type enabledConfiguration struct {
	rendererURL        rendererURL
	callbackURL        callbackURL
	callbackDomain     callbackDomain
	rendererAuthToken  rendererAuthToken
	rendererTenantID   rendererTenantID
	renderKeyLifetime  renderKeyLifetime
	rendererCACertPath string
	buildVersion       string
}

func (enabledConfiguration) configurationState() {}

type rendererURL struct {
	url *url.URL
}

type callbackURL struct {
	url *url.URL
}

type callbackDomain struct {
	value string
}

type rendererAuthToken struct {
	value string
}

type rendererTenantID struct {
	value string
}

type renderKeyLifetime struct {
	duration time.Duration
}

func ParseConfiguration(input ConfigurationInput) (Configuration, error) {
	if strings.TrimSpace(input.RendererServerURL) == "" {
		return Configuration{state: disabledConfiguration{}}, nil
	}

	renderer, err := parseAbsoluteHTTPURL("renderer server URL", input.RendererServerURL)
	if err != nil {
		return Configuration{}, err
	}
	renderer.Path = strings.TrimRight(renderer.Path, "/")

	callbackValue := strings.TrimSpace(input.RendererCallbackURL)
	if callbackValue == "" {
		callbackValue = strings.TrimSpace(input.AppURL)
	}
	if callbackValue == "" {
		callbackValue, err = fallbackCallbackURL(input)
		if err != nil {
			return Configuration{}, err
		}
	}
	callback, err := parseAbsoluteHTTPURL("callback URL", callbackValue)
	if err != nil {
		return Configuration{}, err
	}
	callback.Path = strings.TrimRight(callback.Path, "/") + "/"

	domain := callback.Hostname()
	if domain == "" {
		return Configuration{}, errors.New("parse callback URL: hostname is required")
	}

	authToken := strings.TrimSpace(input.RendererAuthToken)
	if authToken == "" {
		return Configuration{}, errors.New("parse renderer authentication token: value is required")
	}
	if input.RenderKeyLifetime <= 0 {
		return Configuration{}, errors.New("parse render key lifetime: positive duration is required")
	}
	tenantID := strings.TrimSpace(input.RendererTenantID)
	if tenantID == "" {
		tenantID = domain
	}
	if len(tenantID) > rendererTenantIDBytesMax || strings.ContainsAny(tenantID, "\r\n") {
		return Configuration{}, fmt.Errorf("parse renderer tenant ID: value must be a valid header no longer than %d bytes", rendererTenantIDBytesMax)
	}

	return Configuration{state: enabledConfiguration{
		rendererURL:        rendererURL{url: renderer},
		callbackURL:        callbackURL{url: callback},
		callbackDomain:     callbackDomain{value: domain},
		rendererAuthToken:  rendererAuthToken{value: authToken},
		rendererTenantID:   rendererTenantID{value: tenantID},
		renderKeyLifetime:  renderKeyLifetime{duration: input.RenderKeyLifetime},
		rendererCACertPath: strings.TrimSpace(input.RendererCACertPath),
		buildVersion:       input.BuildVersion,
	}}, nil
}

func (c Configuration) Available() bool {
	_, ok := c.state.(enabledConfiguration)
	return ok
}

func (c Configuration) enabled() (enabledConfiguration, error) {
	enabled, ok := c.state.(enabledConfiguration)
	if !ok {
		return enabledConfiguration{}, ErrRenderingUnavailable
	}
	return enabled, nil
}

func parseAbsoluteHTTPURL(name, value string) (*url.URL, error) {
	parsed, err := url.Parse(strings.TrimSpace(value))
	if err != nil {
		return nil, fmt.Errorf("parse %s: %w", name, err)
	}
	if parsed.Scheme != "http" && parsed.Scheme != "https" {
		return nil, fmt.Errorf("parse %s: scheme must be http or https", name)
	}
	if parsed.Host == "" {
		return nil, fmt.Errorf("parse %s: hostname is required", name)
	}
	if parsed.RawQuery != "" || parsed.Fragment != "" {
		return nil, fmt.Errorf("parse %s: query and fragment are not allowed", name)
	}
	return parsed, nil
}

func fallbackCallbackURL(input ConfigurationInput) (string, error) {
	host := strings.TrimSpace(input.HTTPAddress)
	port := strings.TrimSpace(input.HTTPPort)
	if host == "" || port == "" {
		return "", errors.New("parse callback URL: callback URL or server address and port are required")
	}
	if host == "0.0.0.0" {
		host = "localhost"
	}

	scheme := "http"
	switch input.Protocol {
	case "", "http", "h2c":
	case "https", "h2", "socket_h2":
		scheme = "https"
	default:
		return "", fmt.Errorf("parse callback URL: unsupported protocol %q", input.Protocol)
	}

	path := ""
	if input.ServeFromSubPath {
		path = "/" + strings.Trim(input.AppSubURL, "/")
	}
	return (&url.URL{Scheme: scheme, Host: net.JoinHostPort(host, port), Path: path + "/"}).String(), nil
}

type ConfigurationProvider interface {
	Get(context.Context) (Configuration, error)
}
