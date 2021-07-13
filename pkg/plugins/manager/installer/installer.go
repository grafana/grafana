package installer

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

type Installer struct {
	retryCount int

	httpClient          http.Client
	httpClientNoTimeout http.Client
	grafanaVersion      string
	log                 plugins.PluginInstallerLogger
}

const (
	permissionsDeniedMessage = "could not create %q, permission denied, make sure you have write access to plugin dir"
)

var (
	reGitBuild = regexp.MustCompile("^[a-zA-Z0-9_.-]*/")
)

type Response4xxError struct {
	Message    string
	StatusCode int
	SystemInfo string
}

func (e Response4xxError) Error() string {
	if len(e.Message) > 0 {
		if len(e.SystemInfo) > 0 {
			return fmt.Sprintf("%s (%s)", e.Message, e.SystemInfo)
		}
		return fmt.Sprintf("%d: %s", e.StatusCode, e.Message)
	}
	return fmt.Sprintf("%d", e.StatusCode)
}

type ErrVersionUnsupported struct {
	PluginID         string
	RequestedVersion string
	SystemInfo       string
}

func (e ErrVersionUnsupported) Error() string {
	return fmt.Sprintf("%s v%s is not supported on your system (%s)", e.PluginID, e.RequestedVersion, e.SystemInfo)
}

type ErrVersionNotFound struct {
	PluginID         string
	RequestedVersion string
	SystemInfo       string
}

func (e ErrVersionNotFound) Error() string {
	return fmt.Sprintf("%s v%s either does not exist or is not supported on your system (%s)", e.PluginID, e.RequestedVersion, e.SystemInfo)
}

func New(skipTLSVerify bool, grafanaVersion string, logger plugins.PluginInstallerLogger) *Installer {
	return &Installer{
		httpClient:          makeHttpClient(skipTLSVerify, 10*time.Second),
		httpClientNoTimeout: makeHttpClient(skipTLSVerify, 0),
		log:                 logger,
		grafanaVersion:      grafanaVersion,
	}
}

// Install downloads the plugin code as a zip file from specified URL
// and then extracts the zip into the provided plugins directory.
func (i *Installer) Install(ctx context.Context, pluginID, version, pluginsDir, pluginZipURL, pluginRepoURL string) error {
	isInternal := false

	var checksum string
	if pluginZipURL == "" {
		if strings.HasPrefix(pluginID, "grafana-") {
			// At this point the plugin download is going through grafana.com API and thus the name is validated.
			// Checking for grafana prefix is how it is done there so no 3rd party plugin should have that prefix.
			// You can supply custom plugin name and then set custom download url to 3rd party plugin but then that
			// is up to the user to know what she is doing.
			isInternal = true
		}
		plugin, err := i.getPluginMetadataFromPluginRepo(pluginID, pluginRepoURL)
		if err != nil {
			return err
		}

		v, err := i.selectVersion(&plugin, version)
		if err != nil {
			return err
		}

		if version == "" {
			version = v.Version
		}
		pluginZipURL = fmt.Sprintf("%s/%s/versions/%s/download",
			pluginRepoURL,
			pluginID,
			version,
		)

		// Plugins which are downloaded just as sourcecode zipball from github do not have checksum
		if v.Arch != nil {
			archMeta, exists := v.Arch[osAndArchString()]
			if !exists {
				archMeta = v.Arch["any"]
			}
			checksum = archMeta.SHA256
		}
	}

	i.log.Debugf("Installing plugin\nfrom: %s\ninto: %s", pluginZipURL, pluginsDir)

	// Create temp file for downloading zip file
	tmpFile, err := ioutil.TempFile("", "*.zip")
	if err != nil {
		return errutil.Wrap("failed to create temporary file", err)
	}
	defer func() {
		if err := os.Remove(tmpFile.Name()); err != nil {
			i.log.Warn("Failed to remove temporary file", "file", tmpFile.Name(), "err", err)
		}
	}()

	err = i.DownloadFile(pluginID, tmpFile, pluginZipURL, checksum)
	if err != nil {
		if err := tmpFile.Close(); err != nil {
			i.log.Warn("Failed to close file", "err", err)
		}
		return errutil.Wrap("failed to download plugin archive", err)
	}
	err = tmpFile.Close()
	if err != nil {
		return errutil.Wrap("failed to close tmp file", err)
	}

	err = i.extractFiles(tmpFile.Name(), pluginID, pluginsDir, isInternal)
	if err != nil {
		return errutil.Wrap("failed to extract plugin archive", err)
	}

	res, _ := toPluginDTO(pluginsDir, pluginID)

	i.log.Successf("Downloaded %s v%s zip successfully", res.ID, res.Info.Version)

	// download dependency plugins
	for _, dep := range res.Dependencies.Plugins {
		i.log.Infof("Fetching %s dependencies...", res.ID)
		if err := i.Install(ctx, dep.ID, normalizeVersion(dep.Version), pluginsDir, "", pluginRepoURL); err != nil {
			return errutil.Wrapf(err, "failed to install plugin %s", dep.ID)
		}
	}

	return err
}

