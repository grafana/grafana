package home

import (
	"encoding/json"
	"fmt"
	"os"

	"k8s.io/apimachinery/pkg/runtime"

	dashv0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	"github.com/grafana/grafana/apps/dashboard/pkg/migration/conversion"
	"github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	"github.com/grafana/grafana/pkg/setting"
)

// HasCustomHome reports whether the deployment is configured to serve a custom
// home dashboard via default_home_dashboard_path. When unset, Grafana uses the
// unified React homepage instead of a bundled dashboard JSON file.
func HasCustomHome(cfg *setting.Cfg) bool {
	return cfg.DefaultHomeDashboardPath != ""
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
