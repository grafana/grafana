package home

import (
	"bytes"
	_ "embed"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"

	"k8s.io/apimachinery/pkg/runtime"

	dashv0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	"github.com/grafana/grafana/apps/dashboard/pkg/migration/conversion"
	"github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	"github.com/grafana/grafana/pkg/setting"
)

//go:embed home.json
var defaultHomeDashboardJSON []byte

// HasCustomHome reports whether the deployment is configured to serve a custom
// home dashboard. It mirrors the path resolution in homeDashboardPath so the
// answer matches what the getter will actually serve.
func HasCustomHome(cfg *setting.Cfg) bool {
	if cfg.DefaultHomeDashboardPath != "" {
		// An explicit override is always considered custom, even if the file
		// happens to be missing — the getter will log and fall back, but the
		// operator's intent is clear.
		return true
	}

	loaded, err := os.ReadFile(filepath.Join(cfg.StaticRootPath, "dashboards/home.json"))
	if err != nil {
		return false
	}
	return !bytes.Equal(defaultHomeDashboardJSON, loaded)
}

func readDashboard(filePath string) (runtime.Object, error) {
	if filePath == "" {
		return nil, nil
	}

	// nolint:gosec // G304
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
	return readDashboardBytes(defaultHomeDashboardJSON)
}
