package renderer

import (
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"time"
	"regexp"

	"strconv"

	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

type RenderOpts struct {
	Url       string
	Width     string
	Height    string
	SessionId string
	Timeout   string
}

var rendererLog log.Logger = log.New("file-renderer")

func RenderToFile(params *RenderOpts, filetype string) (string, error) {
	rendererLog.Info("Rendering", "url", params.Url)

	var executable = "phantomjs"
	if runtime.GOOS == "windows" {
		executable = executable + ".exe"
	}

	binPath, _ := filepath.Abs(filepath.Join(setting.PhantomDir, executable))
	scriptPath, _ := filepath.Abs(filepath.Join(setting.PhantomDir, "render.js"))
	renderfilePath, _ := filepath.Abs(filepath.Join(setting.ImagesDir, util.GetRandomString(20)))
	switch {
		case regexp.MustCompile(`(?i)^pdf$`).MatchString(filetype):
			renderfilePath = renderfilePath + ".pdf"
		case regexp.MustCompile(`(?i)^png$`).MatchString(filetype):
			renderfilePath = renderfilePath + ".png"
		case regexp.MustCompile(`(?i)^(jpeg|jpg)$`).MatchString(filetype):
			renderfilePath = renderfilePath + ".jpg"
		case regexp.MustCompile(`(?i)^bmp$`).MatchString(filetype):
			renderfilePath = renderfilePath + ".bmp"
		case regexp.MustCompile(`(?i)^ppm$`).MatchString(filetype):
			renderfilePath = renderfilePath + ".ppm"
		case regexp.MustCompile(`(?i)^gif$`).MatchString(filetype):
			renderfilePath = renderfilePath + ".gif"
		default:
			renderfilePath = renderfilePath + ".png"
	}

	cmd := exec.Command(binPath, "--ignore-ssl-errors=true", scriptPath, "url="+params.Url, "width="+params.Width,
		"height="+params.Height, "path="+renderfilePath, "cookiename="+setting.SessionOptions.CookieName,
		"domain="+setting.Domain, "sessionid="+params.SessionId)
	stdout, err := cmd.StdoutPipe()

	if err != nil {
		return "", err
	}
	stderr, err := cmd.StderrPipe()
	if err != nil {
		return "", err
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
		return "", fmt.Errorf("PhantomRenderer::renderToFile timeout (>%vs)", timeout)
	case <-done:
	}

	rendererLog.Debug("Image rendered", "path", renderfilePath)
	return renderfilePath, nil
}