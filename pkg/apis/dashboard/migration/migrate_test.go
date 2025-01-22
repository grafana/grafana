package migration_test

import (
	"encoding/json"
	"fmt"
	"io/fs"
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

// Use the UPDATE_SNAPSHOTS=true environment variable to update the output files.
func TestMigrate(t *testing.T) {
	files, err := os.ReadDir(INPUT_DIR)
	require.NoError(t, err)

	for _, f := range files {
		if f.IsDir() {
			continue
		}
		inputVersion, name := parseInputName(t, f.Name())
		for targetVersion := range schemaversion.Migrations {
			testName := fmt.Sprintf("%s v%d to v%d", name, inputVersion, targetVersion)
			t.Run(testName, func(t *testing.T) {
				testMigration(t, f, targetVersion)
			})
		}
	}
}

func testMigration(t *testing.T, file fs.DirEntry, targetVersion int) {
	t.Helper()
	dash, inputVersion, name := load(t, filepath.Join(INPUT_DIR, file.Name()))
	require.NoError(t, migration.Migrate(dash, targetVersion), "migration failed")

	outPath := filepath.Join(OUTPUT_DIR, fmt.Sprintf("%d.%s.%d.json", inputVersion, name, targetVersion))
	outBytes, err := json.MarshalIndent(dash, "", "  ")
	require.NoError(t, err, "failed to marshal migrated dashboard")

	if _, err := os.Stat(outPath); os.IsNotExist(err) || os.Getenv("UPDATE_SNAPSHOTS") == "true" {
		err = os.WriteFile(outPath, outBytes, 0644)
		require.NoError(t, err, "failed to write new output file", outPath)
		return
	}

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
	inputBytes, err := os.ReadFile(path)
	require.NoError(t, err, "failed to read embedded input file")
	require.NoError(t, json.Unmarshal(inputBytes, &dash), "failed to unmarshal dashboard JSON")
	inputVersion, name = parseInputName(t, path)
	return dash, inputVersion, name
}
