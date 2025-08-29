package migration_test

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/apps/dashboard/pkg/migration"
	"github.com/grafana/grafana/apps/dashboard/pkg/migration/schemaversion"
	"github.com/grafana/grafana/apps/dashboard/pkg/migration/testutil"
)

const INPUT_DIR = "testdata/input"
const OUTPUT_DIR = "testdata/output"
const DEV_DASHBOARDS_INPUT_DIR = "../../../../devenv/dev-dashboards"
const DEV_DASHBOARDS_OUTPUT_DIR = "testdata/dev-dashboards-output"
const HISTORICAL_DASHBOARDS_INPUT_DIR = "testdata/historical-dashboards-input"
const HISTORICAL_DASHBOARDS_OUTPUT_DIR = "testdata/historical-dashboards-output"
const COMMUNITY_DASHBOARDS_INPUT_DIR = "testdata/community-dashboards-input"
const COMMUNITY_DASHBOARDS_OUTPUT_DIR = "testdata/community-dashboards-output"
const COMMUNITY_OLDEST_INPUT_DIR = "testdata/community-dashboards-input/oldest"
const COMMUNITY_NEWEST_INPUT_DIR = "testdata/community-dashboards-input/newest"
const COMMUNITY_AVERAGE_INPUT_DIR = "testdata/community-dashboards-input/average"
const COMMUNITY_OLDEST_OUTPUT_DIR = "testdata/community-dashboards-output/oldest"
const COMMUNITY_NEWEST_OUTPUT_DIR = "testdata/community-dashboards-output/newest"
const COMMUNITY_AVERAGE_OUTPUT_DIR = "testdata/community-dashboards-output/average"
const OLDEST_HISTORICAL_INPUT_DIR = "testdata/oldest-historical-input"
const OLDEST_HISTORICAL_OUTPUT_DIR = "testdata/oldest-historical-output"

func TestMigrate(t *testing.T) {
	files, err := os.ReadDir(INPUT_DIR)
	require.NoError(t, err)

	// Use the same datasource provider as the frontend test to ensure consistency
	migration.Initialize(testutil.GetTestDataSourceProvider(), testutil.GetTestPanelProvider())

	t.Run("minimum version check", func(t *testing.T) {
		err := migration.Migrate(map[string]interface{}{
			"schemaVersion": schemaversion.MIN_VERSION - 1,
		}, schemaversion.MIN_VERSION)

		var minVersionErr = schemaversion.NewMinimumVersionError(schemaversion.MIN_VERSION - 1)
		require.ErrorAs(t, err, &minVersionErr)
	})

	for _, f := range files {
		if f.IsDir() {
			continue
		}

		// Validate filename format
		if !strings.HasPrefix(f.Name(), "v") || !strings.HasSuffix(f.Name(), ".json") {
			t.Fatalf("input filename must use v{N}.{name}.json format, got: %s", f.Name())
		}

		inputDash := loadDashboard(t, filepath.Join(INPUT_DIR, f.Name()))
		inputVersion := getSchemaVersion(t, inputDash)

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

		testName := fmt.Sprintf("%s v%d to v%d", f.Name(), inputVersion, schemaversion.LATEST_VERSION)
		t.Run(testName, func(t *testing.T) {
			testMigration(t, inputDash, f.Name(), schemaversion.LATEST_VERSION)
		})
	}
}

func testMigration(t *testing.T, dash map[string]interface{}, inputFileName string, targetVersion int) {
	t.Helper()
	require.NoError(t, migration.Migrate(dash, targetVersion), "%d migration failed", targetVersion)

	outPath := filepath.Join(OUTPUT_DIR, inputFileName)
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

func getSchemaVersion(t *testing.T, dash map[string]interface{}) int {
	t.Helper()
	version, ok := dash["schemaVersion"]
	require.True(t, ok, "dashboard missing schemaVersion")

	switch v := version.(type) {
	case int:
		return v
	case float64:
		return int(v)
	default:
		t.Fatalf("invalid schemaVersion type: %T", version)
		return 0
	}
}

func loadDashboard(t *testing.T, path string) map[string]interface{} {
	t.Helper()
	// We can ignore gosec G304 here since it's a test
	// nolint:gosec
	inputBytes, err := os.ReadFile(path)
	require.NoError(t, err, "failed to read input file")

	var dash map[string]interface{}
	require.NoError(t, json.Unmarshal(inputBytes, &dash), "failed to unmarshal dashboard JSON")
	return dash
}

// findJSONFiles recursively finds all .json files in a directory
func findJSONFiles(dir string) ([]string, error) {
	var jsonFiles []string

	err := filepath.Walk(dir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if !info.IsDir() && strings.HasSuffix(strings.ToLower(info.Name()), ".json") {
			jsonFiles = append(jsonFiles, path)
		}
		return nil
	})

	return jsonFiles, err
}

