package rendering

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"mime"
	"net"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"time"

	"go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp"
)

var netTransport = &http.Transport{
	Proxy: http.ProxyFromEnvironment,
	Dial: (&net.Dialer{
		Timeout: 30 * time.Second,
	}).Dial,
	TLSHandshakeTimeout: 5 * time.Second,
}

var netClient = &http.Client{
	Transport: otelhttp.NewTransport(netTransport),
}

const authTokenHeader = "X-Auth-Token" //#nosec G101 -- This is a false positive
const rateLimiterHeader = "X-Tenant-ID"

var (
	remoteVersionFetchInterval   time.Duration = time.Second * 15
	remoteVersionFetchRetries    uint          = 4
	remoteVersionRefreshInterval               = time.Minute * 15
)

// renderViaHTTP renders PNG or PDF via HTTP
func (rs *RenderingService) renderViaHTTP(ctx context.Context, renderType RenderType, renderKey string, opts Opts) (*RenderResult, error) {
	imageRendererURL, err := rs.generateImageRendererURL(renderType, opts, renderKey)
	if err != nil {
		return nil, err
	}

	result, err := rs.doRequestAndWriteToFile(ctx, renderType, imageRendererURL, opts.TimeoutOpts, opts.Headers)
	if err != nil {
		return nil, err
	}

	return &RenderResult{FilePath: result.FilePath}, nil
}

// renderViaHTTP renders CSV via HTTP
func (rs *RenderingService) renderCSVViaHTTP(ctx context.Context, renderKey string, csvOpts CSVOpts) (*RenderCSVResult, error) {
	opts := Opts{CommonOpts: csvOpts.CommonOpts}

	imageRendererURL, err := rs.generateImageRendererURL(RenderCSV, opts, renderKey)
	if err != nil {
		return nil, err
	}

	result, err := rs.doRequestAndWriteToFile(ctx, RenderCSV, imageRendererURL, opts.TimeoutOpts, opts.Headers)
	if err != nil {
		return nil, err
	}

	return &RenderCSVResult{FilePath: result.FilePath, FileName: result.FileName}, nil
}

