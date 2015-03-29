package renderer

import (
	"crypto/md5"
	"encoding/hex"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"time"

	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/setting"
)

type RenderOpts struct {
	Url       string
	Width     string
	Height    string
	SessionId string
}

func RenderToPng(params *RenderOpts) (string, error) {
	log.Info("PhantomRenderer::renderToPng url %v", params.Url)
	binPath, _ := filepath.Abs(filepath.Join(setting.PhantomDir, "phantomjs"))
	scriptPath, _ := filepath.Abs(filepath.Join(setting.PhantomDir, "render.js"))
	pngPath, _ := filepath.Abs(filepath.Join(setting.ImagesDir, getHash(params.Url)))
	pngPath = pngPath + ".png"

	cmd := exec.Command(binPath, scriptPath, "url="+params.Url, "width="+params.Width,
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

	select {
	case <-time.After(10 * time.Second):
		if err := cmd.Process.Kill(); err != nil {
			log.Error(4, "failed to kill: %v", err)
		}
	case <-done:
	}

	return pngPath, nil
}

func getHash(text string) string {
	hasher := md5.New()
	hasher.Write([]byte(text))
	return hex.EncodeToString(hasher.Sum(nil))
}