// getRelativeOutputPath converts an input path to a relative output path preserving directory structure
func getRelativeOutputPath(inputPath, inputDir string) string {
	// Get the relative path from the input directory
	relPath, err := filepath.Rel(inputDir, inputPath)
	if err != nil {
		// If we can't get relative path, just use the filename
		return filepath.Base(inputPath)
	}
	// Preserve the directory structure
	return relPath
}

func TestMigrateDevDashboards(t *testing.T) {
	// Use the same datasource provider as the frontend test to ensure consistency
	migration.Initialize(testutil.GetTestDataSourceProvider(), testutil.GetTestPanelProvider())

	// Find all JSON files in the dev-dashboards directory
	jsonFiles, err := findJSONFiles(DEV_DASHBOARDS_INPUT_DIR)
	require.NoError(t, err, "failed to find JSON files in dev-dashboards directory")

	// Ensure output directory exists
	err = os.MkdirAll(DEV_DASHBOARDS_OUTPUT_DIR, 0755)
	require.NoError(t, err, "failed to create output directory")

	t.Logf("Found %d JSON files in dev-dashboards", len(jsonFiles))

	for _, jsonFile := range jsonFiles {
		relativeOutputPath := getRelativeOutputPath(jsonFile, DEV_DASHBOARDS_INPUT_DIR)

		// Create individual test cases for each dashboard (including invalid ones)
		t.Run("validate "+relativeOutputPath, func(t *testing.T) {
			// Load the dashboard
			inputDash := loadDashboard(t, jsonFile)

			// Check for missing schemaVersion
			if _, ok := inputDash["schemaVersion"]; !ok {
				t.Fatalf("Dashboard %s has no schemaVersion - this is not a valid dashboard for migration testing", relativeOutputPath)
			}

			inputVersion := getSchemaVersion(t, inputDash)

			// Check for schema version below minimum
			if inputVersion < schemaversion.MIN_VERSION {
				t.Fatalf("Dashboard %s has schema version %d which is below minimum supported version %d", relativeOutputPath, inputVersion, schemaversion.MIN_VERSION)
			}

			// If we get here, the dashboard is valid - run the migrations
			// Create a copy for the input check
			inputDashCopy := make(map[string]interface{})
			for k, v := range inputDash {
				inputDashCopy[k] = v
			}

			// Input check: migrate to same version should not change anything
			err := migration.Migrate(inputDashCopy, inputVersion)
			if err != nil {
				t.Fatalf("Input check migration failed for %s (v%d): %v", relativeOutputPath, inputVersion, err)
			}
			outBytes, err := json.MarshalIndent(inputDashCopy, "", "  ")
			require.NoError(t, err, "failed to marshal migrated dashboard")
			// We can ignore gosec G304 here since it's a test
			// nolint:gosec
			expectedDash, err := os.ReadFile(jsonFile)
			require.NoError(t, err, "failed to read expected output file")
			require.JSONEq(t, string(expectedDash), string(outBytes), "%s input check did not match", relativeOutputPath)
		})

		t.Run("migrate "+relativeOutputPath, func(t *testing.T) {
			// Load the dashboard fresh for migration test
			inputDash := loadDashboard(t, jsonFile)

			// Skip if invalid (will be caught by validate test above)
			if _, ok := inputDash["schemaVersion"]; !ok {
				t.Skip("Dashboard has no schemaVersion")
			}
			inputVersion := getSchemaVersion(t, inputDash)
			if inputVersion < schemaversion.MIN_VERSION {
				t.Skip("Dashboard schema version below minimum")
			}

			testDevDashboardMigration(t, inputDash, relativeOutputPath, schemaversion.LATEST_VERSION)
		})
	}
}

