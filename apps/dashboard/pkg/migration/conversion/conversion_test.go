package conversion

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/apps/dashboard/pkg/apis"
	dashv0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	dashv1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1beta1"
	dashv2alpha1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2alpha1"
	dashv2beta1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2beta1"
	"github.com/grafana/grafana/apps/dashboard/pkg/migration"
	"github.com/grafana/grafana/apps/dashboard/pkg/migration/testutil"
	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

func TestConversionMatrixExist(t *testing.T) {
	// Initialize the converter with a test data source provider
	Initialize(testutil.GetTestDataSourceProvider())

	// Initialize the migrator with a test data source provider
	migration.Initialize(testutil.GetTestDataSourceProvider(), testutil.GetTestPanelProvider())

	versions := []metav1.Object{
		&dashv0.Dashboard{Spec: common.Unstructured{Object: map[string]any{"title": "dashboardV0"}}},
		&dashv1.Dashboard{Spec: common.Unstructured{Object: map[string]any{"title": "dashboardV1"}}},
		&dashv2alpha1.Dashboard{Spec: dashv2alpha1.DashboardSpec{Title: "dashboardV2alpha1"}},
		&dashv2beta1.Dashboard{Spec: dashv2beta1.DashboardSpec{Title: "dashboardV2beta1"}},
	}

	scheme := runtime.NewScheme()
	err := RegisterConversions(scheme)
	require.NoError(t, err)

	for idx, in := range versions {
		kind := fmt.Sprintf("%T", in)[1:]
		t.Run(kind, func(t *testing.T) {
			for i, out := range versions {
				if i == idx {
					continue // skip the same version
				}
				err = scheme.Convert(in, out, nil)
				require.NoError(t, err)
			}

			// Make sure we get the right title for each value
			meta, err := utils.MetaAccessor(in)
			require.NoError(t, err)
			require.True(t, strings.HasPrefix(meta.FindTitle(""), "dashboard"))
		})
	}
}

func TestDeepCopyValid(t *testing.T) {
	dash1 := &dashv0.Dashboard{}
	meta1, err := utils.MetaAccessor(dash1)
	require.NoError(t, err)
	meta1.SetFolder("f1")
	require.Equal(t, "f1", dash1.Annotations[utils.AnnoKeyFolder])

	dash1Copy := dash1.DeepCopyObject()
	metaCopy, err := utils.MetaAccessor(dash1Copy)
	require.NoError(t, err)
	require.Equal(t, "f1", metaCopy.GetFolder())

	// Changing a property on the copy should not effect the original
	metaCopy.SetFolder("XYZ")
	require.Equal(t, "f1", meta1.GetFolder()) // 💣💣💣
}

