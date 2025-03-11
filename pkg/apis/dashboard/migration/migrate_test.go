package migration_test

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apis/dashboard/migration"
	"github.com/grafana/grafana/pkg/apis/dashboard/migration/schemaversion"
)

const INPUT_DIR = "testdata/input"
const OUTPUT_DIR = "testdata/output"

func TestMigrate(t *testing.T) {
	files, err := os.ReadDir(INPUT_DIR)
	require.NoError(t, err)

	for _, f := range files {
		if f.IsDir() {
			continue
		}

		inputDash, inputVersion, name := load(t, filepath.Join(INPUT_DIR, f.Name()))

		t.Run("input check "+f.Name(), func(t *testing.T) {
			// use input version as the target version to ensure there are no changes
			require.NoError(t, migration.Migrate(inputDash, inputVersion), "input check migration failed")
			outBytes, err := json.MarshalIndent(inputDash, "", "  ")
			require.NoError(t, err, "failed to marshal migrated dashboard")
			// We can ignore gosec G304 here since it's a test
			// nolint:gosec
			expectedDash, err := os.ReadFile(filepath.Join(INPUT_DIR, f.Name()))
			require.NoError(t, err, "failed to read expected output file")
			require.JSONEq(t, string(expectedDash), string(outBytes), "%s input check did not match", f.Name())
		})

		for targetVersion := inputVersion + 1; targetVersion <= schemaversion.LATEST_VERSION; targetVersion++ {
			testName := fmt.Sprintf("%s v%d to v%d", name, inputVersion, targetVersion)
			t.Run(testName, func(t *testing.T) {
				testMigration(t, inputDash, name, inputVersion, targetVersion)
			})
		}
	}
}

func testMigration(t *testing.T, dash map[string]interface{}, name string, inputVersion, targetVersion int) {
	t.Helper()
	require.NoError(t, migration.Migrate(dash, targetVersion), "%d migration failed", targetVersion)

	outPath := filepath.Join(OUTPUT_DIR, fmt.Sprintf("%d.%s.%d.json", inputVersion, name, targetVersion))
	outBytes, err := json.MarshalIndent(dash, "", "  ")
	require.NoError(t, err, "failed to marshal migrated dashboard")

	if _, err := os.Stat(outPath); os.IsNotExist(err) {
		err = os.WriteFile(outPath, outBytes, 0644)
		require.NoError(t, err, "failed to write new output file", outPath)
		return
	}

	// We can ignore gosec G304 here since it's a test
	// nolint:gosec
	existingBytes, err := os.ReadFile(outPath)
	require.NoError(t, err, "failed to read existing output file")
	require.JSONEq(t, string(existingBytes), string(outBytes), "%s did not match", outPath)
}

func parseInputName(t *testing.T, name string) (int, string) {
	t.Helper()
	parts := strings.SplitN(filepath.Base(name), ".", 3)
	if len(parts) < 3 {
		t.Fatalf("invalid input filename: %s", name)
	}
	iv, err := strconv.Atoi(parts[0])
	require.NoError(t, err, "failed to parse input version")
	return iv, parts[1]
}

func load(t *testing.T, path string) (dash map[string]interface{}, inputVersion int, name string) {
	// We can ignore gosec G304 here since it's a test
	// nolint:gosec
	inputBytes, err := os.ReadFile(path)
	require.NoError(t, err, "failed to read embedded input file")
	require.NoError(t, json.Unmarshal(inputBytes, &dash), "failed to unmarshal dashboard JSON")
	inputVersion, name = parseInputName(t, path)
	return dash, inputVersion, name
}
