package rendering

import (
	"context"
	"errors"
	"fmt"
	"io"
	"mime"
	"net"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"time"

	"github.com/grafana/grafana/pkg/setting"
)

var netTransport = &http.Transport{
	Proxy: http.ProxyFromEnvironment,
	Dial: (&net.Dialer{
		Timeout: 30 * time.Second,
	}).Dial,
	TLSHandshakeTimeout: 5 * time.Second,
}

var netClient = &http.Client{
	Transport: netTransport,
}

func (rs *RenderingService) renderViaHttp(ctx context.Context, renderKey string, opts Opts) (*RenderResult, error) {
	filePath, err := rs.getNewFilePath(RenderPNG)
	if err != nil {
		return nil, err
	}

	rendererUrl, err := url.Parse(rs.Cfg.RendererUrl)
	if err != nil {
		return nil, err
	}

	queryParams := rendererUrl.Query()
	queryParams.Add("url", rs.getURL(opts.Path))
	queryParams.Add("renderKey", renderKey)
	queryParams.Add("width", strconv.Itoa(opts.Width))
	queryParams.Add("height", strconv.Itoa(opts.Height))
	queryParams.Add("domain", rs.domain)
	queryParams.Add("timezone", isoTimeOffsetToPosixTz(opts.Timezone))
	queryParams.Add("encoding", opts.Encoding)
	queryParams.Add("timeout", strconv.Itoa(int(opts.Timeout.Seconds())))
	queryParams.Add("deviceScaleFactor", fmt.Sprintf("%f", opts.DeviceScaleFactor))

	rendererUrl.RawQuery = queryParams.Encode()

	// gives service some additional time to timeout and return possible errors.
	reqContext, cancel := context.WithTimeout(ctx, opts.Timeout+time.Second*2)
	defer cancel()

	resp, err := rs.doRequest(rendererUrl, opts.Headers, reqContext)
	if err != nil {
		return nil, err
	}

	// save response to file
	defer func() {
		if err := resp.Body.Close(); err != nil {
			rs.log.Warn("Failed to close response body", "err", err)
		}
	}()

	err = rs.readFileResponse(resp, filePath, ctx)
	if err != nil {
		return nil, err
	}

	return &RenderResult{FilePath: filePath}, nil
}

func (rs *RenderingService) renderCSVViaHttp(ctx context.Context, renderKey string, opts CSVOpts) (*RenderCSVResult, error) {
	filePath, err := rs.getNewFilePath(RenderPNG)
	if err != nil {
		return nil, err
	}

	rendererUrl, err := url.Parse(rs.Cfg.RendererUrl + "/csv")
	if err != nil {
		return nil, err
	}

	queryParams := rendererUrl.Query()
	queryParams.Add("url", rs.getURL(opts.Path))
	queryParams.Add("renderKey", renderKey)
	queryParams.Add("domain", rs.domain)
	queryParams.Add("timezone", isoTimeOffsetToPosixTz(opts.Timezone))
	queryParams.Add("encoding", opts.Encoding)
	queryParams.Add("timeout", strconv.Itoa(int(opts.Timeout.Seconds())))

	rendererUrl.RawQuery = queryParams.Encode()

	// gives service some additional time to timeout and return possible errors.
	reqContext, cancel := context.WithTimeout(ctx, opts.Timeout+time.Second*2)
	defer cancel()

	resp, err := rs.doRequest(rendererUrl, opts.Headers, reqContext)
	if err != nil {
		return nil, err
	}

	// save response to file
	defer func() {
		if err := resp.Body.Close(); err != nil {
			rs.log.Warn("Failed to close response body", "err", err)
		}
	}()

	var downloadFileName string
	_, params, err := mime.ParseMediaType(resp.Header.Get("Content-Disposition"))
	if err == nil {
		downloadFileName = params["filename"]
	}

	err = rs.readFileResponse(resp, filePath, reqContext)
	if err != nil {
		return nil, err
	}

	return &RenderCSVResult{FilePath: filePath, FileName: downloadFileName}, nil
}

func (rs *RenderingService) doRequest(url *url.URL, headers map[string][]string, ctx context.Context) (*http.Response, error) {
	req, err := http.NewRequest("GET", url.String(), nil)
	if err != nil {
		return nil, err
	}

	req.Header.Set("User-Agent", fmt.Sprintf("Grafana/%s", setting.BuildVersion))
	for k, v := range headers {
		req.Header[k] = v
	}

	req = req.WithContext(ctx)

	rs.log.Debug("calling remote rendering service", "url", url)

	// make request to renderer server
	resp, err := netClient.Do(req)
	if err != nil {
		rs.log.Error("Failed to send request to remote rendering service.", "error", err)
		return nil, fmt.Errorf("failed to send request to remote rendering service: %w", err)
	}

	return resp, nil
}

func (rs *RenderingService) readFileResponse(resp *http.Response, filePath string, ctx context.Context) error {
	// check for timeout first
	if errors.Is(ctx.Err(), context.DeadlineExceeded) {
		rs.log.Info("Rendering timed out")
		return ErrTimeout
	}

	// if we didn't get a 200 response, something went wrong.
	if resp.StatusCode != http.StatusOK {
		rs.log.Error("Remote rendering request failed", "error", resp.Status)
		return fmt.Errorf("remote rendering request failed, status code: %d, status: %s", resp.StatusCode,
			resp.Status)
	}

	out, err := os.Create(filePath)
	if err != nil {
		return err
	}

	defer func() {
		if err := out.Close(); err != nil {
			rs.log.Warn("Failed to close file", "path", filePath, "err", err)
		}
	}()

	_, err = io.Copy(out, resp.Body)
	if err != nil {
		// check that we didn't timeout while receiving the response.
		if errors.Is(ctx.Err(), context.DeadlineExceeded) {
			rs.log.Info("Rendering timed out")
			return ErrTimeout
		}

		rs.log.Error("Remote rendering request failed", "error", err)
		return fmt.Errorf("remote rendering request failed: %w", err)
	}

	return nil
}
