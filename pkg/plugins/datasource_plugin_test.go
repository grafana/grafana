package plugins

import (
	"testing"
)

func TestComposeBinaryName(t *testing.T) {
	tests := []struct {
		name string
		os   string
		arch string

		expectedPath string
	}{
		{
			name:         "simple-json",
			os:           "linux",
			arch:         "amd64",
			expectedPath: `simple-json_linux_amd64`,
		},
		{
			name:         "simple-json",
			os:           "windows",
			arch:         "amd64",
			expectedPath: `simple-json_windows_amd64.exe`,
		},
	}

	for _, v := range tests {
		have := composeBinaryName(v.name, v.os, v.arch)
		if have != v.expectedPath {
			t.Errorf("expected %s got %s", v.expectedPath, have)
		}
	}
}
