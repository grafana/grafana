package repo

import (
	"archive/zip"
	"bufio"
	"context"
	"crypto/sha256"
	"crypto/tls"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"os"
	"time"

	"github.com/grafana/grafana/pkg/plugins/log"
)

type Client struct {
	httpClient          http.Client
	httpClientNoTimeout http.Client
	retryCount          int

	log log.PrettyLogger
}

func NewClient(skipTLSVerify bool, logger log.PrettyLogger) *Client {
	return &Client{
		httpClient:          makeHttpClient(skipTLSVerify, 10*time.Second),
		httpClientNoTimeout: makeHttpClient(skipTLSVerify, 0),
		log:                 logger,
	}
}

func (c *Client) Download(_ context.Context, pluginZipURL, checksum string, compatOpts CompatOpts) (*PluginArchive, error) {
	// Create temp file for downloading zip file
	tmpFile, err := os.CreateTemp("", "*.zip")
	if err != nil {
		return nil, fmt.Errorf("%v: %w", "failed to create temporary file", err)
	}
	defer func() {
		if err := os.Remove(tmpFile.Name()); err != nil {
			c.log.Warn("Failed to remove temporary file", "file", tmpFile.Name(), "err", err)
		}
	}()

	c.log.Debugf("Installing plugin from %s", pluginZipURL)

	err = c.downloadFile(tmpFile, pluginZipURL, checksum, compatOpts)
	if err != nil {
		if err := tmpFile.Close(); err != nil {
			c.log.Warn("Failed to close file", "err", err)
		}
		return nil, fmt.Errorf("failed to download plugin archive: %w", err)
	}

	rc, err := zip.OpenReader(tmpFile.Name())
	if err != nil {
		return nil, err
	}

	return &PluginArchive{File: rc}, nil
}

func (c *Client) SendReq(url *url.URL, compatOpts CompatOpts) ([]byte, error) {
	req, err := c.createReq(url, compatOpts)
	if err != nil {
		return nil, err
	}

	res, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	bodyReader, err := c.handleResp(res, compatOpts)
	if err != nil {
		return nil, err
	}
	defer func() {
		if err = bodyReader.Close(); err != nil {
			c.log.Warn("Failed to close stream", "err", err)
		}
	}()
	return io.ReadAll(bodyReader)
}

func (c *Client) downloadFile(tmpFile *os.File, pluginURL, checksum string, compatOpts CompatOpts) (err error) {
	// Try handling URL as a local file path first
	if _, err := os.Stat(pluginURL); err == nil {
		// TODO re-verify
		// We can ignore this gosec G304 warning since `pluginURL` stems from command line flag "pluginUrl". If the
		// user shouldn't be able to read the file, it should be handled through filesystem permissions.
		// nolint:gosec
		f, err := os.Open(pluginURL)
		if err != nil {
			return fmt.Errorf("%v: %w", "Failed to read plugin archive", err)
		}
		defer func() {
			if err := f.Close(); err != nil {
				c.log.Warn("Failed to close file", "err", err)
			}
		}()
		_, err = io.Copy(tmpFile, f)
		if err != nil {
			return fmt.Errorf("%v: %w", "Failed to copy plugin archive", err)
		}
		return nil
	}

	c.retryCount = 0

	defer func() {
		if r := recover(); r != nil {
			c.retryCount++
			if c.retryCount < 3 {
				c.log.Debug("Failed downloading. Will retry once.")
				err = tmpFile.Truncate(0)
				if err != nil {
					return
				}
				_, err = tmpFile.Seek(0, 0)
				if err != nil {
					return
				}
				err = c.downloadFile(tmpFile, pluginURL, checksum, compatOpts)
			} else {
				c.retryCount = 0
				failure := fmt.Sprintf("%v", r)
				if failure == "runtime error: makeslice: len out of range" {
					err = errors.New("corrupt HTTP response from source, please try again")
				} else {
					panic(r)
				}
			}
		}
	}()

	u, err := url.Parse(pluginURL)
	if err != nil {
		return err
	}

	// Using no timeout as some plugin archives make take longer to fetch due to size, network performance, etc.
	// Note: This is also used as part of the grafana plugin install CLI operation
	bodyReader, err := c.sendReqNoTimeout(u, compatOpts)
	if err != nil {
		return err
	}
	defer func() {
		if err := bodyReader.Close(); err != nil {
			c.log.Warn("Failed to close body", "err", err)
		}
	}()

	w := bufio.NewWriter(tmpFile)
	h := sha256.New()
	if _, err = io.Copy(w, io.TeeReader(bodyReader, h)); err != nil {
		return fmt.Errorf("%v: %w", "failed to compute SHA256 checksum", err)
	}
	if err = w.Flush(); err != nil {
		return fmt.Errorf("failed to write to %q: %w", tmpFile.Name(), err)
	}
	if len(checksum) > 0 && checksum != fmt.Sprintf("%x", h.Sum(nil)) {
		return ErrChecksumMismatch{archiveURL: pluginURL}
	}
	return nil
}

