package rendering

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"mime"
	"net/http"
	"net/url"
	"os"
	"time"
)

const authTokenHeader = "X-Auth-Token" //#nosec G101 -- This is a false positive

var (
	remoteVersionFetchInterval   time.Duration = time.Second * 15
	remoteVersionFetchRetries    uint          = 4
	remoteVersionRefreshInterval               = time.Minute * 15
)

// renderViaHTTP renders PNG or PDF via HTTP
func (rs *RenderingService) renderViaHTTP(ctx context.Context, renderType RenderType, renderKey string, opts Opts) (*RenderResult, error) {
	result, err := rs.doRequestAndWriteToFile(ctx, renderType, opts, renderKey)
	if err != nil {
		return nil, err
	}

	return &RenderResult{FilePath: result.FilePath}, nil
}

// renderViaHTTP renders CSV via HTTP
func (rs *RenderingService) renderCSVViaHTTP(ctx context.Context, renderKey string, csvOpts CSVOpts) (*RenderCSVResult, error) {
	result, err := rs.doRequestAndWriteToFile(ctx, RenderCSV, Opts{CommonOpts: csvOpts.CommonOpts}, renderKey)
	if err != nil {
		return nil, err
	}

	return &RenderCSVResult{FilePath: result.FilePath, FileName: result.FileName}, nil
}

func (rs *RenderingService) doRequestAndWriteToFile(ctx context.Context, renderType RenderType, opts Opts, renderKey string) (*Result, error) {
	logger := rs.log.FromContext(ctx)

	filePath, err := rs.getNewFilePath(renderType)
	if err != nil {
		return nil, err
	}

	// gives service some additional time to timeout and return possible errors.
	reqContext, cancel := context.WithTimeout(ctx, getRequestTimeout(opts.TimeoutOpts))
	defer cancel()

	resp, err := rs.imageRendererClient.MakeRequest(reqContext, renderType, opts, renderKey)
	if err != nil {
		logger.Error("Remote rendering request failed", "error", err)
		return nil, err
	}

	// save response to file
	err = rs.writeResponseToFile(reqContext, resp.Data, filePath)
	if err != nil {
		return nil, err
	}

	var downloadFileName string
	if renderType == RenderCSV {
		_, params, err := mime.ParseMediaType(resp.ContentDisposition)
		if err != nil {
			return nil, err
		}
		downloadFileName = params["filename"]
	}

	return &Result{FilePath: filePath, FileName: downloadFileName}, nil
}

func (rs *RenderingService) writeResponseToFile(ctx context.Context, resp []byte, filePath string) error {
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

	_, err = out.Write(resp)
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

	resp, err := http.Get(rendererURL.String())
	if err != nil {
		return "", fmt.Errorf("remote rendering request to get version failed: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

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
