package marketplacelicensing

import (
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"
)

// TestLicensePath verifies marketplace license paths accept only safe plugin IDs.
func TestLicensePath(t *testing.T) {
	directory, err := filepath.Abs("marketplace-license-test")
	require.NoError(t, err)

	for _, tc := range []struct {
		name      string
		directory string
		pluginID  string
		want      string
		ok        bool
	}{
		{
			name:      "safe plugin ID",
			directory: directory,
			pluginID:  "acme-widget",
			want:      filepath.Join(directory, "license-acme-widget.jwt"),
			ok:        true,
		},
		{
			name:      "relative directory becomes absolute",
			directory: "marketplace-licenses",
			pluginID:  "acme-widget",
			want:      filepath.Join(mustAbs(t, "marketplace-licenses"), "license-acme-widget.jwt"),
			ok:        true,
		},
		{
			name:      "empty plugin ID",
			directory: directory,
			pluginID:  "",
		},
		{
			name:      "current directory plugin ID",
			directory: directory,
			pluginID:  ".",
		},
		{
			name:      "parent directory plugin ID",
			directory: directory,
			pluginID:  "..",
		},
		{
			name:      "parent path plugin ID",
			directory: directory,
			pluginID:  "../license",
		},
		{
			name:      "slash plugin ID",
			directory: directory,
			pluginID:  "acme/widget",
		},
		{
			name:      "backslash plugin ID",
			directory: directory,
			pluginID:  `acme\widget`,
		},
		{
			name:      "absolute plugin ID",
			directory: directory,
			pluginID:  "/tmp/license",
		},
		{
			name:      "windows absolute plugin ID",
			directory: directory,
			pluginID:  "C:\\license",
		},
		{
			name:      "windows drive relative plugin ID",
			directory: directory,
			pluginID:  "C:license",
		},
		{
			name:      "colon plugin ID",
			directory: directory,
			pluginID:  "acme:widget",
		},
		{
			name:      "NUL plugin ID",
			directory: directory,
			pluginID:  "acme\x00widget",
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			got, ok := LicensePath(tc.directory, tc.pluginID)
			require.Equal(t, tc.ok, ok)
			require.Equal(t, tc.want, got)
		})
	}
}

// mustAbs returns the absolute form of path or fails the test.
func mustAbs(t *testing.T, path string) string {
	t.Helper()
	abs, err := filepath.Abs(path)
	require.NoError(t, err)
	return abs
}
