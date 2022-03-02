package service

import (
	"archive/zip"
	"bufio"
	"context"
	"crypto/sha256"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"io"
	"io/ioutil"
	"net"
	"net/http"
	"net/url"
	"os"
	"runtime"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/plugins/repository"

	"github.com/grafana/grafana/pkg/plugins/logger"

	"github.com/grafana/grafana/pkg/util/errutil"
)

type Client struct {
	httpClient          http.Client
	httpClientNoTimeout http.Client
	retryCount          int

	log logger.Logger
}

func newClient(skipTLSVerify bool, logger logger.Logger) *Client {
	return &Client{
		httpClient:          makeHttpClient(skipTLSVerify, 10*time.Second),
		httpClientNoTimeout: makeHttpClient(skipTLSVerify, 0),
		log:                 logger,
	}
}

func (c *Client) download(_ context.Context, pluginZipURL, checksum, grafanaVersion string) (*repository.PluginArchive, error) {
	// Create temp file for downloading zip file
	tmpFile, err := ioutil.TempFile("", "*.zip")
	if err != nil {
		return nil, errutil.Wrap("failed to create temporary file", err)
	}
	defer func() {
		if err := os.Remove(tmpFile.Name()); err != nil {
			c.log.Warn("Failed to remove temporary file", "file", tmpFile.Name(), "err", err)
		}
	}()

	c.log.Debugf("Installing plugin from %s", pluginZipURL)

	err = c.downloadFile(tmpFile, pluginZipURL, checksum, grafanaVersion)
	if err != nil {
		if err := tmpFile.Close(); err != nil {
			c.log.Warn("Failed to close file", "err", err)
		}
		return nil, errutil.Wrap("failed to download plugin archive", err)
	}

	rc, err := zip.OpenReader(tmpFile.Name())
	if err != nil {
		return nil, err
	}

	return &repository.PluginArchive{
		File: rc,
	}, nil
}

func (c *Client) downloadFile(tmpFile *os.File, pluginURL, checksum, grafanaVersion string) (err error) {
	// Try handling URL as a local file path first
	if _, err := os.Stat(pluginURL); err == nil {
		// TODO re-verify
		// We can ignore this gosec G304 warning since `repoURL` stems from command line flag "pluginUrl". If the
		// user shouldn't be able to read the file, it should be handled through filesystem permissions.
		// nolint:gosec
		f, err := os.Open(pluginURL)
		if err != nil {
			return errutil.Wrap("Failed to read plugin archive", err)
		}
		defer func() {
			if err := f.Close(); err != nil {
				c.log.Warn("Failed to close file", "err", err)
			}
		}()
		_, err = io.Copy(tmpFile, f)
		if err != nil {
			return errutil.Wrap("Failed to copy plugin archive", err)
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
				err = c.downloadFile(tmpFile, pluginURL, checksum, grafanaVersion)
			} else {
				c.retryCount = 0
				failure := fmt.Sprintf("%v", r)
				if failure == "runtime error: makeslice: len out of range" {
					err = fmt.Errorf("corrupt HTTP response from source, please try again")
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

	// Using no timeout here as some plugins can be bigger and smaller timeout would prevent to download a plugin on
	// slow network. As this is CLI operation hanging is not a big of an issue as user can just abort.
	bodyReader, err := c.sendReqNoTimeout(u, grafanaVersion)
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
		return errutil.Wrap("failed to compute SHA256 checksum", err)
	}
	if err := w.Flush(); err != nil {
		return fmt.Errorf("failed to write to %q: %w", tmpFile.Name(), err)
	}
	if len(checksum) > 0 && checksum != fmt.Sprintf("%x", h.Sum(nil)) {
		return fmt.Errorf("expected SHA256 checksum does not match the downloaded archive - please contact security@grafana.com")
	}
	return nil
}

func (c *Client) sendReq(url *url.URL, grafanaVersion string) ([]byte, error) {
	req, err := c.createReq(url, grafanaVersion)
	if err != nil {
		return nil, err
	}

	res, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	bodyReader, err := c.handleResp(res, grafanaVersion)
	if err != nil {
		return nil, err
	}
	defer func() {
		if err := bodyReader.Close(); err != nil {
			c.log.Warn("Failed to close stream", "err", err)
		}
	}()
	return ioutil.ReadAll(bodyReader)
}

func (c *Client) sendReqNoTimeout(url *url.URL, grafanaVersion string) (io.ReadCloser, error) {
	req, err := c.createReq(url, grafanaVersion)
	if err != nil {
		return nil, err
	}

	res, err := c.httpClientNoTimeout.Do(req)
	if err != nil {
		return nil, err
	}
	return c.handleResp(res, grafanaVersion)
}

func (c *Client) createReq(url *url.URL, grafanaVersion string) (*http.Request, error) {
	req, err := http.NewRequest(http.MethodGet, url.String(), nil)
	if err != nil {
		return nil, err
	}

	req.Header.Set("grafana-version", grafanaVersion)
	req.Header.Set("grafana-os", runtime.GOOS)
	req.Header.Set("grafana-arch", runtime.GOARCH)
	req.Header.Set("User-Agent", "grafana "+grafanaVersion)

	return req, err
}

func (c *Client) handleResp(res *http.Response, grafanaVersion string) (io.ReadCloser, error) {
	if res.StatusCode/100 == 4 {
		body, err := ioutil.ReadAll(res.Body)
		defer func() {
			if err := res.Body.Close(); err != nil {
				c.log.Warn("Failed to close response body", "err", err)
			}
		}()
		if err != nil || len(body) == 0 {
			return nil, repository.Response4xxError{StatusCode: res.StatusCode}
		}
		var message string
		var jsonBody map[string]string
		err = json.Unmarshal(body, &jsonBody)
		if err != nil || len(jsonBody["message"]) == 0 {
			message = string(body)
		} else {
			message = jsonBody["message"]
		}
		return nil, repository.Response4xxError{StatusCode: res.StatusCode, Message: message, SystemInfo: SystemInfo(grafanaVersion)}
	}

	if res.StatusCode/100 != 2 {
		return nil, fmt.Errorf("API returned invalid status: %s", res.Status)
	}

	return res.Body, nil
}

func makeHttpClient(skipTLSVerify bool, timeout time.Duration) http.Client {
	tr := &http.Transport{
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
	}

	return http.Client{
		Timeout:   timeout,
		Transport: tr,
	}
}

func SystemInfo(grafanaVersion string) string {
	return fmt.Sprintf("Grafana v%s %s", grafanaVersion, osAndArchString())
}

func osAndArchString() string {
	osString := strings.ToLower(runtime.GOOS)
	arch := runtime.GOARCH
	return osString + "-" + arch
}