func (c *Client) sendReqNoTimeout(url *url.URL, compatOpts CompatOpts) (io.ReadCloser, error) {
	req, err := c.createReq(url, compatOpts)
	if err != nil {
		return nil, err
	}

	res, err := c.httpClientNoTimeout.Do(req)
	if err != nil {
		return nil, err
	}
	return c.handleResp(res, compatOpts)
}

func (c *Client) createReq(url *url.URL, compatOpts CompatOpts) (*http.Request, error) {
	req, err := http.NewRequest(http.MethodGet, url.String(), nil)
	if err != nil {
		return nil, err
	}

	if gVer, exists := compatOpts.GrafanaVersion(); exists {
		req.Header.Set("grafana-version", gVer)
		req.Header.Set("User-Agent", "grafana "+gVer)
	}

	if sysOS, exists := compatOpts.system.OS(); exists {
		req.Header.Set("grafana-os", sysOS)
	}

	if sysArch, exists := compatOpts.system.Arch(); exists {
		req.Header.Set("grafana-arch", sysArch)
	}

	return req, err
}

func (c *Client) handleResp(res *http.Response, compatOpts CompatOpts) (io.ReadCloser, error) {
	if res.StatusCode/100 == 4 {
		body, err := io.ReadAll(res.Body)
		defer func() {
			if err := res.Body.Close(); err != nil {
				c.log.Warn("Failed to close response body", "err", err)
			}
		}()
		if err != nil || len(body) == 0 {
			return nil, newErrResponse4xx(res.StatusCode)
		}
		var message string
		var jsonBody map[string]string
		err = json.Unmarshal(body, &jsonBody)
		if err != nil || len(jsonBody["message"]) == 0 {
			message = string(body)
		} else {
			message = jsonBody["message"]
		}

		return nil, newErrResponse4xx(res.StatusCode).withMessage(message).withCompatibilityInfo(compatOpts)
	}

	if res.StatusCode/100 != 2 {
		return nil, fmt.Errorf("API returned invalid status: %s", res.Status)
	}

	return res.Body, nil
}

func makeHttpClient(skipTLSVerify bool, timeout time.Duration) http.Client {
	return http.Client{
		Timeout: timeout,
		Transport: &http.Transport{
			Proxy: http.ProxyFromEnvironment,
			DialContext: (&net.Dialer{
				Timeout:   30 * time.Second,
				KeepAlive: 30 * time.Second,
			}).DialContext,
			MaxIdleConns:          100,
			IdleConnTimeout:       90 * time.Second,
			TLSHandshakeTimeout:   10 * time.Second,
			ExpectContinueTimeout: 1 * time.Second,
			TLSClientConfig: &tls.Config{
				InsecureSkipVerify: skipTLSVerify,
			},
		},
	}
}
