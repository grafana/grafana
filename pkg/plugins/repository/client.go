package repository

import (
	"archive/zip"
	"bufio"
	"bytes"
	"context"
	"crypto/sha256"
	"crypto/tls"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/ioutil"
	"net"
	"net/http"
	"net/url"
	"os"
	"path"
	"path/filepath"
	"regexp"
	"runtime"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/util/errutil"
)

var (
	reGitBuild = regexp.MustCompile("^[a-zA-Z0-9_.-]*/")
)

type Client struct {
	httpClient          http.Client
	httpClientNoTimeout http.Client
	retryCount          int
	grafanaVersion      string

	log Logger
}

func newClient(skipTLSVerify bool, grafanaVersion string, logger Logger) *Client {
	return &Client{
		httpClient:          makeHttpClient(skipTLSVerify, 10*time.Second),
		httpClientNoTimeout: makeHttpClient(skipTLSVerify, 0),
		log:                 logger,
		grafanaVersion:      grafanaVersion,
	}
}

func (c *Client) downloadAndExtract(ctx context.Context, pluginID, pluginZipURL, checksum, pluginsPath string,
	allowSymlinks bool, repo plugins.Repository) (*plugins.PluginArchiveInfo, error) {
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

	c.log.Debugf("Installing plugin\nfrom: %s\ninto: %s", pluginZipURL, pluginsPath)

	err = c.downloadFile(tmpFile, pluginZipURL, checksum)
	if err != nil {
		if err := tmpFile.Close(); err != nil {
			c.log.Warn("Failed to close file", "err", err)
		}
		return nil, errutil.Wrap("failed to download plugin archive", err)
	}
	err = tmpFile.Close()
	if err != nil {
		return nil, errutil.Wrap("failed to close tmp file", err)
	}

	pluginDir, err := c.extractFiles(tmpFile.Name(), pluginID, pluginsPath, allowSymlinks)
	if err != nil {
		return nil, errutil.Wrap("failed to extract plugin archive", err)
	}

	res, err := toPluginDTO(pluginID, pluginDir)
	if err != nil {
		return nil, errutil.Wrap("failed to convert to plugin DTO", err)
	}

	c.log.Successf("Downloaded %s v%s zip successfully", res.ID, res.Info.Version)

	installedPlugin := &plugins.PluginArchiveInfo{
		ID:           res.ID,
		Version:      res.Info.Version,
		Dependencies: make(map[string]*plugins.PluginArchiveInfo),
		Path:         pluginDir,
	}

	// download dependency plugins
	for _, dep := range res.Dependencies.Plugins {
		c.log.Infof("Fetching %s dependencies...", res.ID)
		if dep, err := repo.Download(ctx, dep.ID, normalizeVersion(dep.Version)); err != nil {
			return nil, errutil.Wrapf(err, "failed to install plugin %s", dep.ID)
		} else {
			installedPlugin.Dependencies[dep.ID] = dep
		}
	}

	return installedPlugin, err
}