// Uninstall removes the specified plugin from the provided plugins directory.
func (i *Installer) Uninstall(ctx context.Context, pluginID, pluginPath string) error {
	pluginDir := filepath.Join(pluginPath, pluginID)

	// verify it's a plugin directory
	if _, err := os.Stat(filepath.Join(pluginDir, "plugin.json")); err != nil {
		if os.IsNotExist(err) {
			if _, err := os.Stat(filepath.Join(pluginDir, "dist", "plugin.json")); err != nil {
				if os.IsNotExist(err) {
					return fmt.Errorf("tried to remove %s, but it doesn't seem to be a plugin", pluginPath)
				}
			}
		}
	}

	i.log.Infof("Uninstalling plugin %v", pluginID)

	return os.RemoveAll(pluginDir)
}

func (i *Installer) DownloadFile(pluginID string, tmpFile *os.File, url string, checksum string) (err error) {
	// Try handling URL as a local file path first
	if _, err := os.Stat(url); err == nil {
		// We can ignore this gosec G304 warning since `url` stems from command line flag "pluginUrl". If the
		// user shouldn't be able to read the file, it should be handled through filesystem permissions.
		// nolint:gosec
		f, err := os.Open(url)
		if err != nil {
			return errutil.Wrap("Failed to read plugin archive", err)
		}
		defer func() {
			if err := f.Close(); err != nil {
				i.log.Warn("Failed to close file", "err", err)
			}
		}()
		_, err = io.Copy(tmpFile, f)
		if err != nil {
			return errutil.Wrap("Failed to copy plugin archive", err)
		}
		return nil
	}

	i.retryCount = 0

	defer func() {
		if r := recover(); r != nil {
			i.retryCount++
			if i.retryCount < 3 {
				i.log.Debug("Failed downloading. Will retry once.")
				err = tmpFile.Truncate(0)
				if err != nil {
					return
				}
				_, err = tmpFile.Seek(0, 0)
				if err != nil {
					return
				}
				err = i.DownloadFile(pluginID, tmpFile, url, checksum)
			} else {
				i.retryCount = 0
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
	bodyReader, err := i.sendRequestWithoutTimeout(url)
	if err != nil {
		return err
	}
	defer func() {
		if err := bodyReader.Close(); err != nil {
			i.log.Warn("Failed to close body", "err", err)
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

func (i *Installer) getPluginMetadataFromPluginRepo(pluginID, pluginRepoURL string) (Plugin, error) {
	i.log.Debugf("Fetching metadata for plugin \"%s\" from repo %s", pluginID, pluginRepoURL)
	body, err := i.sendRequestGetBytes(pluginRepoURL, "repo", pluginID)
	if err != nil {
		return Plugin{}, err
	}

	var data Plugin
	err = json.Unmarshal(body, &data)
	if err != nil {
		i.log.Error("Failed to unmarshal plugin repo response error", err)
		return Plugin{}, err
	}

	return data, nil
}

func (i *Installer) sendRequestGetBytes(URL string, subPaths ...string) ([]byte, error) {
	bodyReader, err := i.sendRequest(URL, subPaths...)
	if err != nil {
		return []byte{}, err
	}
	defer func() {
		if err := bodyReader.Close(); err != nil {
			i.log.Warn("Failed to close stream", "err", err)
		}
	}()
	return ioutil.ReadAll(bodyReader)
}

func (i *Installer) sendRequest(URL string, subPaths ...string) (io.ReadCloser, error) {
	req, err := i.createRequest(URL, subPaths...)
	if err != nil {
		return nil, err
	}

	res, err := i.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	return i.handleResponse(res)
}

func (i *Installer) sendRequestWithoutTimeout(URL string, subPaths ...string) (io.ReadCloser, error) {
	req, err := i.createRequest(URL, subPaths...)
	if err != nil {
		return nil, err
	}

	res, err := i.httpClientNoTimeout.Do(req)
	if err != nil {
		return nil, err
	}
	return i.handleResponse(res)
}

func (i *Installer) createRequest(URL string, subPaths ...string) (*http.Request, error) {
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

	req.Header.Set("grafana-version", i.grafanaVersion)
	req.Header.Set("grafana-os", runtime.GOOS)
	req.Header.Set("grafana-arch", runtime.GOARCH)
	req.Header.Set("User-Agent", "grafana "+i.grafanaVersion)

	return req, err
}

func (i *Installer) handleResponse(res *http.Response) (io.ReadCloser, error) {
	if res.StatusCode/100 == 4 {
		body, err := ioutil.ReadAll(res.Body)
		defer func() {
			if err := res.Body.Close(); err != nil {
				i.log.Warn("Failed to close response body", "err", err)
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
		return nil, Response4xxError{StatusCode: res.StatusCode, Message: message, SystemInfo: i.fullSystemInfoString()}
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

// selectVersion returns latest version if none is specified or the specified version. If the version string is not
// matched to existing version it errors out. It also errors out if version that is matched is not available for current
// os and platform. It expects plugin.Versions to be sorted so the newest version is first.
func (i *Installer) selectVersion(plugin *Plugin, version string) (*Version, error) {
	var ver Version

	latestForArch := latestSupportedVersion(plugin)
	if latestForArch == nil {
		return nil, ErrVersionUnsupported{
			PluginID:         plugin.ID,
			RequestedVersion: version,
			SystemInfo:       i.fullSystemInfoString(),
		}
	}

	if version == "" {
		return latestForArch, nil
	}
	for _, v := range plugin.Versions {
		if v.Version == version {
			ver = v
			break
		}
	}

	if len(ver.Version) == 0 {
		i.log.Debugf("Requested plugin version %s v%s not found but potential fallback version '%s' was found",
			plugin.ID, version, latestForArch.Version)
		return nil, ErrVersionNotFound{
			PluginID:         plugin.ID,
			RequestedVersion: version,
			SystemInfo:       i.fullSystemInfoString(),
		}
	}

	if !supportsCurrentArch(&ver) {
		i.log.Debugf("Requested plugin version %s v%s not found but potential fallback version '%s' was found",
			plugin.ID, version, latestForArch.Version)
		return nil, ErrVersionUnsupported{
			PluginID:         plugin.ID,
			RequestedVersion: version,
			SystemInfo:       i.fullSystemInfoString(),
		}
	}

	return &ver, nil
}

func (i *Installer) fullSystemInfoString() string {
	return fmt.Sprintf("Grafana v%s %s", i.grafanaVersion, osAndArchString())
}

func osAndArchString() string {
	osString := strings.ToLower(runtime.GOOS)
	arch := runtime.GOARCH
	return osString + "-" + arch
}

func supportsCurrentArch(version *Version) bool {
	if version.Arch == nil {
		return true
	}
	for arch := range version.Arch {
		if arch == osAndArchString() || arch == "any" {
			return true
		}
	}
	return false
}

func latestSupportedVersion(plugin *Plugin) *Version {
	for _, v := range plugin.Versions {
		ver := v
		if supportsCurrentArch(&ver) {
			return &ver
		}
	}
	return nil
}

func (i *Installer) extractFiles(archiveFile string, pluginID string, dest string, allowSymlinks bool) error {
	var err error
	dest, err = filepath.Abs(dest)
	if err != nil {
		return err
	}
	i.log.Debug(fmt.Sprintf("Extracting archive %q to %q...", archiveFile, dest))

	existingInstallDir := filepath.Join(dest, pluginID)
	if _, err := os.Stat(existingInstallDir); !os.IsNotExist(err) {
		i.log.Debugf("Removing existing installation of plugin %s", existingInstallDir)
		err = os.RemoveAll(existingInstallDir)
		if err != nil {
			return err
		}
	}

	r, err := zip.OpenReader(archiveFile)
	defer func() {
		if err := r.Close(); err != nil {
			i.log.Warn("failed to close zip file", "err", err)
		}
	}()
	if err != nil {
		return err
	}
	for _, zf := range r.File {
		// We can ignore gosec G305 here since we check for the ZipSlip vulnerability below
		// nolint:gosec
		fullPath := filepath.Join(dest, zf.Name)

		// Check for ZipSlip. More Info: http://bit.ly/2MsjAWE
		if filepath.IsAbs(zf.Name) ||
			!strings.HasPrefix(fullPath, filepath.Clean(dest)+string(os.PathSeparator)) ||
			strings.HasPrefix(zf.Name, ".."+string(os.PathSeparator)) {
			return fmt.Errorf(
				"archive member %q tries to write outside of plugin directory: %q, this can be a security risk",
				zf.Name, dest)
		}

		dstPath := filepath.Clean(filepath.Join(dest, removeGitBuildFromName(zf.Name, pluginID)))

		if zf.FileInfo().IsDir() {
			// We can ignore gosec G304 here since it makes sense to give all users read access
			// nolint:gosec
			if err := os.MkdirAll(dstPath, 0755); err != nil {
				if os.IsPermission(err) {
					return fmt.Errorf(permissionsDeniedMessage, dstPath)
				}

				return err
			}

			continue
		}

		// Create needed directories to extract file
		// We can ignore gosec G304 here since it makes sense to give all users read access
		// nolint:gosec
		if err := os.MkdirAll(filepath.Dir(dstPath), 0755); err != nil {
			return errutil.Wrap("failed to create directory to extract plugin files", err)
		}

		if isSymlink(zf) {
			if !allowSymlinks {
				i.log.Warnf("%v: plugin archive contains a symlink, which is not allowed. Skipping", zf.Name)
				continue
			}
			if err := extractSymlink(zf, dstPath); err != nil {
				i.log.Warn("failed to extract symlink", "err", err)
				continue
			}
			continue
		}

		if err := extractFile(zf, dstPath); err != nil {
			return errutil.Wrap("failed to extract file", err)
		}
	}

	return nil
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
	// from command line flag "pluginsDir", and the only possible damage would be writing to the wrong directory.
	// If the user shouldn't be writing to this directory, they shouldn't have the permission in the file system.
	// nolint:gosec
	dst, err := os.OpenFile(filePath, os.O_RDWR|os.O_CREATE|os.O_TRUNC, fileMode)
	if err != nil {
		if os.IsPermission(err) {
			return fmt.Errorf(permissionsDeniedMessage, filePath)
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

func toPluginDTO(pluginDir, pluginID string) (InstalledPlugin, error) {
	distPluginDataPath := filepath.Join(pluginDir, pluginID, "dist", "plugin.json")

	// It's safe to ignore gosec warning G304 since the file path suffix is hardcoded
	// nolint:gosec
	data, err := ioutil.ReadFile(distPluginDataPath)
	if err != nil {
		pluginDataPath := filepath.Join(pluginDir, pluginID, "plugin.json")
		// It's safe to ignore gosec warning G304 since the file path suffix is hardcoded
		// nolint:gosec
		data, err = ioutil.ReadFile(pluginDataPath)
		if err != nil {
			return InstalledPlugin{}, errors.New("Could not find dist/plugin.json or plugin.json on  " + pluginID + " in " + pluginDir)
		}
	}

	res := InstalledPlugin{}
	if err := json.Unmarshal(data, &res); err != nil {
		return res, err
	}

	if res.Info.Version == "" {
		res.Info.Version = "0.0.0"
	}

	if res.ID == "" {
		return InstalledPlugin{}, errors.New("could not find plugin " + pluginID + " in " + pluginDir)
	}

	return res, nil
}
