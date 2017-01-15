package renderer

import (
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"runtime"
	"time"

	"strconv"

	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/middleware"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
	"strings"
)

type RenderOpts struct {
	Path       string
	Width      string
	Height     string
	Timeout    string
	OrgId      int64
	TimeOffset string
}

var rendererLog log.Logger = log.New("png-renderer")

func isoTimeOffsetToPosixTz(isoOffset string) string {
	re := regexp.MustCompile(`^([+-])([0-1][0-9]|2[0-4])([0-5][0-9])$`)
	results := re.FindStringSubmatch(isoOffset)
	if results == nil {
		return ""
	}
	sign := "+"
	if results[1] == "+" {
		sign = "-"  // "+" is west and "-" is east in POSIX TZ
	}
	return fmt.Sprintf("SOMEWHERE%s%s:%s", sign, results[2], results[3])
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

	cmdArgs := []string{
		"--ignore-ssl-errors=true",
		"--web-security=false",
		scriptPath,
		"url=" + url,
		"width=" + params.Width,
		"height=" + params.Height,
		"png=" + pngPath,
		"domain=" + localDomain,
		"renderKey=" + renderKey,
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

	tz := isoTimeOffsetToPosixTz(params.TimeOffset)
	if tz != "" {
		baseEnviron := os.Environ()
		cmd.Env = appendEnviron(baseEnviron, "TZ", tz)
	}

	err = cmd.Start()
	if err != nil {
		return "", err
	}

	go io.Copy(os.Stdout, stdout)
	go io.Copy(os.Stdout, stderr)

	done := make(chan error)
	go func() {
		cmd.Wait()
		close(done)
	}()

	timeout, err := strconv.Atoi(params.Timeout)
	if err != nil {
		timeout = 15
	}

	select {
	case <-time.After(time.Duration(timeout) * time.Second):
		if err := cmd.Process.Kill(); err != nil {
			rendererLog.Error("failed to kill", "error", err)
		}
		return "", fmt.Errorf("PhantomRenderer::renderToPng timeout (>%vs)", timeout)
	case <-done:
	}

	rendererLog.Debug("Image rendered", "path", pngPath)
	return pngPath, nil
}
