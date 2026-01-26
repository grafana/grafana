package arguments

import (
	"os"
	"path/filepath"
	"testing"
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
			name:  "single plugin",
			input: "grafana-clock-panel:1.3.1",
			want: []CatalogPluginSpec{
				{ID: "grafana-clock-panel", Version: "1.3.1"},
			},
		},
		{
			name:  "multiple plugins",
			input: "grafana-clock-panel:1.3.1,grafana-worldmap-panel:1.0.6",
			want: []CatalogPluginSpec{
				{ID: "grafana-clock-panel", Version: "1.3.1"},
				{ID: "grafana-worldmap-panel", Version: "1.0.6"},
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
			name:    "missing version",
			input:   "grafana-clock-panel",
			wantErr: true,
		},
		{
			name:    "empty id",
			input:   ":1.3.1",
			wantErr: true,
		},
		{
			name:    "empty version",
			input:   "grafana-clock-panel:",
			wantErr: true,
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
			name: "single plugin",
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
			name: "missing id",
			content: `{
				"plugins": [
					{"version": "1.3.1"}
				]
			}`,
			wantErr: true,
		},
		{
			name: "missing version",
			content: `{
				"plugins": [
					{"id": "grafana-clock-panel"}
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
