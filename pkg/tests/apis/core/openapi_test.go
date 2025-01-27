package core

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"testing"

	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/util/version"
	apimachineryversion "k8s.io/apimachinery/pkg/version"

	"github.com/google/go-cmp/cmp"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/tests/testsuite"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func TestIntegrationOpenAPIs(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	check := []schema.GroupVersion{
		{
			Group:   "dashboard.grafana.app",
			Version: "v0alpha1",
		},
		{
			Group:   "folder.grafana.app",
			Version: "v0alpha1",
		},
		{
			Group:   "peakq.grafana.app",
			Version: "v0alpha1",
		},
	}

	h := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
		AppModeProduction: true,
		EnableFeatureToggles: []string{
			featuremgmt.FlagKubernetesFoldersServiceV2, // Will be default on by G12
			featuremgmt.FlagQueryService,               // Query Library
		},
	})

	t.Run("check valid version response", func(t *testing.T) {
		disco := h.NewDiscoveryClient()
		req := disco.RESTClient().Get().
			Prefix("version").
			SetHeader("Accept", "application/json")

		result := req.Do(context.Background())
		require.NoError(t, result.Error())

		raw, err := result.Raw()
		require.NoError(t, err)
		info := apimachineryversion.Info{}
		err = json.Unmarshal(raw, &info)
		require.NoError(t, err)

		// Make sure the gitVersion is parseable
		v, err := version.Parse(info.GitVersion)
		require.NoError(t, err)
		require.Equal(t, info.Major, fmt.Sprintf("%d", v.Major()))
		require.Equal(t, info.Minor, fmt.Sprintf("%d", v.Minor()))
	})

	t.Run("build open", func(t *testing.T) {
		// Now write each OpenAPI spec to a static file
		dir := filepath.Join("..", "..", "..", "..", "openapi")
		for _, gv := range check {
			path := fmt.Sprintf("/openapi/v3/apis/%s/%s", gv.Group, gv.Version)
			rsp := apis.DoRequest(h, apis.RequestParams{
				Method: http.MethodGet,
				Path:   path,
				User:   h.Org1.Admin,
			}, &apis.AnyResource{})

			require.NotNil(t, rsp.Response)
			require.Equal(t, 200, rsp.Response.StatusCode, path)

			// Pretty-print the raw JSON for debugging
			var prettyJSON bytes.Buffer
			err := json.Indent(&prettyJSON, rsp.Body, "", "  ")
			require.NoError(t, err)
			pretty := prettyJSON.String()

			// 1) Unmarshal
			var openAPISpec map[string]interface{}
			err = json.Unmarshal([]byte(pretty), &openAPISpec)
			require.NoError(t, err)

			// 2) Process transformations (similar to the TS code)
			processed := ProcessOpenAPISpec(openAPISpec)

			// 3) Marshal again
			processedBytes, err := json.MarshalIndent(processed, "", "  ")
			require.NoError(t, err)
			finalOutput := string(processedBytes)

			// Compare with what's on disk, or write a new file
			write := false
			fpath := filepath.Join(dir, fmt.Sprintf("%s-%s.json", gv.Group, gv.Version))

			// nolint:gosec
			body, err := os.ReadFile(fpath)
			if err == nil {
				if diff := cmp.Diff(finalOutput, string(body)); diff != "" {
					t.Logf("openapi spec has changed: %s", path)
					t.Logf("body mismatch (-want +got):\n%s\n", diff)
					t.Fail()
					write = true
				}
			} else {
				t.Errorf("missing openapi spec for: %s", path)
				write = true
			}

			if write {
				e2 := os.WriteFile(fpath, []byte(finalOutput), 0o644)
				if e2 != nil {
					t.Errorf("error writing file: %s", e2.Error())
				}
			}
		}
	})
}

