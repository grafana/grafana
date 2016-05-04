package renderer

import (
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"time"

	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
	"strconv"
)

type RenderOpts struct {
	Url       string
	Width     string
	Height    string
	SessionId string
	Timeout   string
}

func RenderToPng(params *RenderOpts) (string, error) {
	log.Info("PhantomRenderer::renderToPng url %v", params.Url)

	var executable = "phantomjs"
	if runtime.GOOS == "windows" {
		executable = executable + ".exe"
	}

	binPath, _ := filepath.Abs(filepath.Join(setting.PhantomDir, executable))
	scriptPath, _ := filepath.Abs(filepath.Join(setting.PhantomDir, "render.js"))
	pngPath, _ := filepath.Abs(filepath.Join(setting.ImagesDir, util.GetRandomString(20)))
	pngPath = pngPath + ".png"

	cmd := exec.Command(binPath, "--ignore-ssl-errors=true", scriptPath, "url="+params.Url, "width="+params.Width,
		"height="+params.Height, "png="+pngPath, "cookiename="+setting.SessionOptions.CookieName,
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
			log.Error(4, "failed to kill: %v", err)
		}
		return "", fmt.Errorf("PhantomRenderer::renderToPng timeout (>%vs)", timeout)
	case <-done:
	}

	return pngPath, nil
}