// TestMigrateHistoricalDashboards tests migration of all collected historical dashboards
// and generates output files following the same pattern as TestMigrateDevDashboards
func TestMigrateHistoricalDashboards(t *testing.T) {
	// Use the same datasource provider as other tests for consistency
	migration.Initialize(testutil.GetTestDataSourceProvider(), testutil.GetTestPanelProvider())

	// Find all historical dashboard files (historical-vXXX.*.json) in HISTORICAL_DASHBOARDS_INPUT_DIR
	historicalFiles, err := filepath.Glob(filepath.Join(HISTORICAL_DASHBOARDS_INPUT_DIR, "historical-*.json"))
	require.NoError(t, err, "failed to find historical dashboard files")
	require.NotEmpty(t, historicalFiles, "no historical dashboard files found")

	// Ensure output directory exists
	err = os.MkdirAll(HISTORICAL_DASHBOARDS_OUTPUT_DIR, 0755)
	require.NoError(t, err, "failed to create historical dashboards output directory")

	t.Logf("Found %d historical dashboard files", len(historicalFiles))

	for _, jsonFile := range historicalFiles {
		fileName := filepath.Base(jsonFile)

		// Skip non-historical files
		if !strings.HasPrefix(fileName, "historical-") {
			continue
		}

		// Use filename as relative output path (since historical files are flat in INPUT_DIR)
		relativeOutputPath := fileName

		// Create individual test cases for each dashboard (including invalid ones)
		t.Run("validate "+relativeOutputPath, func(t *testing.T) {
			// Load the dashboard
			inputDash := loadDashboard(t, jsonFile)

			// Check for missing schemaVersion
			if _, ok := inputDash["schemaVersion"]; !ok {
				t.Fatalf("Dashboard %s has no schemaVersion - this is not a valid dashboard for migration testing", relativeOutputPath)
			}

			inputVersion := getSchemaVersion(t, inputDash)

			// Check for schema version below minimum
			if inputVersion < schemaversion.MIN_VERSION {
				t.Fatalf("Dashboard %s has schema version %d which is below minimum supported version %d", relativeOutputPath, inputVersion, schemaversion.MIN_VERSION)
			}

			// If we get here, the dashboard is valid - run the migrations
			// Create a copy for the input check
			inputDashCopy := make(map[string]interface{})
			for k, v := range inputDash {
				inputDashCopy[k] = v
			}

			// Input check: migrate to same version should not change anything
			err := migration.Migrate(inputDashCopy, inputVersion)
			if err != nil {
				t.Fatalf("Input check migration failed for %s (v%d): %v", relativeOutputPath, inputVersion, err)
			}
			outBytes, err := json.MarshalIndent(inputDashCopy, "", "  ")
			require.NoError(t, err, "failed to marshal migrated dashboard")
			// We can ignore gosec G304 here since it's a test
			// nolint:gosec
			expectedDash, err := os.ReadFile(jsonFile)
			require.NoError(t, err, "failed to read expected output file")
			require.JSONEq(t, string(expectedDash), string(outBytes), "%s input check did not match", relativeOutputPath)
		})

		t.Run("migrate "+relativeOutputPath, func(t *testing.T) {
			// Load the dashboard fresh for migration test
			inputDash := loadDashboard(t, jsonFile)

			// Skip if invalid (will be caught by validate test above)
			if _, ok := inputDash["schemaVersion"]; !ok {
				t.Skip("Dashboard has no schemaVersion")
			}
			inputVersion := getSchemaVersion(t, inputDash)
			if inputVersion < schemaversion.MIN_VERSION {
				t.Skip("Dashboard schema version below minimum")
			}

			testHistoricalDashboardMigration(t, inputDash, relativeOutputPath, schemaversion.LATEST_VERSION)
		})
	}
}

