package renderer

import (
	"errors"

	"github.com/grafana/grafana/pkg/log"
)

var rendererLog = log.New("png-renderer")
var sharedRenderer Renderer

func Init() error {
	if sharedRenderer != nil {
		return errors.New("renderer.Init already called")
	}

	rendererLog.Info("Initializing Renderer")

	var err error
	sharedRenderer, err = NewRendererFromSettings()
	if err != nil {
		rendererLog.Error("Could not initialize renderer", "err", err)
	}
	return err
}

func Close() {
	if sharedRenderer == nil {
		return
	}

	sharedRenderer.Close()
	rendererLog.Info("Stopped Renderer")
	sharedRenderer = nil
}

func Render(opts Opts) (string, error) {
	if sharedRenderer == nil {
		return "", errors.New("renderer.Init not called")
	}
	return sharedRenderer.Render(opts)
}
