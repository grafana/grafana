package schemaversion_test

import (
	"io/ioutil"
	"path/filepath"
	"regexp"
	"strings"
	"testing"

	"github.com/grafana/grafana/apps/dashboard/pkg/migration/schemaversion"
	"github.com/stretchr/testify/require"
)

// autoMigrateAngularMapping represents the Go definition of the autoMigrateAngular mapping
// This should be kept in sync with the TypeScript definition in PanelModel.ts

// extractAutoMigrateAngularFromTS extracts the autoMigrateAngular mapping from the TypeScript file
func extractAutoMigrateAngularFromTS(filePath string) (map[string]string, error) {
	content, err := ioutil.ReadFile(filePath)
	if err != nil {
		return nil, err
	}

	// Find the autoMigrateAngular object
	re := regexp.MustCompile(`export const autoMigrateAngular: Record<string, string> = \{([^}]+)\}`)
	matches := re.FindStringSubmatch(string(content))
	if len(matches) < 2 {
		return nil, nil
	}

	// Parse the key-value pairs
	result := make(map[string]string)
	lines := strings.Split(matches[1], "\n")

	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "//") {
			continue
		}

		// Match patterns like: graph: 'timeseries', or 'table-old': 'table',
		// Handle both quoted and unquoted keys
		kvRe := regexp.MustCompile(`(?:'([^']+)'|(\w+(?:-\w+)*)):\s*'([^']+)'`)
		kvMatches := kvRe.FindStringSubmatch(line)
		if len(kvMatches) >= 4 {
			key := kvMatches[1] // quoted key
			if key == "" {
				key = kvMatches[2] // unquoted key
			}
			value := kvMatches[3]
			result[key] = value
		}
	}

	return result, nil
}

func TestAutoMigrateAngularMappingConsistency(t *testing.T) {
	// Get the path to the TypeScript file relative to the workspace root
	// The test runs from apps/dashboard/pkg/migration/schemaversion, so we need to go up 5 levels
	tsFilePath := filepath.Join("..", "..", "..", "..", "..", "public", "app", "features", "dashboard", "state", "PanelModel.ts")

	// Extract the TypeScript definition
	tsMapping, err := extractAutoMigrateAngularFromTS(tsFilePath)
	require.NoError(t, err)
	require.NotNil(t, tsMapping, "Could not extract autoMigrateAngular from TypeScript file")

	// Compare the mappings
	require.Equal(t, len(tsMapping), len(schemaversion.AutoMigrateAngular),
		"Go and TypeScript mappings have different lengths")

	// Check that all TypeScript mappings exist in Go
	for tsKey, tsValue := range tsMapping {
		goValue, exists := schemaversion.AutoMigrateAngular[tsKey]
		require.True(t, exists, "TypeScript key '%s' not found in Go mapping", tsKey)
		require.Equal(t, tsValue, goValue,
			"Mismatch for key '%s': TypeScript='%s', Go='%s'", tsKey, tsValue, goValue)
	}

	// Check that all Go mappings exist in TypeScript
	for goKey, goValue := range schemaversion.AutoMigrateAngular {
		tsValue, exists := tsMapping[goKey]
		require.True(t, exists, "Go key '%s' not found in TypeScript mapping", goKey)
		require.Equal(t, goValue, tsValue,
			"Mismatch for key '%s': Go='%s', TypeScript='%s'", goKey, goValue, tsValue)
	}

	t.Logf("✅ autoMigrateAngular mapping is consistent between Go and TypeScript")
	t.Logf("   Total mappings: %d", len(schemaversion.AutoMigrateAngular))
	for key, value := range schemaversion.AutoMigrateAngular {
		t.Logf("   %s -> %s", key, value)
	}
}

func TestAutoMigrateAngularMappingCompleteness(t *testing.T) {
	// Test that all expected panel types are included
	expectedKeys := []string{
		"graph",
		"table-old",
		"singlestat",
		"grafana-singlestat-panel",
		"grafana-piechart-panel",
		"grafana-worldmap-panel",
		"natel-discrete-panel",
	}

	for _, key := range expectedKeys {
		_, exists := schemaversion.AutoMigrateAngular[key]
		require.True(t, exists, "Expected key '%s' not found in autoMigrateAngular mapping", key)
	}

	// Test that all values are valid panel types
	validPanelTypes := map[string]bool{
		"timeseries":     true,
		"table":          true,
		"stat":           true,
		"piechart":       true,
		"geomap":         true,
		"state-timeline": true,
	}

	for key, value := range schemaversion.AutoMigrateAngular {
		require.True(t, validPanelTypes[value],
			"Invalid panel type '%s' for key '%s' in autoMigrateAngular mapping", value, key)
	}
}