// TestMigrateCommunityDashboards tests migration of all community dashboards (all revisions)
func TestMigrateCommunityDashboards(t *testing.T) {
	// Use the same datasource provider as other tests for consistency
	migration.Initialize(testutil.GetTestDataSourceProvider(), testutil.GetTestPanelProvider())

	// Test all categories (oldest, newest, average) in one unified test
	categories := []struct {
		name      string
		inputDir  string
		outputDir string
	}{
		{"oldest", COMMUNITY_OLDEST_INPUT_DIR, COMMUNITY_OLDEST_OUTPUT_DIR},
		{"newest", COMMUNITY_NEWEST_INPUT_DIR, COMMUNITY_NEWEST_OUTPUT_DIR},
		{"average", COMMUNITY_AVERAGE_INPUT_DIR, COMMUNITY_AVERAGE_OUTPUT_DIR},
	}

	for _, category := range categories {
		// Check if directory exists before processing
		if _, err := os.Stat(category.inputDir); os.IsNotExist(err) {
			t.Logf("Skipping category %s - directory %s does not exist", category.name, category.inputDir)
			continue
		}

		// Find all community dashboard files in this category
		communityFiles, err := filepath.Glob(filepath.Join(category.inputDir, "community-*.json"))
		if err != nil {
			t.Logf("Failed to find community dashboard files in %s: %v", category.inputDir, err)
			continue
		}

		if len(communityFiles) == 0 {
			t.Logf("No community dashboard files found in %s", category.inputDir)
			continue
		}

		// Ensure output directory exists
		err = os.MkdirAll(category.outputDir, 0755)
		require.NoError(t, err, "failed to create community dashboards output directory %s", category.outputDir)

		t.Logf("Found %d community dashboard files (%s)", len(communityFiles), category.name)

		for _, jsonFile := range communityFiles {
			fileName := filepath.Base(jsonFile)

			// Skip non-community files
			if !strings.HasPrefix(fileName, "community-") {
				continue
			}

			// Use filename as relative output path
			relativeOutputPath := fileName

			// Create individual test cases for each dashboard (including invalid ones)
			t.Run(fmt.Sprintf("validate_%s_%s", category.name, relativeOutputPath), func(t *testing.T) {
				// Load the dashboard
				inputDash := loadDashboard(t, jsonFile)

				// Check for missing schemaVersion
				if _, ok := inputDash["schemaVersion"]; !ok {
					t.Fatalf("Dashboard %s has no schemaVersion - this is not a valid dashboard for migration testing", relativeOutputPath)
				}

				inputVersion := getSchemaVersion(t, inputDash)

				// Check for schema version below minimum
				if inputVersion < schemaversion.MIN_VERSION {
					t.Fatalf("Dashboard %s (%s) has schema version %d which is below minimum supported version %d", relativeOutputPath, category.name, inputVersion, schemaversion.MIN_VERSION)
				}

				// If we get here, the dashboard is valid - run the migrations
				// Create a copy for the input check
				inputDashCopy := make(map[string]interface{})
				for k, v := range inputDash {
					inputDashCopy[k] = v
				}

				// Input check: migrate to same version should not change anything
				err := migration.Migrate(inputDashCopy, inputVersion)
				if err != nil {
					t.Fatalf("Input check migration failed for %s (%s, v%d): %v", relativeOutputPath, category.name, inputVersion, err)
				}
				outBytes, err := json.MarshalIndent(inputDashCopy, "", "  ")
				require.NoError(t, err, "failed to marshal migrated dashboard")
				// We can ignore gosec G304 here since it's a test
				// nolint:gosec
				expectedDash, err := os.ReadFile(jsonFile)
				require.NoError(t, err, "failed to read expected output file")
				require.JSONEq(t, string(expectedDash), string(outBytes), "%s (%s) input check did not match", relativeOutputPath, category.name)
			})

			t.Run(fmt.Sprintf("migrate_%s_%s", category.name, relativeOutputPath), func(t *testing.T) {
				// Load the dashboard fresh for migration test
				inputDash := loadDashboard(t, jsonFile)

				// Skip if invalid (will be caught by validate test above)
				if _, ok := inputDash["schemaVersion"]; !ok {
					t.Skip("Dashboard has no schemaVersion")
				}
				inputVersion := getSchemaVersion(t, inputDash)
				if inputVersion < schemaversion.MIN_VERSION {
					t.Skip("Dashboard schema version below minimum")
				}

				testCommunityDashboardMigration(t, inputDash, relativeOutputPath, category.outputDir, category.name, schemaversion.LATEST_VERSION)
			})
		}
	}
}

