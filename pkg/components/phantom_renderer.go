package components

import (
	"crypto/md5"
	"encoding/hex"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"time"

	log "github.com/alecthomas/log4go"
)

type PhantomRenderer struct {
	ImagesDir  string
	PhantomDir string
}

func (self *PhantomRenderer) RenderToPng(url string) (string, error) {
	log.Info("PhantomRenderer::renderToPng url %v", url)
	binPath, _ := filepath.Abs(filepath.Join(self.PhantomDir, "phantomjs"))
	scriptPath, _ := filepath.Abs(filepath.Join(self.PhantomDir, "render.js"))
	pngPath, _ := filepath.Abs(filepath.Join(self.ImagesDir, getHash(url)))
	pngPath = pngPath + ".png"

	cmd := exec.Command(binPath, scriptPath, "url="+url, "width=100", "height=100", "png="+pngPath)
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
			log.Error("failed to kill: %v", err)
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
