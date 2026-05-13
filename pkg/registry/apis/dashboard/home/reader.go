package home

import (
	"bytes"
	"embed"
	"encoding/json"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"

	"k8s.io/apimachinery/pkg/runtime"

	dashv0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	"github.com/grafana/grafana/apps/dashboard/pkg/migration/conversion"
	"github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	"github.com/grafana/grafana/pkg/setting"
)

var (
	//go:embed home.json
	defaultHomeDashboardFS embed.FS
)

func HasCustomHome(cfg *setting.Cfg) bool {
	if cfg.DefaultHomeDashboardPath != "" {
		return true
	}

	// Check if the default is different
	filePath := filepath.Join(cfg.StaticRootPath, "dashboards/home.json")
	loaded, _ := os.ReadFile(filePath)
	builtin, _ := fs.ReadFile(defaultHomeDashboardFS, "home.json")
	return !bytes.Equal(builtin, loaded)
}

func readDashboard(filePath string) (runtime.Object, error) {
	if filePath == "" {
		return nil, nil
	}
	raw, err := os.ReadFile(filePath)
	if err != nil {
		return nil, fmt.Errorf("read home dashboard: %w", err)
	}
	return readDashboardBytes(raw)
}

func readDashboardBytes(raw []byte) (runtime.Object, error) {
	// Peek at the apiVersion before deciding which type to decode into.
	var header struct {
		APIVersion string `json:"apiVersion"`
	}
	if err := json.Unmarshal(raw, &header); err != nil {
		return nil, fmt.Errorf("parse home dashboard: %w", err)
	}

	if header.APIVersion != "" {
		out, err := conversion.NewDashboardObject(header.APIVersion)
		if err != nil {
			return nil, fmt.Errorf("unsupported home dashboard apiVersion %q: %w", header.APIVersion, err)
		}
		if err := json.Unmarshal(raw, out); err != nil {
			return nil, fmt.Errorf("decode home dashboard (%s): %w", header.APIVersion, err)
		}
		return out, nil
	}

	// No apiVersion → treat the whole file as the v0 spec.
	var spec map[string]any
	if err := json.Unmarshal(raw, &spec); err != nil {
		return nil, fmt.Errorf("decode home dashboard spec: %w", err)
	}
	return &dashv0.Dashboard{Spec: v0alpha1.Unstructured{Object: spec}}, nil
}

// defaultHomeDashboard is the fallback returned when no file is configured or
// the configured file cannot be read.
func defaultHomeDashboard() (runtime.Object, error) {
	raw, err := fs.ReadFile(defaultHomeDashboardFS, "home.json")
	if err != nil {
		return nil, err
	}
	return readDashboardBytes(raw)
}