// TestMigrateOldestHistoricalDashboards tests migration of the 100 oldest community dashboards (current revisions)
func TestMigrateOldestHistoricalDashboards(t *testing.T) {
	// Use the same datasource provider as other tests for consistency
	migration.Initialize(testutil.GetTestDataSourceProvider(), testutil.GetTestPanelProvider())

	// Find all oldest-historical dashboard files (oldest-historical-*.json) in the input directory
	oldestFiles, err := filepath.Glob(filepath.Join(OLDEST_HISTORICAL_INPUT_DIR, "oldest-historical-*.json"))
	require.NoError(t, err, "failed to find oldest-historical dashboard files in %s", OLDEST_HISTORICAL_INPUT_DIR)
	require.NotEmpty(t, oldestFiles, "no oldest-historical dashboard files found in %s", OLDEST_HISTORICAL_INPUT_DIR)

	// Ensure output directory exists
	err = os.MkdirAll(OLDEST_HISTORICAL_OUTPUT_DIR, 0755)
	require.NoError(t, err, "failed to create oldest-historical dashboards output directory %s", OLDEST_HISTORICAL_OUTPUT_DIR)

	t.Logf("Found %d oldest-historical dashboard files", len(oldestFiles))

	for _, jsonFile := range oldestFiles {
		fileName := filepath.Base(jsonFile)

		// Skip non-oldest-historical files
		if !strings.HasPrefix(fileName, "oldest-historical-") {
			continue
		}

		// Use filename as relative output path
		relativeOutputPath := fileName

		// Create individual test cases for each dashboard (including invalid ones)
		t.Run("validate_"+relativeOutputPath, func(t *testing.T) {
			// Load the dashboard
			inputDash := loadDashboard(t, jsonFile)

			// Check for missing schemaVersion
			if _, ok := inputDash["schemaVersion"]; !ok {
				t.Fatalf("Dashboard %s has no schemaVersion - this is not a valid dashboard for migration testing", relativeOutputPath)
			}

			inputVersion := getSchemaVersion(t, inputDash)

			// Check for schema version below minimum
			if inputVersion < schemaversion.MIN_VERSION {
				t.Fatalf("Dashboard %s has schema version %d which is below minimum supported version %d", relativeOutputPath, inputVersion, schemaversion.MIN_VERSION)
			}

			// If we get here, the dashboard is valid - run the migrations
			// Create a copy for the input check
			inputDashCopy := make(map[string]interface{})
			for k, v := range inputDash {
				inputDashCopy[k] = v
			}

			// Input check: migrate to same version should not change anything
			err := migration.Migrate(inputDashCopy, inputVersion)
			if err != nil {
				t.Fatalf("Input check migration failed for %s (v%d): %v", relativeOutputPath, inputVersion, err)
			}
			outBytes, err := json.MarshalIndent(inputDashCopy, "", "  ")
			require.NoError(t, err, "failed to marshal migrated dashboard")
			// We can ignore gosec G304 here since it's a test
			// nolint:gosec
			expectedDash, err := os.ReadFile(jsonFile)
			require.NoError(t, err, "failed to read expected output file")
			require.JSONEq(t, string(expectedDash), string(outBytes), "%s input check did not match", relativeOutputPath)
		})

		t.Run("migrate_"+relativeOutputPath, func(t *testing.T) {
			// Load the dashboard fresh for migration test
			inputDash := loadDashboard(t, jsonFile)

			// Skip if invalid (will be caught by validate test above)
			if _, ok := inputDash["schemaVersion"]; !ok {
				t.Skip("Dashboard has no schemaVersion")
			}
			inputVersion := getSchemaVersion(t, inputDash)
			if inputVersion < schemaversion.MIN_VERSION {
				t.Skip("Dashboard schema version below minimum")
			}

			testOldestHistoricalDashboardMigration(t, inputDash, relativeOutputPath, OLDEST_HISTORICAL_OUTPUT_DIR, schemaversion.LATEST_VERSION)
		})
	}
}