func (rs *RenderingService) generateImageRendererURL(renderType RenderType, opts Opts, renderKey string) (*url.URL, error) {
	rendererUrl := rs.Cfg.RendererServerUrl
	if renderType == RenderCSV {
		rendererUrl += "/csv"
	}

	imageRendererURL, err := url.Parse(rendererUrl)
	if err != nil {
		return nil, err
	}

	queryParams := imageRendererURL.Query()
	url := rs.getGrafanaCallbackURL(opts.Path)
	queryParams.Add("url", url)
	queryParams.Add("renderKey", renderKey)
	queryParams.Add("domain", rs.domain)
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

func (rs *RenderingService) doRequestAndWriteToFile(ctx context.Context, renderType RenderType, rendererURL *url.URL, timeoutOpts TimeoutOpts, headers map[string][]string) (*Result, error) {
	logger := rs.log.FromContext(ctx)

	filePath, err := rs.getNewFilePath(renderType)
	if err != nil {
		return nil, err
	}

	// gives service some additional time to timeout and return possible errors.
	reqContext, cancel := context.WithTimeout(ctx, getRequestTimeout(timeoutOpts))
	defer cancel()

	resp, err := rs.doRequest(reqContext, rendererURL, headers)
	if err != nil {
		return nil, err
	}

	defer func() {
		if err := resp.Body.Close(); err != nil {
			logger.Warn("Failed to close response body", "err", err)
		}
	}()

	// if we didn't get a 200 response, something went wrong.
	if resp.StatusCode != http.StatusOK {
		logger.Error("Remote rendering request failed", "error", resp.Status, "url", rendererURL.Query().Get("url"))
		return nil, fmt.Errorf("remote rendering request failed, status code: %d, status: %s", resp.StatusCode,
			resp.Status)
	}

	// save response to file
	err = rs.writeResponseToFile(reqContext, resp, filePath)
	if err != nil {
		return nil, err
	}

	var downloadFileName string
	if renderType == RenderCSV {
		_, params, err := mime.ParseMediaType(resp.Header.Get("Content-Disposition"))
		if err != nil {
			return nil, err
		}
		downloadFileName = params["filename"]
	}

	return &Result{FilePath: filePath, FileName: downloadFileName}, nil
}

func (rs *RenderingService) doRequest(ctx context.Context, u *url.URL, headers map[string][]string) (*http.Response, error) {
	logger := rs.log.FromContext(ctx)

	req, err := http.NewRequestWithContext(ctx, "GET", u.String(), nil)
	if err != nil {
		return nil, err
	}

	req.Header.Set(authTokenHeader, rs.Cfg.RendererAuthToken)
	req.Header.Set(rateLimiterHeader, rs.domain)
	req.Header.Set("User-Agent", fmt.Sprintf("Grafana/%s", rs.Cfg.BuildVersion))
	for k, v := range headers {
		req.Header[k] = v
	}

	logger.Debug("calling remote rendering service", "url", u)

	// make request to renderer server
	resp, err := netClient.Do(req)
	if err != nil {
		logger.Error("Failed to send request to remote rendering service", "error", err)
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

	return resp, nil
}

func (rs *RenderingService) writeResponseToFile(ctx context.Context, resp *http.Response, filePath string) error {
	logger := rs.log.FromContext(ctx)

	// check for timeout first
	if errors.Is(ctx.Err(), context.DeadlineExceeded) {
		logger.Error("Rendering timed out")
		return ErrTimeout
	}

	//nolint:gosec
	out, err := os.Create(filePath)
	if err != nil {
		return err
	}

	defer func() {
		if err := out.Close(); err != nil && !errors.Is(err, fs.ErrClosed) {
			// We already close the file explicitly in the non-error path, so shouldn't be a problem
			logger.Warn("Failed to close file", "path", filePath, "err", err)
		}
	}()

	_, err = io.Copy(out, resp.Body)
	if err != nil {
		// check that we didn't timeout while receiving the response.
		if errors.Is(ctx.Err(), context.DeadlineExceeded) {
			logger.Error("Rendering timed out")
			return ErrTimeout
		}

		logger.Error("Remote rendering request failed", "error", err)
		return fmt.Errorf("remote rendering request failed: %w", err)
	}
	if err := out.Close(); err != nil {
		return fmt.Errorf("failed to write to %q: %w", filePath, err)
	}

	return nil
}

func (rs *RenderingService) getRemotePluginVersionWithRetry(callback func(string, error)) {
	go func() {
		var err error
		for try := uint(0); try < remoteVersionFetchRetries; try++ {
			version, err := rs.getRemotePluginVersion()
			if err == nil {
				callback(version, err)
				return
			}
			rs.log.Info("Couldn't get remote renderer version, retrying", "err", err, "try", try)

			time.Sleep(remoteVersionFetchInterval)
		}

		callback("", err)
	}()
}

func (rs *RenderingService) getRemotePluginVersion() (string, error) {
	rendererURL, err := url.Parse(rs.Cfg.RendererServerUrl + "/version")
	if err != nil {
		return "", err
	}

	headers := make(map[string][]string)
	resp, err := rs.doRequest(context.Background(), rendererURL, headers)
	if err != nil {
		return "", err
	}

	defer func() {
		if err := resp.Body.Close(); err != nil {
			rs.log.Warn("Failed to close response body", "err", err)
		}
	}()

	if resp.StatusCode == http.StatusNotFound {
		// Old versions of the renderer lacked the version endpoint
		return "1.0.0", nil
	} else if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("remote rendering request to get version failed, status code: %d, status: %s", resp.StatusCode,
			resp.Status)
	}

	var info struct {
		Version string
	}
	if err := json.NewDecoder(resp.Body).Decode(&info); err != nil {
		return "", err
	}
	return info.Version, nil
}

func (rs *RenderingService) refreshRemotePluginVersion() {
	newVersion, err := rs.getRemotePluginVersion()
	if err != nil {
		rs.log.Info("Failed to refresh remote plugin version", "err", err)
		return
	}

	if newVersion == "" {
		// the image-renderer could have been temporary unavailable - skip updating the version
		rs.log.Debug("Received empty version when trying to refresh remote plugin version")
		return
	}

	currentVersion := rs.Version()
	if currentVersion != newVersion {
		rs.versionMutex.Lock()
		defer rs.versionMutex.Unlock()

		rs.log.Info("Updating remote plugin version", "currentVersion", currentVersion, "newVersion", newVersion)
		rs.version = newVersion
	}
}
