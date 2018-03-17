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

	// &render=1 signals to the legacy redirect layer to
	// avoid redirect these requests.
	url := fmt.Sprintf("%s://%s:%s/%s&render=1", setting.Protocol, localDomain, setting.HttpPort, params.Path)

	binPath, _ := filepath.Abs(filepath.Join(setting.PhantomDir, executable))
	scriptPath, _ := filepath.Abs(filepath.Join(setting.PhantomDir, "render.js"))
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
		"domain=" + localDomain,
		"timeout=" + strconv.Itoa(timeout),
		"renderKey=" + renderKey,
	}

	if params.Encoding != "" {
		cmdArgs = append([]string{fmt.Sprintf("--output-encoding=%s", params.Encoding)}, cmdArgs...)
	}

	cmd := exec.Command(binPath, cmdArgs...)
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
