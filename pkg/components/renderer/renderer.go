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
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

type RenderOpts struct {
	Path           string
	Width          string
	Height         string
	Timeout        string
	OrgId          int64
	UserId         int64
	OrgRole        models.RoleType
	Timezone       string
	IsAlertContext bool
	Encoding       string
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

func renderWithPhantom(url, pngPath, domain, renderKey string, timeout int, params *RenderOpts) *exec.Cmd {
	var executable = "phantomjs"
	if runtime.GOOS == "windows" {
		executable = executable + ".exe"
	}

	binPath, _ := filepath.Abs(filepath.Join(setting.PhantomDir, executable))
	scriptPath, _ := filepath.Abs(filepath.Join(setting.PhantomDir, "render.js"))

	phantomDebugArg := "--debug=false"
	if log.GetLogLevelFor("png-renderer") >= log.LvlDebug {
		phantomDebugArg = "--debug=true"
	}

	cmdArgs := []string{
		"--ignore-ssl-errors=true",
		"--web-security=false",
		phantomDebugArg,
		scriptPath,
		"url=" + url,
		"width=" + params.Width,
		"height=" + params.Height,
		"png=" + pngPath,
		"domain=" + domain,
		"timeout=" + strconv.Itoa(timeout),
		"renderKey=" + renderKey,
	}

	if params.Encoding != "" {
		cmdArgs = append([]string{fmt.Sprintf("--output-encoding=%s", params.Encoding)}, cmdArgs...)
	}

	rendererLog.Debug(`rendering using phantomjs:`, binPath, cmdArgs)

	return exec.Command(binPath, cmdArgs...)
}

func renderWithChrome(url, pngPath, domain, renderKey string, timeout int, params *RenderOpts) *exec.Cmd {
	cmdArgs := []string{
		setting.RenderingHeadlessScript,
		"url=" + url,
		"width=" + params.Width,
		"height=" + params.Height,
		"png=" + pngPath,
		"domain=" + domain,
		"timeout=" + strconv.Itoa(timeout),
		"renderKey=" + renderKey,
	}

	if !setting.RenderingHeadless {
		cmdArgs = append(cmdArgs, "headless=false")
	}

	if setting.RenderingSlowMo > 0 {
		cmdArgs = append(cmdArgs, fmt.Sprintf("slowmo=%d", setting.RenderingSlowMo))
	}

	// hehe hardcode node for now
	return exec.Command("node", cmdArgs...)
}

func getRendererCommand(url, pngPath, domain, renderKey string, timeout int, params *RenderOpts) *exec.Cmd {
	if setting.RenderingEngine == "chrome" {
		return renderWithChrome(url, pngPath, domain, renderKey, timeout, params)
	}

	if setting.RenderingEngine != "phantom" {
		rendererLog.Warn("invalid renderer configured, falling back to phantom", setting.RenderingEngine)
	}
	return renderWithPhantom(url, pngPath, domain, renderKey, timeout, params)
}

func RenderToPng(params *RenderOpts) (string, error) {
	rendererLog.Info("Rendering", "path", params.Path)

	localDomain := "localhost"
	if setting.RenderingDomain != "" {
		localDomain = setting.RenderingDomain
	} else if setting.HttpAddr != setting.DEFAULT_HTTP_ADDR {
		localDomain = setting.HttpAddr
	}

	url := fmt.Sprintf("%s://%s:%s/%s", setting.Protocol, localDomain, setting.HttpPort, params.Path)

	pngPath, _ := filepath.Abs(filepath.Join(setting.ImagesDir, util.GetRandomString(20)))
	pngPath = pngPath + ".png"

	orgRole := params.OrgRole
	if params.IsAlertContext {
		orgRole = models.ROLE_ADMIN
	}
	renderKey := middleware.AddRenderAuthKey(params.OrgId, params.UserId, orgRole)
	defer middleware.RemoveRenderAuthKey(renderKey)

	timeout, err := strconv.Atoi(params.Timeout)
	if err != nil {
		timeout = 15
	}

	cmd := getRendererCommand(url, pngPath, localDomain, renderKey, timeout, params)
	output, err := cmd.StdoutPipe()

	if err != nil {
		rendererLog.Error("Could not acquire stdout pipe", err)
		return "", err
	}
	cmd.Stderr = cmd.Stdout

	if params.Timezone != "" {
		baseEnviron := os.Environ()
		cmd.Env = appendEnviron(baseEnviron, "TZ", isoTimeOffsetToPosixTz(params.Timezone))
	}

	err = cmd.Start()
	if err != nil {
		rendererLog.Error("Could not start command", err)
		return "", err
	}

	logWriter := log.NewLogWriter(rendererLog, log.LvlDebug, "[phantom] ")
	go io.Copy(logWriter, output)

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