func testDevDashboardMigration(t *testing.T, dash map[string]interface{}, outputFileName string, targetVersion int) {
	t.Helper()

	err := migration.Migrate(dash, targetVersion)
	if err != nil {
		t.Fatalf("Migration to version %d failed for %s: %v", targetVersion, outputFileName, err)
	}

	outPath := filepath.Join(DEV_DASHBOARDS_OUTPUT_DIR, outputFileName)
	outBytes, err := json.MarshalIndent(dash, "", "  ")
	require.NoError(t, err, "failed to marshal migrated dashboard")

	if _, err := os.Stat(outPath); os.IsNotExist(err) {
		// Create directory structure if needed
		outDir := filepath.Dir(outPath)
		err = os.MkdirAll(outDir, 0755)
		require.NoError(t, err, "failed to create output directory", outDir)

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

func testHistoricalDashboardMigration(t *testing.T, dash map[string]interface{}, outputFileName string, targetVersion int) {
	t.Helper()

	err := migration.Migrate(dash, targetVersion)
	if err != nil {
		t.Fatalf("Migration to version %d failed for %s: %v", targetVersion, outputFileName, err)
	}

	outPath := filepath.Join(HISTORICAL_DASHBOARDS_OUTPUT_DIR, outputFileName)
	outBytes, err := json.MarshalIndent(dash, "", "  ")
	require.NoError(t, err, "failed to marshal migrated dashboard")

	if _, err := os.Stat(outPath); os.IsNotExist(err) {
		// Create directory structure if needed (though historical files are flat)
		outDir := filepath.Dir(outPath)
		err = os.MkdirAll(outDir, 0755)
		require.NoError(t, err, "failed to create output directory", outDir)

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

func testCommunityDashboardMigration(t *testing.T, dash map[string]interface{}, outputFileName string, outputDir string, category string, targetVersion int) {
	t.Helper()

	inputVersion := getSchemaVersion(t, dash)

	err := migration.Migrate(dash, targetVersion)
	if err != nil {
		t.Fatalf("Migration to version %d failed for %s (%s revision): %v", targetVersion, outputFileName, category, err)
	}

	outPath := filepath.Join(outputDir, outputFileName)
	outBytes, err := json.MarshalIndent(dash, "", "  ")
	require.NoError(t, err, "failed to marshal migrated dashboard")

	if _, err := os.Stat(outPath); os.IsNotExist(err) {
		// Create directory structure if needed
		outDirPath := filepath.Dir(outPath)
		err = os.MkdirAll(outDirPath, 0755)
		require.NoError(t, err, "failed to create output directory", outDirPath)

		err = os.WriteFile(outPath, outBytes, 0644)
		require.NoError(t, err, "failed to write new output file", outPath)

		t.Logf("✅ GENERATED: %s (%s revision: v%d → v%d)", outputFileName, category, inputVersion, targetVersion)
		return
	}

	// We can ignore gosec G304 here since it's a test
	// nolint:gosec
	existingBytes, err := os.ReadFile(outPath)
	require.NoError(t, err, "failed to read existing output file")
	require.JSONEq(t, string(existingBytes), string(outBytes), "%s (%s revision) did not match", outPath, category)
}

func testOldestHistoricalDashboardMigration(t *testing.T, dash map[string]interface{}, outputFileName string, outputDir string, targetVersion int) {
	t.Helper()

	inputVersion := getSchemaVersion(t, dash)

	err := migration.Migrate(dash, targetVersion)
	if err != nil {
		t.Fatalf("Migration to version %d failed for %s: %v", targetVersion, outputFileName, err)
	}

	outPath := filepath.Join(outputDir, outputFileName)
	outBytes, err := json.MarshalIndent(dash, "", "  ")
	require.NoError(t, err, "failed to marshal migrated dashboard")

	if _, err := os.Stat(outPath); os.IsNotExist(err) {
		// Create directory structure if needed
		outDirPath := filepath.Dir(outPath)
		err = os.MkdirAll(outDirPath, 0755)
		require.NoError(t, err, "failed to create output directory", outDirPath)

		err = os.WriteFile(outPath, outBytes, 0644)
		require.NoError(t, err, "failed to write new output file", outPath)

		t.Logf("✅ GENERATED: %s (oldest-historical: v%d → v%d)", outputFileName, inputVersion, targetVersion)
		return
	}

	// We can ignore gosec G304 here since it's a test
	// nolint:gosec
	existingBytes, err := os.ReadFile(outPath)
	require.NoError(t, err, "failed to read existing output file")
	require.JSONEq(t, string(existingBytes), string(outBytes), "%s (oldest-historical) did not match", outPath)
}
