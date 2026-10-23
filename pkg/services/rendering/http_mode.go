package rendering

import (
	"context"
	"errors"
	"fmt"
	"mime"
	"net/http"
	"net/url"
	"strconv"
)

const authTokenHeader = "X-Auth-Token" //#nosec G101 -- This is a false positive

func (rs *RenderingService) renderViaHTTP(ctx context.Context, settings Settings, kind RenderType, credentials RenderCredentials, opts Opts) (*Result, error) {
	rendererURL, err := generateImageRendererURL(rs.renderer, settings, kind, opts, credentials.Key)
	if err != nil {
		return nil, err
	}

	ctx, cancel := context.WithTimeout(ctx, getRequestTimeout(opts.TimeoutOpts))
	defer cancel()
	headers := http.Header{}
	for name, values := range opts.Headers {
		for _, value := range values {
			headers.Add(name, value)
		}
	}

	// Callback credentials must never come from caller-supplied headers.
	headers.Del("X-Access-Token")
	for name, values := range credentials.Headers {
		headers.Del(name)
		for _, value := range values {
			headers.Add(name, value)
		}
	}

	resp, err := doRendererRequest(ctx, rs.netClient, rs.userAgent, rs.renderer, rendererURL, headers)
	if err != nil {
		return nil, err
	}

	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("remote rendering request failed, status code: %d", resp.StatusCode)
	}

	var name string
	if kind == RenderCSV {
		_, params, err := mime.ParseMediaType(resp.Header.Get("Content-Disposition"))
		if err != nil {
			return nil, err
		}

		name = params["filename"]
	}

	result, err := rs.store.Store(ctx, kind, resp.Body)
	if errors.Is(ctx.Err(), context.DeadlineExceeded) {
		return nil, ErrTimeout
	}

	if err != nil {
		return nil, err
	}

	if err := ctx.Err(); err != nil {
		return nil, err
	}

	result.FileName = name
	return result, nil
}

func generateImageRendererURL(renderer ImageRendererConfig, settings Settings, kind RenderType, opts Opts, renderKey string) (*url.URL, error) {
	rendererURL := renderer.URL
	if kind == RenderCSV {
		rendererURL += "/csv"
	}

	u, err := url.Parse(rendererURL)
	if err != nil {
		return nil, err
	}

	query := u.Query()
	query.Set("url", settings.callbackURL(opts.Path))
	if renderKey != "" {
		query.Set("renderKey", renderKey)
	} else {
		query.Del("renderKey")
	}

	query.Set("domain", settings.domain())
	query.Set("timezone", isoTimeOffsetToPosixTz(opts.Timezone))
	query.Set("encoding", string(kind))
	query.Set("timeout", strconv.Itoa(int(opts.Timeout.Seconds())))
	if kind == RenderPNG {
		query.Set("width", strconv.Itoa(opts.Width))
		query.Set("height", strconv.Itoa(opts.Height))
	}

	if kind != RenderCSV {
		query.Set("deviceScaleFactor", fmt.Sprintf("%f", opts.DeviceScaleFactor))
	}

	u.RawQuery = query.Encode()
	return u, nil
}

func doRendererRequest(ctx context.Context, client *http.Client, userAgent UserAgentProvider, renderer ImageRendererConfig, u *url.URL, headers http.Header) (*http.Response, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u.String(), nil)
	if err != nil {
		return nil, err
	}

	req.Header = headers.Clone()
	if req.Header == nil {
		req.Header = make(http.Header)
	}

	req.Header.Set(authTokenHeader, renderer.AuthToken)
	agent, err := userAgent.UserAgent(ctx)
	if err != nil {
		return nil, err
	}

	req.Header.Set("User-Agent", agent)
	resp, err := client.Do(req)
	if err != nil {
		if urlErr, ok := errors.AsType[*url.Error](err); ok && urlErr.Timeout() {
			return nil, ErrServerTimeout
		}

		// url.Error contains the render key in its URL; don't propagate it into logs.
		if urlErr, ok := errors.AsType[*url.Error](err); ok {
			err = urlErr.Err
		}

		return nil, fmt.Errorf("calling image renderer: %w", err)
	}

	switch resp.StatusCode {
	case http.StatusTooManyRequests:
		_ = resp.Body.Close()
		return nil, ErrTooManyRequests
	case http.StatusRequestTimeout:
		_ = resp.Body.Close()
		return nil, ErrServerTimeout
	}

	return resp, nil
}
