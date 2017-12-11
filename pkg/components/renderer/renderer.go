package renderer

import (
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"time"

	"strconv"

	"strings"

	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/middleware"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

type RenderOpts struct {
	Path     string
	Width    string
	Height   string
	Timeout  string
	OrgId    int64
	Timezone string
	Encoding string
}

var ErrTimeout = errors.New("Timeout error. You can set timeout in seconds with &timeout url parameter")
var rendererLog log.Logger = log.New("png-renderer")

func isoTimeOffsetToPosixTz(isoOffset string) string {
	// invert offset
	if strings.HasPrefix(isoOffset, "UTC+") {
		return strings.Replace(isoOffset, "UTC+", "UTC-", 1)
	}
	if strings.HasPrefix(isoOffset, "UTC-") {
		return strings.Replace(isoOffset, "UTC-", "UTC+", 1)
	}
	return isoOffset
}

func appendEnviron(baseEnviron []string, name string, value string) []string {
	results := make([]string, 0)
	prefix := fmt.Sprintf("%s=", name)
	for _, v := range baseEnviron {
		if !strings.HasPrefix(v, prefix) {
			results = append(results, v)
		}
	}
	return append(results, fmt.Sprintf("%s=%s", name, value))
}

func RenderToPng(params *RenderOpts) (string, error) {
	rendererLog.Info("Rendering", "path", params.Path)

	var executable = "phantomjs"
	if runtime.GOOS == "windows" {
		executable = executable + ".exe"
	}

	localDomain := "localhost"
	if setting.HttpAddr != setting.DEFAULT_HTTP_ADDR {
		localDomain = setting.HttpAddr
	}

	url := fmt.Sprintf("%s://%s:%s/%s", setting.Protocol, localDomain, setting.HttpPort, params.Path)

	binPath, _ := filepath.Abs(filepath.Join(setting.PhantomDir, executable))
	scriptPath, _ := filepath.Abs(filepath.Join(setting.PhantomDir, "render.js"))
	pngPath, _ := filepath.Abs(filepath.Join(setting.ImagesDir, util.GetRandomString(20)))
	pngPath = pngPath + ".png"

	renderKey := middleware.AddRenderAuthKey(params.OrgId)
	defer middleware.RemoveRenderAuthKey(renderKey)

	timeout, err := strconv.Atoi(params.Timeout)
	if err != nil {
		timeout = 15
	}

	cmdArgs := []string{
		"--ignore-ssl-errors=true",
		"--web-security=false",
		scriptPath,
		"url=" + url,
		"width=" + params.Width,
		"height=" + params.Height,
		"png=" + pngPath,
		"domain=" + localDomain,
		"timeout=" + strconv.Itoa(timeout),
		"renderKey=" + renderKey,
	}

	if params.Encoding != "" {
		cmdArgs = append([]string{fmt.Sprintf("--output-encoding=%s", params.Encoding)}, cmdArgs...)
	}

	cmd := exec.Command(binPath, cmdArgs...)
	stdout, err := cmd.StdoutPipe()

	if err != nil {
		return "", err
	}
	stderr, err := cmd.StderrPipe()
	if err != nil {
		return "", err
	}

	if params.Timezone != "" {
		baseEnviron := os.Environ()
		cmd.Env = appendEnviron(baseEnviron, "TZ", isoTimeOffsetToPosixTz(params.Timezone))
	}

	err = cmd.Start()
	if err != nil {
		return "", err
	}

	go io.Copy(os.Stdout, stdout)
	go io.Copy(os.Stdout, stderr)

	done := make(chan error)
	go func() {
		if err := cmd.Wait(); err != nil {
			rendererLog.Error("failed to render an image", "error", err)
		}
		close(done)
	}()

	select {
	case <-time.After(time.Duration(timeout) * time.Second):
		if err := cmd.Process.Kill(); err != nil {
			rendererLog.Error("failed to kill", "error", err)
		}
		return "", ErrTimeout
	case <-done:
	}

	rendererLog.Debug("Image rendered", "path", pngPath)
	return pngPath, nil
}
