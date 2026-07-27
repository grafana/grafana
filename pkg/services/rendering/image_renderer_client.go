package rendering

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"

	"github.com/grafana/grafana/pkg/setting"
)

type Client struct {
	cfg        setting.Provider
	httpClient *http.Client
	serverURL  string
	callback   RendererCallback
}

func NewClient(cfg setting.Provider, authMiddleware AuthMiddleware) *Client {
	// remoteTransport := clientauth.NewTokenExchangeTransportWrapper(nil, nil, nil)(rt???)

	callback, _ := ResolveCallback(cfg)
	serverURL := cfg.KeyValue("rendering", "server_url").MustString("")

	return &Client{
		cfg: cfg,
		httpClient: &http.Client{
			Transport: authMiddleware,
		},
		serverURL: serverURL,
		callback:  callback,
	}
}

type RendererResponse struct {
	Data               []byte
	ContentDisposition string
}

func (r *Client) MakeRequest(ctx context.Context, renderType RenderType, opts Opts, renderKey string) (*RendererResponse, error) {
	u, err := r.createRequestURL(renderType, opts, renderKey)
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u.String(), nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", fmt.Sprintf("Grafana/%s", r.cfg.KeyValue("buildinfo", "noop").MustString("unknown")))

	resp, err := r.httpClient.Do(req)
	if err != nil {
		var urlErr *url.Error
		if errors.As(err, &urlErr) {
			if urlErr.Timeout() {
				return nil, ErrServerTimeout
			}
		}
		return nil, fmt.Errorf("failed to send request to remote rendering service: %w", err)
	}

	if resp.StatusCode == http.StatusTooManyRequests {
		return nil, ErrTooManyRequests
	}
	if resp.StatusCode == http.StatusRequestTimeout {
		return nil, ErrServerTimeout
	}

	defer func() { _ = resp.Body.Close() }()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read body: %w", err)
	}

	return &RendererResponse{
		Data:               body,
		ContentDisposition: resp.Header.Get("Content-Disposition"),
	}, nil
}

func (r *Client) createRequestURL(renderType RenderType, opts Opts, renderKey string) (*url.URL, error) {
	rendererURL := r.serverURL
	if renderType == RenderCSV {
		rendererURL += "/csv"
	}

	imageRendererURL, err := url.Parse(rendererURL)
	if err != nil {
		return nil, err
	}

	url := r.grafanaCallbackURL(opts.Path)

	queryParams := imageRendererURL.Query()
	queryParams.Add("url", url)
	if renderKey != "" {
		queryParams.Add("renderKey", renderKey)
	}
	queryParams.Add("domain", r.callback.Domain)
	queryParams.Add("timezone", isoTimeOffsetToPosixTz(opts.Timezone))
	queryParams.Add("encoding", string(renderType))
	queryParams.Add("timeout", strconv.Itoa(int(opts.Timeout.Seconds())))

	if renderType == RenderPNG {
		queryParams.Add("width", strconv.Itoa(opts.Width))
		queryParams.Add("height", strconv.Itoa(opts.Height))
	}

	if renderType != RenderCSV {
		queryParams.Add("deviceScaleFactor", fmt.Sprintf("%f", opts.DeviceScaleFactor))
	}

	imageRendererURL.RawQuery = queryParams.Encode()
	return imageRendererURL, nil
}

func (r *Client) grafanaCallbackURL(path string) string {
	if r.callback.URL != "" {
		// rendererCallbackURL should be set if:
		// - the backend rendering service is remote (default value is cfg.AppURL
		// and set when initializing the service)
		// - the service is a plugin and Grafana is running behind a proxy changing its domain

		// &render=1 signals to the legacy redirect layer to
		return fmt.Sprintf("%s%s&render=1", r.callback.URL, path)
	}

	protocol := r.callback.Protocol
	if protocol != "http" {
		protocol = "https"
	}

	subPath := ""
	if r.callback.ServeFromSubpath {
		subPath = r.callback.SubURL
	}

	// &render=1 signals to the legacy redirect layer to
	return fmt.Sprintf("%s://%s:%s%s/%s&render=1", protocol, r.callback.Domain, r.callback.HTTPPort, subPath, path)
}