func (c *Client) downloadFile(tmpFile *os.File, url string, checksum string) (err error) {
	// Try handling URL as a local file path first
	if _, err := os.Stat(url); err == nil {
		// We can ignore this gosec G304 warning since `repoURL` stems from command line flag "pluginUrl". If the
		// user shouldn't be able to read the file, it should be handled through filesystem permissions.
		// nolint:gosec
		f, err := os.Open(url)
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
				err = c.downloadFile(tmpFile, url, checksum)
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

	// Using no timeout here as some plugins can be bigger and smaller timeout would prevent to download a plugin on
	// slow network. As this is CLI operation hanging is not a big of an issue as user can just abort.
	bodyReader, err := c.sendRequestWithoutTimeout(url)
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

func (c *Client) sendRequestGetBytes(url string, subPaths ...string) ([]byte, error) {
	bodyReader, err := c.sendRequest(url, subPaths...)
	if err != nil {
		return []byte{}, err
	}
	defer func() {
		if err := bodyReader.Close(); err != nil {
			c.log.Warn("Failed to close stream", "err", err)
		}
	}()
	return ioutil.ReadAll(bodyReader)
}

func (c *Client) sendRequest(URL string, subPaths ...string) (io.ReadCloser, error) {
	req, err := c.createRequest(URL, subPaths...)
	if err != nil {
		return nil, err
	}

	res, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	return c.handleResponse(res)
}

func (c *Client) sendRequestWithoutTimeout(URL string, subPaths ...string) (io.ReadCloser, error) {
	req, err := c.createRequest(URL, subPaths...)
	if err != nil {
		return nil, err
	}

	res, err := c.httpClientNoTimeout.Do(req)
	if err != nil {
		return nil, err
	}
	return c.handleResponse(res)
}

func (c *Client) createRequest(URL string, subPaths ...string) (*http.Request, error) {
	u, err := url.Parse(URL)
	if err != nil {
		return nil, err
	}

	for _, v := range subPaths {
		u.Path = path.Join(u.Path, v)
	}

	req, err := http.NewRequest(http.MethodGet, u.String(), nil)
	if err != nil {
		return nil, err
	}

	req.Header.Set("grafana-version", c.grafanaVersion)
	req.Header.Set("grafana-os", runtime.GOOS)
	req.Header.Set("grafana-arch", runtime.GOARCH)
	req.Header.Set("User-Agent", "grafana "+c.grafanaVersion)

	return req, err
}

func (c *Client) handleResponse(res *http.Response) (io.ReadCloser, error) {
	if res.StatusCode/100 == 4 {
		body, err := ioutil.ReadAll(res.Body)
		defer func() {
			if err := res.Body.Close(); err != nil {
				c.log.Warn("Failed to close response body", "err", err)
			}
		}()
		if err != nil || len(body) == 0 {
			return nil, Response4xxError{StatusCode: res.StatusCode}
		}
		var message string
		var jsonBody map[string]string
		err = json.Unmarshal(body, &jsonBody)
		if err != nil || len(jsonBody["message"]) == 0 {
			message = string(body)
		} else {
			message = jsonBody["message"]
		}
		return nil, Response4xxError{StatusCode: res.StatusCode, Message: message, SystemInfo: c.fullSystemInfoString()}
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

func normalizeVersion(version string) string {
	normalized := strings.ReplaceAll(version, " ", "")
	if strings.HasPrefix(normalized, "^") || strings.HasPrefix(normalized, "v") {
		return normalized[1:]
	}

	return normalized
}

func (c *Client) extractFiles(archivePath string, pluginID string, destPath string, allowSymlinks bool) (string, error) {
	var err error
	destPath, err = filepath.Abs(destPath)
	if err != nil {
		return "", err
	}
	c.log.Debug(fmt.Sprintf("Extracting archive %q to %q...", archivePath, destPath))

	installDir := filepath.Join(destPath, pluginID)
	if _, err := os.Stat(installDir); !os.IsNotExist(err) {
		c.log.Debugf("Removing existing installation of plugin %s", installDir)
		err = os.RemoveAll(installDir)
		if err != nil {
			return "", err
		}
	}

	r, err := zip.OpenReader(archivePath)
	if err != nil {
		return "", err
	}

	defer func() {
		if err := r.Close(); err != nil {
			c.log.Warn("failed to close zip file", "err", err)
		}
	}()

	for _, zf := range r.File {
		// We can ignore gosec G305 here since we check for the ZipSlip vulnerability below
		// nolint:gosec
		fullPath := filepath.Join(destPath, zf.Name)

		// Check for ZipSlip. More Info: http://bit.ly/2MsjAWE
		if filepath.IsAbs(zf.Name) ||
			!strings.HasPrefix(fullPath, filepath.Clean(destPath)+string(os.PathSeparator)) ||
			strings.HasPrefix(zf.Name, ".."+string(os.PathSeparator)) {
			return "", fmt.Errorf(
				"archive member %q tries to write outside of plugin directory: %q, this can be a security risk",
				zf.Name, destPath)
		}

		dstPath := filepath.Clean(filepath.Join(destPath, removeGitBuildFromName(zf.Name, pluginID)))

		if zf.FileInfo().IsDir() {
			// We can ignore gosec G304 here since it makes sense to give all users read access
			// nolint:gosec
			if err := os.MkdirAll(dstPath, 0755); err != nil {
				if os.IsPermission(err) {
					return "", ErrPermissionDenied{Path: dstPath}
				}

				return "", err
			}

			continue
		}

		// Create needed directories to extract file
		// We can ignore gosec G304 here since it makes sense to give all users read access
		// nolint:gosec
		if err := os.MkdirAll(filepath.Dir(dstPath), 0755); err != nil {
			return "", errutil.Wrap("failed to create directory to extract plugin files", err)
		}

		if isSymlink(zf) {
			if !allowSymlinks {
				c.log.Warnf("%v: plugin archive contains a symlink, which is not allowed. Skipping", zf.Name)
				continue
			}
			if err := extractSymlink(zf, dstPath); err != nil {
				c.log.Warn("failed to extract symlink", "err", err)
				continue
			}
		} else if err := extractFile(zf, dstPath); err != nil {
			return "", errutil.Wrap("failed to extract file", err)
		}
	}

	return installDir, nil
}

func (c *Client) fullSystemInfoString() string {
	return fmt.Sprintf("Grafana v%s %s", c.grafanaVersion, osAndArchString())
}

func osAndArchString() string {
	osString := strings.ToLower(runtime.GOOS)
	arch := runtime.GOARCH
	return osString + "-" + arch
}

func isSymlink(file *zip.File) bool {
	return file.Mode()&os.ModeSymlink == os.ModeSymlink
}

func extractSymlink(file *zip.File, filePath string) error {
	// symlink target is the contents of the file
	src, err := file.Open()
	if err != nil {
		return errutil.Wrap("failed to extract file", err)
	}
	buf := new(bytes.Buffer)
	if _, err := io.Copy(buf, src); err != nil {
		return errutil.Wrap("failed to copy symlink contents", err)
	}
	if err := os.Symlink(strings.TrimSpace(buf.String()), filePath); err != nil {
		return errutil.Wrapf(err, "failed to make symbolic link for %v", filePath)
	}
	return nil
}

func extractFile(file *zip.File, filePath string) (err error) {
	fileMode := file.Mode()
	// This is entry point for backend plugins so we want to make them executable
	if strings.HasSuffix(filePath, "_linux_amd64") || strings.HasSuffix(filePath, "_darwin_amd64") {
		fileMode = os.FileMode(0755)
	}

	// We can ignore the gosec G304 warning on this one, since the variable part of the file path stems
	// from command line flag "destPath", and the only possible damage would be writing to the wrong directory.
	// If the user shouldn't be writing to this directory, they shouldn't have the permission in the file system.
	// nolint:gosec
	dst, err := os.OpenFile(filePath, os.O_RDWR|os.O_CREATE|os.O_TRUNC, fileMode)
	if err != nil {
		if os.IsPermission(err) {
			return ErrPermissionDenied{Path: filePath}
		}

		unwrappedError := errors.Unwrap(err)
		if unwrappedError != nil && strings.EqualFold(unwrappedError.Error(), "text file busy") {
			return fmt.Errorf("file %q is in use - please stop Grafana, install the plugin and restart Grafana", filePath)
		}

		return errutil.Wrap("failed to open file", err)
	}
	defer func() {
		err = dst.Close()
	}()

	src, err := file.Open()
	if err != nil {
		return errutil.Wrap("failed to extract file", err)
	}
	defer func() {
		err = src.Close()
	}()

	_, err = io.Copy(dst, src)
	return err
}

func removeGitBuildFromName(filename, pluginID string) string {
	return reGitBuild.ReplaceAllString(filename, pluginID+"/")
}

func toPluginDTO(pluginID, pluginDir string) (*InstalledPlugin, error) {
	distPluginDataPath := filepath.Join(pluginDir, "dist", "plugin.json")

	// It's safe to ignore gosec warning G304 since the file path suffix is hardcoded
	// nolint:gosec
	data, err := ioutil.ReadFile(distPluginDataPath)
	if err != nil {
		pluginDataPath := filepath.Join(pluginDir, "plugin.json")
		// It's safe to ignore gosec warning G304 since the file path suffix is hardcoded
		// nolint:gosec
		data, err = ioutil.ReadFile(pluginDataPath)
		if err != nil {
			return nil, fmt.Errorf("could not find dist/plugin.json or plugin.json for %s in %s", pluginID, pluginDir)
		}
	}

	res := &InstalledPlugin{}
	if err := json.Unmarshal(data, &res); err != nil {
		return res, err
	}

	if res.ID == "" {
		return nil, fmt.Errorf("could not find valid plugin %s in %s", pluginID, pluginDir)
	}

	if res.Info.Version == "" {
		res.Info.Version = "0.0.0"
	}

	return res, nil
}
