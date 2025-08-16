package app

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestToMetadataName(t *testing.T) {
	tests := []struct {
		id        string
		version   string
		expected  string
		expectErr bool
	}{
		{"test", "1.0.0", "test_1.0.0", false},
		{"test", "1.0.0-beta1", "test_1.0.0-beta1", false},
		{"test", "1.0.0-beta1+build.1", "test_1.0.0-beta1+build.1", false},
		{"", "1.0.0", "", true},
		{"test", "", "", true},
		{"", "", "", true},
	}

	for _, test := range tests {
		t.Run(test.id, func(t *testing.T) {
			actual, err := ToMetadataName(test.id, test.version)
			if test.expectErr {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)
			require.Equal(t, test.expected, actual)
		})
	}
}

func TestFromMetadataName(t *testing.T) {
	tests := []struct {
		name     string
		expected struct {
			id      string
			version string
		}
		expectedOk bool
	}{
		{"test_1.0.0", struct {
			id      string
			version string
		}{id: "test", version: "1.0.0"}, true},
		{"test_1.0.0-beta1", struct {
			id      string
			version string
		}{id: "test", version: "1.0.0-beta1"}, true},
		{"test_1.0.0-beta1+build.1", struct {
			id      string
			version string
		}{id: "test", version: "1.0.0-beta1+build.1"}, true},
		{"test-1.0.0", struct {
			id      string
			version string
		}{id: "", version: ""}, false},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			id, version, ok := FromMetadataName(test.name)
			if test.expectedOk {
				require.True(t, ok)
				require.Equal(t, test.expected.id, id)
				require.Equal(t, test.expected.version, version)
			} else {
				require.False(t, ok)
			}
		})
	}
}
