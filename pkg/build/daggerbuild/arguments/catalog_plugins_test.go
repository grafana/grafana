package arguments

import (
	"context"
	"io"
	"log/slog"
	"os"
	"path/filepath"
	"reflect"
	"testing"

	"github.com/grafana/grafana/pkg/build/daggerbuild/pipeline"
)

func TestParseCatalogPluginsList(t *testing.T) {
	tests := []struct {
		name    string
		input   string
		want    []CatalogPluginSpec
		wantErr bool
	}{
		{
			name:  "empty string returns nil",
			input: "",
			want:  nil,
		},
		{
			name:  "single plugin with version",
			input: "grafana-clock-panel:1.3.1",
			want: []CatalogPluginSpec{
				{ID: "grafana-clock-panel", Version: "1.3.1"},
			},
		},
		{
			name:  "single plugin without version (latest compatible)",
			input: "grafana-lokiexplore-app",
			want: []CatalogPluginSpec{
				{ID: "grafana-lokiexplore-app", Version: ""},
			},
		},
		{
			name:  "multiple plugins with versions",
			input: "grafana-clock-panel:1.3.1,grafana-worldmap-panel:1.0.6",
			want: []CatalogPluginSpec{
				{ID: "grafana-clock-panel", Version: "1.3.1"},
				{ID: "grafana-worldmap-panel", Version: "1.0.6"},
			},
		},
		{
			name:  "multiple plugins without versions (latest compatible)",
			input: "grafana-lokiexplore-app,grafana-pyroscope-app",
			want: []CatalogPluginSpec{
				{ID: "grafana-lokiexplore-app", Version: ""},
				{ID: "grafana-pyroscope-app", Version: ""},
			},
		},
		{
			name:  "mixed - some with version, some without",
			input: "grafana-lokiexplore-app,grafana-pyroscope-app:1.5.0,grafana-exploretraces-app",
			want: []CatalogPluginSpec{
				{ID: "grafana-lokiexplore-app", Version: ""},
				{ID: "grafana-pyroscope-app", Version: "1.5.0"},
				{ID: "grafana-exploretraces-app", Version: ""},
			},
		},
		{
			name:  "plugins with spaces",
			input: "grafana-clock-panel:1.3.1 , grafana-worldmap-panel:1.0.6",
			want: []CatalogPluginSpec{
				{ID: "grafana-clock-panel", Version: "1.3.1"},
				{ID: "grafana-worldmap-panel", Version: "1.0.6"},
			},
		},
		{
			name:  "trailing comma is ignored",
			input: "grafana-clock-panel:1.3.1,",
			want: []CatalogPluginSpec{
				{ID: "grafana-clock-panel", Version: "1.3.1"},
			},
		},
		{
			name:    "empty id with colon",
			input:   ":1.3.1",
			wantErr: true,
		},
		{
			name:  "id with empty version after colon",
			input: "grafana-clock-panel:",
			want: []CatalogPluginSpec{
				{ID: "grafana-clock-panel", Version: ""},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := ParseCatalogPluginsList(tt.input)
			if (err != nil) != tt.wantErr {
				t.Errorf("ParseCatalogPluginsList() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if !tt.wantErr {
				if len(got) != len(tt.want) {
					t.Errorf("ParseCatalogPluginsList() returned %d plugins, want %d", len(got), len(tt.want))
					return
				}
				for i, plugin := range got {
					if plugin.ID != tt.want[i].ID || plugin.Version != tt.want[i].Version {
						t.Errorf("ParseCatalogPluginsList()[%d] = %v, want %v", i, plugin, tt.want[i])
					}
				}
			}
		})
	}
}

func TestParseCatalogPluginsFile(t *testing.T) {
	tests := []struct {
		name    string
		content string
		want    []CatalogPluginSpec
		wantErr bool
	}{
		{
			name:    "empty plugins array",
			content: `{"plugins": []}`,
			want:    []CatalogPluginSpec{},
		},
		{
			name: "single plugin with version",
			content: `{
				"plugins": [
					{"id": "grafana-clock-panel", "version": "1.3.1"}
				]
			}`,
			want: []CatalogPluginSpec{
				{ID: "grafana-clock-panel", Version: "1.3.1"},
			},
		},
		{
			name: "single plugin without version (latest compatible)",
			content: `{
				"plugins": [
					{"id": "grafana-lokiexplore-app"}
				]
			}`,
			want: []CatalogPluginSpec{
				{ID: "grafana-lokiexplore-app", Version: ""},
			},
		},
		{
			name: "multiple plugins with checksum",
			content: `{
				"plugins": [
					{"id": "grafana-clock-panel", "version": "1.3.1"},
					{"id": "grafana-worldmap-panel", "version": "1.0.6", "checksum": "sha256:abc123"}
				]
			}`,
			want: []CatalogPluginSpec{
				{ID: "grafana-clock-panel", Version: "1.3.1"},
				{ID: "grafana-worldmap-panel", Version: "1.0.6", Checksum: "sha256:abc123"},
			},
		},
		{
			name: "mixed - some with version, some without",
			content: `{
				"plugins": [
					{"id": "grafana-lokiexplore-app"},
					{"id": "grafana-pyroscope-app", "version": "1.5.0"},
					{"id": "grafana-exploretraces-app", "checksum": "sha256:def456"}
				]
			}`,
			want: []CatalogPluginSpec{
				{ID: "grafana-lokiexplore-app", Version: ""},
				{ID: "grafana-pyroscope-app", Version: "1.5.0"},
				{ID: "grafana-exploretraces-app", Version: "", Checksum: "sha256:def456"},
			},
		},
		{
			name: "missing id",
			content: `{
				"plugins": [
					{"version": "1.3.1"}
				]
			}`,
			wantErr: true,
		},
		{
			name:    "invalid json",
			content: `{invalid}`,
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create a temporary file
			tmpDir := t.TempDir()
			tmpFile := filepath.Join(tmpDir, "plugins.json")
			if err := os.WriteFile(tmpFile, []byte(tt.content), 0644); err != nil {
				t.Fatalf("Failed to write temp file: %v", err)
			}

			got, err := ParseCatalogPluginsFile(tmpFile)
			if (err != nil) != tt.wantErr {
				t.Errorf("ParseCatalogPluginsFile() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if !tt.wantErr {
				if len(got) != len(tt.want) {
					t.Errorf("ParseCatalogPluginsFile() returned %d plugins, want %d", len(got), len(tt.want))
					return
				}
				for i, plugin := range got {
					if plugin.ID != tt.want[i].ID || plugin.Version != tt.want[i].Version || plugin.Checksum != tt.want[i].Checksum {
						t.Errorf("ParseCatalogPluginsFile()[%d] = %v, want %v", i, plugin, tt.want[i])
					}
				}
			}
		})
	}
}

func TestParseCatalogPluginsFile_FileNotFound(t *testing.T) {
	_, err := ParseCatalogPluginsFile("/nonexistent/path/plugins.json")
	if err == nil {
		t.Error("ParseCatalogPluginsFile() should return error for non-existent file")
	}
}

func TestMergeCatalogPluginSpecs(t *testing.T) {
	tests := []struct {
		name    string
		input   []CatalogPluginSpec
		want    []CatalogPluginSpec
		wantErr bool
	}{
		{
			name: "dedupe identical entries",
			input: []CatalogPluginSpec{
				{ID: "grafana-clock-panel", Version: "1.3.1"},
				{ID: "grafana-clock-panel", Version: "1.3.1"},
			},
			want: []CatalogPluginSpec{
				{ID: "grafana-clock-panel", Version: "1.3.1"},
			},
		},
		{
			name: "merge checksum enrichment",
			input: []CatalogPluginSpec{
				{ID: "grafana-clock-panel", Version: "1.3.1"},
				{ID: "grafana-clock-panel", Version: "1.3.1", Checksum: "sha256:abc123"},
			},
			want: []CatalogPluginSpec{
				{ID: "grafana-clock-panel", Version: "1.3.1", Checksum: "sha256:abc123"},
			},
		},
		{
			name: "conflicting versions fail",
			input: []CatalogPluginSpec{
				{ID: "grafana-clock-panel", Version: "1.3.1"},
				{ID: "grafana-clock-panel", Version: "1.4.0"},
			},
			wantErr: true,
		},
		{
			name: "conflicting checksums fail",
			input: []CatalogPluginSpec{
				{ID: "grafana-clock-panel", Version: "1.3.1", Checksum: "sha256:abc123"},
				{ID: "grafana-clock-panel", Version: "1.3.1", Checksum: "sha256:def456"},
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := MergeCatalogPluginSpecs(tt.input)
			if (err != nil) != tt.wantErr {
				t.Fatalf("MergeCatalogPluginSpecs() error = %v, wantErr %v", err, tt.wantErr)
			}
			if tt.wantErr {
				return
			}
			if !reflect.DeepEqual(got, tt.want) {
				t.Fatalf("MergeCatalogPluginSpecs() = %#v, want %#v", got, tt.want)
			}
		})
	}
}

func TestGetCatalogPlugins_WithWrappedState(t *testing.T) {
	state := &pipeline.State{
		CLIContext: &fakeCLIContext{
			stringSliceValues: map[string][]string{
				"bundle-catalog-plugins": {"grafana-clock-panel:1.3.1,grafana-clock-panel:1.3.1"},
			},
		},
	}

	wrapped := pipeline.StateWithLogger(
		slog.New(slog.NewTextHandler(io.Discard, nil)),
		state,
	)

	got, err := GetCatalogPlugins(context.Background(), wrapped)
	if err != nil {
		t.Fatalf("GetCatalogPlugins() error = %v", err)
	}

	want := []CatalogPluginSpec{
		{ID: "grafana-clock-panel", Version: "1.3.1"},
	}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("GetCatalogPlugins() = %#v, want %#v", got, want)
	}
}

type fakeCLIContext struct {
	boolValues        map[string]bool
	stringValues      map[string]string
	stringSliceValues map[string][]string
	int64Values       map[string]int64
}

func (f *fakeCLIContext) Bool(name string) bool {
	if f.boolValues == nil {
		return false
	}
	return f.boolValues[name]
}

func (f *fakeCLIContext) String(name string) string {
	if f.stringValues == nil {
		return ""
	}
	return f.stringValues[name]
}

func (f *fakeCLIContext) Set(name, value string) error {
	if f.stringValues == nil {
		f.stringValues = map[string]string{}
	}
	f.stringValues[name] = value
	return nil
}

func (f *fakeCLIContext) StringSlice(name string) []string {
	if f.stringSliceValues == nil {
		return nil
	}
	return f.stringSliceValues[name]
}

func (f *fakeCLIContext) Path(name string) string {
	return f.String(name)
}

func (f *fakeCLIContext) Int64(name string) int64 {
	if f.int64Values == nil {
		return 0
	}
	return f.int64Values[name]
}