// ProcessOpenAPISpec applies similar transformations as the TypeScript version:
//  1. Remove any path containing "/watch/" (deprecated).
//  2. Remove "/apis/<group>/<version>" and the "/namespaces/{namespace}" part (if present)
//     so that e.g., "/apis/peakq.grafana.app/v0alpha1/namespaces/{namespace}/querytemplates"
//     becomes "/querytemplates".
//  3. Filter out "namespace" from path parameters.
//  4. Update $ref fields to simpler schema names.
//  5. Simplify schema names in "components.schemas".
func ProcessOpenAPISpec(spec map[string]interface{}) map[string]interface{} {
	newSpec := deepCopy(spec)

	// --------------------------------------------------------------------
	// Process 'paths'
	// --------------------------------------------------------------------
	pathsVal, ok := newSpec["paths"]
	if !ok {
		return newSpec
	}
	paths, ok := pathsVal.(map[string]interface{})
	if !ok {
		return newSpec
	}

	newPaths := map[string]interface{}{}

	// This regex removes "/apis/<group>/<version>" plus optionally "/namespaces/{namespace}"
	// from the start of the path, leaving whatever follows.
	// Example: "/apis/peakq.grafana.app/v0alpha1/namespaces/{namespace}/querytemplates" -> "/querytemplates"
	//          "/apis/peakq.grafana.app/v0alpha1/querytemplates" -> "/querytemplates"
	pathRegex := regexp.MustCompile(`^/apis/[^/]+/[^/]+(?:/namespaces/\{namespace\})?`)

	for pathKey, pathItemVal := range paths {
		// Skip any path that contains "/watch/"
		if strings.Contains(pathKey, "/watch/") {
			continue
		}

		newPathKey := pathRegex.ReplaceAllString(pathKey, "")
		pathItemMap, ok := pathItemVal.(map[string]interface{})
		if !ok {
			continue
		}

		newPathItem := map[string]interface{}{}
		for methodKey, operationVal := range pathItemMap {
			// Filter out "namespace" param if found in parameters array
			if methodKey == "parameters" {
				if arr, ok := operationVal.([]interface{}); ok {
					var filtered []interface{}
					for _, param := range arr {
						paramMap, ok := param.(map[string]interface{})
						if !ok {
							continue
						}
						if paramMap["name"] == "namespace" {
							// skip
							continue
						}
						filtered = append(filtered, paramMap)
					}
					operationVal = filtered
				}
				newPathItem[methodKey] = operationVal
			} else {
				// For method definitions, update $ref references
				updateRefs(operationVal)
				newPathItem[methodKey] = operationVal
			}
		}
		newPaths[newPathKey] = newPathItem
	}
	newSpec["paths"] = newPaths

	// --------------------------------------------------------------------
	// Process components -> schemas
	// --------------------------------------------------------------------
	compVal, ok := newSpec["components"]
	if !ok {
		return newSpec
	}
	compMap, ok := compVal.(map[string]interface{})
	if !ok {
		return newSpec
	}
	schemasVal, ok := compMap["schemas"]
	if !ok {
		return newSpec
	}
	schemasMap, ok := schemasVal.(map[string]interface{})
	if !ok {
		return newSpec
	}

	newSchemas := map[string]interface{}{}
	for schemaKey, schemaVal := range schemasMap {
		newKey := simplifySchemaName(schemaKey)
		updateRefs(schemaVal)
		newSchemas[newKey] = schemaVal
	}
	compMap["schemas"] = newSchemas
	newSpec["components"] = compMap

	return newSpec
}

// updateRefs recursively finds $ref fields and rewrites them
// so that "io.k8s.apimachinery.pkg.apis.meta.v1.Time"
// becomes "Time".
func updateRefs(obj interface{}) {
	switch val := obj.(type) {
	case []interface{}:
		for _, elem := range val {
			updateRefs(elem)
		}
	case map[string]interface{}:
		if refRaw, ok := val["$ref"]; ok {
			if refStr, ok := refRaw.(string); ok {
				parts := strings.Split(refStr, "/")
				lastPart := parts[len(parts)-1]
				newName := simplifySchemaName(lastPart)
				val["$ref"] = "#/components/schemas/" + newName
			}
		}
		for k, v := range val {
			if k != "$ref" {
				updateRefs(v)
			}
		}
	}
}

// simplifySchemaName removes the version prefix from schema names,
// e.g. "io.k8s.apimachinery.pkg.apis.meta.v1.Time" -> "Time".
func simplifySchemaName(schemaName string) string {
	parts := strings.Split(schemaName, ".")
	versionRegex := regexp.MustCompile(`^v\d+[a-zA-Z0-9]*$`)
	for i, p := range parts {
		if versionRegex.MatchString(p) && i+1 < len(parts) {
			return strings.Join(parts[i+1:], ".")
		}
	}
	return schemaName
}

// deepCopy does a JSON-based deep copy of a map[string]interface{}.
func deepCopy(src map[string]interface{}) map[string]interface{} {
	raw, err := json.Marshal(src)
	if err != nil {
		return src
	}
	var dst map[string]interface{}
	_ = json.Unmarshal(raw, &dst)
	return dst
}
