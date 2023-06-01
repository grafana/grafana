package testdata

import (
	"fmt"
	"path/filepath"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana-plugin-sdk-go/experimental"
)

func CheckGoldenFrame(t *testing.T, path string, name string, f *data.Frame) {
	frames := data.Frames{f}
	if f == nil {
		frames = nil
	}
	dr := backend.DataResponse{
		Frames: frames,
	}
	experimental.CheckGoldenJSONResponse(t, filepath.Join(path), fmt.Sprintf("%s.golden", name), &dr, true)
}

func CheckGoldenFrames(t *testing.T, path string, name string, f data.Frames) {
	dr := backend.DataResponse{
		Frames: f,
	}
	experimental.CheckGoldenJSONResponse(t, filepath.Join(path), fmt.Sprintf("%s.golden", name), &dr, true)
}
