package renderer

import (
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"time"

	"strconv"

	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/middleware"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

type RenderOpts struct {
	Path    string
	Width   string
	Height  string
	Timeout string
	OrgId   int64
}

var rendererLog log.Logger = log.New("png-renderer")

func RenderToPng(params *RenderOpts) (string, error) {
	rendererLog.Info("Rendering", "path", params.Path)

	var executable = "phantomjs"
	if runtime.GOOS == "windows" {
		executable = executable + ".exe"
	}

	localAddress := "localhost"
	if setting.HttpAddr != setting.DEFAULT_HTTP_ADDR {
		localAddress = setting.HttpAddr
	}

	url := fmt.Sprintf("%s://%s:%s/%s", setting.Protocol, localAddress, setting.HttpPort, params.Path)

	binPath, _ := filepath.Abs(filepath.Join(setting.PhantomDir, executable))
	scriptPath, _ := filepath.Abs(filepath.Join(setting.PhantomDir, "render.js"))
	pngPath, _ := filepath.Abs(filepath.Join(setting.ImagesDir, util.GetRandomString(20)))
	pngPath = pngPath + ".png"

	renderKey := middleware.AddRenderAuthKey(params.OrgId)
	defer middleware.RemoveRenderAuthKey(renderKey)

	cmdArgs := []string{
		"--ignore-ssl-errors=true",
		scriptPath,
		"url=" + url,
		"width=" + params.Width,
		"height=" + params.Height,
		"png=" + pngPath,
		"domain=" + setting.Domain,
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