func TestDashboardConversionToAllVersions(t *testing.T) {
	// Initialize the converter with a test data source provider
	Initialize(testutil.GetTestDataSourceProvider())

	// Initialize the migrator with a test data source provider
	migration.Initialize(testutil.GetTestDataSourceProvider(), testutil.GetTestPanelProvider())

	// Set up conversion scheme
	scheme := runtime.NewScheme()
	err := RegisterConversions(scheme)
	require.NoError(t, err)

	// Read all files from input directory
	files, err := os.ReadDir(filepath.Join("testdata", "input"))
	require.NoError(t, err, "Failed to read input directory")

	for _, file := range files {
		if file.IsDir() {
			continue
		}

		t.Run(fmt.Sprintf("Convert_%s", file.Name()), func(t *testing.T) {
			// Read input dashboard file
			inputFile := filepath.Join("testdata", "input", file.Name())
			// ignore gosec G304 as this function is only used in the test process
			//nolint:gosec
			inputData, err := os.ReadFile(inputFile)
			require.NoError(t, err, "Failed to read input file")

			// Parse the input dashboard to get its version
			var rawDash map[string]interface{}
			err = json.Unmarshal(inputData, &rawDash)
			require.NoError(t, err, "Failed to unmarshal dashboard JSON")

			// Extract apiVersion
			apiVersion, ok := rawDash["apiVersion"].(string)
			require.True(t, ok, "apiVersion not found or not a string")

			// Parse group and version from apiVersion (format: "group/version")
			gv, err := schema.ParseGroupVersion(apiVersion)
			require.NoError(t, err)
			require.Equal(t, dashv0.GROUP, gv.Group)

			// Validate that the input file starts with the apiVersion declared in the object
			expectedPrefix := fmt.Sprintf("%s.", gv.Version)
			if !strings.HasPrefix(file.Name(), expectedPrefix) {
				t.Fatalf(
					"Input file %s does not match its declared apiVersion %s. "+
						"Expected filename to start with \"%s\". "+
						"Example: if apiVersion is \"dashboard.grafana.app/v1beta1\", "+
						"filename should start with \"v1beta1.<descriptive-name>.json\"",
					file.Name(), apiVersion, expectedPrefix)
			}

			// Create source object based on version
			var sourceDash metav1.Object
			switch gv.Version {
			case "v0alpha1":
				var dash dashv0.Dashboard
				err = json.Unmarshal(inputData, &dash)
				sourceDash = &dash
			case "v1beta1":
				var dash dashv1.Dashboard
				err = json.Unmarshal(inputData, &dash)
				sourceDash = &dash
			case "v2alpha1":
				var dash dashv2alpha1.Dashboard
				err = json.Unmarshal(inputData, &dash)
				sourceDash = &dash
			case "v2beta1":
				var dash dashv2beta1.Dashboard
				err = json.Unmarshal(inputData, &dash)
				sourceDash = &dash
			default:
				t.Fatalf("Unsupported source version: %s", gv.Version)
			}
			require.NoError(t, err, "Failed to unmarshal dashboard into typed object")

			// Ensure output directory exists
			outDir := filepath.Join("testdata", "output")
			// ignore gosec G301 as this function is only used in the test process
			//nolint:gosec
			err = os.MkdirAll(outDir, 0755)
			require.NoError(t, err, "Failed to create output directory")

			// Get target versions from the dashboard manifest
			manifest := apis.LocalManifest()
			targetVersions := make(map[string]runtime.Object)

			// Get original filename without extension
			originalName := strings.TrimSuffix(file.Name(), ".json")

			// Get all Dashboard versions from the manifest
			for _, kind := range manifest.ManifestData.Kinds() {
				if kind.Kind == "Dashboard" {
					for _, version := range kind.Versions {
						// Skip converting to the same version
						if version.VersionName == gv.Version {
							continue
						}

						filename := fmt.Sprintf("%s.%s.json", originalName, version.VersionName)
						typeMeta := metav1.TypeMeta{
							APIVersion: fmt.Sprintf("%s/%s", dashv0.APIGroup, version.VersionName),
							Kind:       kind.Kind, // Dashboard
						}

						// Create target object based on version
						switch version.VersionName {
						case "v0alpha1":
							targetVersions[filename] = &dashv0.Dashboard{TypeMeta: typeMeta}
						case "v1beta1":
							targetVersions[filename] = &dashv1.Dashboard{TypeMeta: typeMeta}
						case "v2alpha1":
							targetVersions[filename] = &dashv2alpha1.Dashboard{TypeMeta: typeMeta}
						case "v2beta1":
							targetVersions[filename] = &dashv2beta1.Dashboard{TypeMeta: typeMeta}
						default:
							t.Logf("Unknown version %s, skipping", version.VersionName)
						}
					}
					break
				}
			}

			// Convert to each target version
			for filename, target := range targetVersions {
				t.Run(fmt.Sprintf("Convert_to_%s", filename), func(t *testing.T) {
					// Create a copy of the input dashboard for conversion
					inputCopy := sourceDash.(runtime.Object).DeepCopyObject()

					// Convert to target version
					err = scheme.Convert(inputCopy, target, nil)
					require.NoError(t, err, "Conversion failed for %s", filename)

					// Test the changes in the conversion result
					testConversion(t, target.(metav1.Object), filename, outDir)
				})
			}
		})
	}
}

func testConversion(t *testing.T, convertedDash metav1.Object, filename, outputDir string) {
	t.Helper()

	outPath := filepath.Join(outputDir, filename)
	outBytes, err := json.MarshalIndent(convertedDash, "", "  ")
	require.NoError(t, err, "failed to marshal converted dashboard")

	if _, err := os.Stat(outPath); os.IsNotExist(err) {
		err = os.WriteFile(outPath, outBytes, 0644)
		require.NoError(t, err, "failed to write new output file %s", outPath)
		t.Logf("✓ Created new output file: %s", filename)
		return
	}

	// ignore gosec G304 as this function is only used in the test process
	//nolint:gosec
	existingBytes, err := os.ReadFile(outPath)
	require.NoError(t, err, "failed to read existing output file")
	require.JSONEq(t, string(existingBytes), string(outBytes), "%s did not match", outPath)
	t.Logf("✓ Conversion to %s matches existing file", filename)
}
