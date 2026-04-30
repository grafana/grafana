package licensing

import (
	"errors"
	"path/filepath"
	"strings"
	"testing"
)

func TestPluginLicensePath(t *testing.T) {
	const enterprisePath = "/var/lib/grafana/license.jwt"
	licenseFolder, err := filepath.Abs(filepath.Dir(enterprisePath))
	if err != nil {
		t.Fatalf("compute license folder: %v", err)
	}

	tests := []struct {
		name        string
		licensePath string
		pluginID    string
		wantPath    string
		wantErrIs   error
	}{
		{
			name:        "valid panel plugin id",
			licensePath: enterprisePath,
			pluginID:    "grafana-piechart-panel",
			wantPath:    filepath.Join(licenseFolder, "license-grafana-piechart-panel.jwt"),
		},
		{
			name:        "valid datasource with multi-segment name",
			licensePath: enterprisePath,
			pluginID:    "grafana-azure-monitor-datasource",
			wantPath:    filepath.Join(licenseFolder, "license-grafana-azure-monitor-datasource.jwt"),
		},
		{
			name:        "valid app plugin id",
			licensePath: enterprisePath,
			pluginID:    "vendor-something-app",
			wantPath:    filepath.Join(licenseFolder, "license-vendor-something-app.jwt"),
		},
		{
			name:        "empty plugin id",
			licensePath: enterprisePath,
			pluginID:    "",
			wantErrIs:   ErrInvalidPluginID,
		},
		{
			name:        "plugin id missing type segment",
			licensePath: enterprisePath,
			pluginID:    "grafana-piechart",
			wantErrIs:   ErrInvalidPluginID,
		},
		{
			name:        "plugin id with unknown type",
			licensePath: enterprisePath,
			pluginID:    "grafana-piechart-widget",
			wantErrIs:   ErrInvalidPluginID,
		},
		{
			name:        "plugin id with only type",
			licensePath: enterprisePath,
			pluginID:    "panel",
			wantErrIs:   ErrInvalidPluginID,
		},
		{
			name:        "plugin id with parent reference",
			licensePath: enterprisePath,
			pluginID:    "..",
			wantErrIs:   ErrInvalidPluginID,
		},
		{
			name:        "plugin id with traversal sequence",
			licensePath: enterprisePath,
			pluginID:    "../../etc/passwd",
			wantErrIs:   ErrInvalidPluginID,
		},
		{
			name:        "plugin id with backslash",
			licensePath: enterprisePath,
			pluginID:    `..\windows`,
			wantErrIs:   ErrInvalidPluginID,
		},
		{
			name:        "plugin id with forward slash",
			licensePath: enterprisePath,
			pluginID:    "foo/bar-panel",
			wantErrIs:   ErrInvalidPluginID,
		},
		{
			name:        "plugin id with NUL byte",
			licensePath: enterprisePath,
			pluginID:    "foo\x00bar-panel",
			wantErrIs:   ErrInvalidPluginID,
		},
		{
			name:        "plugin id with dot",
			licensePath: enterprisePath,
			pluginID:    "vendor.plugin-panel",
			wantErrIs:   ErrInvalidPluginID,
		},
		{
			name:        "plugin id with underscore",
			licensePath: enterprisePath,
			pluginID:    "my_vendor-name-panel",
			wantErrIs:   ErrInvalidPluginID,
		},
		{
			name:        "plugin id with consecutive dashes",
			licensePath: enterprisePath,
			pluginID:    "vendor--name-panel",
			wantErrIs:   ErrInvalidPluginID,
		},
		{
			name:        "license path not configured",
			licensePath: "",
			pluginID:    "grafana-piechart-panel",
			wantErrIs:   ErrLicensePathNotConfigured,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			s := &Service{licensePath: tc.licensePath}
			got, err := s.PluginLicensePath(tc.pluginID)

			if tc.wantErrIs != nil {
				if !errors.Is(err, tc.wantErrIs) {
					t.Fatalf("expected error %v, got %v", tc.wantErrIs, err)
				}
				if got != "" {
					t.Errorf("expected empty path on error, got %q", got)
				}
				return
			}

			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if got != tc.wantPath {
				t.Errorf("path mismatch: got %q want %q", got, tc.wantPath)
			}
			if !strings.HasPrefix(got, licenseFolder+string(filepath.Separator)) {
				t.Errorf("path %q escapes license folder %q", got, licenseFolder)
			}
		})
	}
}

func TestValidatePluginID(t *testing.T) {
	valid := []string{
		"grafana-piechart-panel",
		"grafana-azure-monitor-datasource",
		"vendor-name-app",
		"vendor-multi-segment-name-panel",
		"v3nd0r-n4me123-datasource",
	}
	for _, id := range valid {
		t.Run("valid/"+id, func(t *testing.T) {
			if err := validatePluginID(id); err != nil {
				t.Errorf("expected nil error, got %v", err)
			}
		})
	}

	invalid := []string{
		"",
		".",
		"..",
		"../foo",
		"foo/../bar",
		`foo\bar`,
		"foo/bar",
		"foo\x00bar-panel",
		"foo..bar-panel",
		"vendor.plugin-panel",
		"my_vendor-name-panel",
		"vendor-name",          // missing type
		"vendor-name-widget",   // unknown type
		"panel",                // type only
		"vendor-panel",         // missing name segment
		"-vendor-name-panel",   // leading dash
		"vendor-name-panel-",   // trailing dash
		"vendor--name-panel",   // empty segment
	}
	for _, id := range invalid {
		t.Run("invalid/"+id, func(t *testing.T) {
			if err := validatePluginID(id); !errors.Is(err, ErrInvalidPluginID) {
				t.Errorf("expected ErrInvalidPluginID, got %v", err)
			}
		})
	}
}
