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
		dir := filepath.Join("..", "..", "..", "..", "data", "openapi")
		// Create the directory if it doesn't exist
		err := os.MkdirAll(dir, 0o755)
		require.NoError(t, err)
		for _, gv := range check {
			path := fmt.Sprintf("/openapi/v3/apis/%s/%s", gv.Group, gv.Version)
			rsp := apis.DoRequest(h, apis.RequestParams{
				Method: http.MethodGet,
				Path:   path,
				User:   h.Org1.Admin,
			}, &apis.AnyResource{})

			require.NotNil(t, rsp.Response)
			require.Equal(t, 200, rsp.Response.StatusCode, path)

			// Pretty-print the response for debugging
			var prettyJSON bytes.Buffer
			err := json.Indent(&prettyJSON, rsp.Body, "", "  ")
			require.NoError(t, err)

			var openAPISpec map[string]interface{}
			err = json.Unmarshal(prettyJSON.Bytes(), &openAPISpec)
			require.NoError(t, err)

			// 1) Transform the spec
			transformed := ProcessOpenAPISpec(openAPISpec)

			// 2) Marshal with indentation
			finalBytes, err := json.MarshalIndent(transformed, "", "  ")
			require.NoError(t, err)
			finalOutput := string(finalBytes)

			// Compare or write out
			fpath := filepath.Join(dir, gv.Group, gv.Version+".json")
			err = os.MkdirAll(filepath.Dir(fpath), 0o755)
			require.NoError(t, err)
			existing, err := os.ReadFile(fpath)
			writeNeeded := false
			if err == nil {
				if diff := cmp.Diff(finalOutput, string(existing)); diff != "" {
					t.Logf("openapi spec has changed: %s", path)
					t.Logf("body mismatch (-want +got):\n%s\n", diff)
					t.Fail()
					writeNeeded = true
				}
			} else {
				t.Errorf("missing openapi spec for: %s", path)
				writeNeeded = true
			}
			if writeNeeded {
				e2 := os.WriteFile(fpath, []byte(finalOutput), 0o644)
				if e2 != nil {
					t.Errorf("error writing file: %s", e2.Error())
				}
			}
		}
	})
}

// ProcessOpenAPISpec processes an OpenAPI spec to make it more suitable for FE client generation:
//  1. Remove any path containing "/watch/".
//  2. Remove the prefix: "/apis/<group>/<version>/namespaces/{namespace}".
//  3. Filter out `namespace` from path parameters.
//  4. Update all $ref fields to remove k8s metadata from schema names.
//  5. Simplify schema names in "components.schemas".
func ProcessOpenAPISpec(spec map[string]interface{}) map[string]interface{} {
	// 1) Process 'paths'
	pathsVal, ok := spec["paths"]
	if ok {
		if pathsMap, _ := pathsVal.(map[string]interface{}); pathsMap != nil {
			spec["paths"] = processPaths(pathsMap)
		}
	}

	// 2) Process 'components.schemas'
	compsVal, ok := spec["components"]
	if ok {
		if compsMap, _ := compsVal.(map[string]interface{}); compsMap != nil {
			if schemasVal, ok := compsMap["schemas"]; ok {
				if schemasMap, _ := schemasVal.(map[string]interface{}); schemasMap != nil {
					newSpecComponents := map[string]interface{}{}
					for schemaKey, schemaVal := range schemasMap {
						newKey := simplifySchemaName(schemaKey)
						updateRefs(schemaVal)
						newSpecComponents[newKey] = schemaVal
					}
					compsMap["schemas"] = newSpecComponents
					spec["components"] = compsMap
				}
			}
		}
	}

	return spec
}

func processPaths(paths map[string]interface{}) map[string]interface{} {
	newPaths := make(map[string]interface{})
	// This regex removes "/apis/<group>/<version>/namespaces/{namespace}"
	// Example: "/apis/peakq.grafana.app/v0alpha1/namespaces/{namespace}/querytemplates" -> "/querytemplates"
	pathRegex := regexp.MustCompile(`^/apis/[^/]+/[^/]+/namespaces/\{namespace}`)

	for pathKey, pathValue := range paths {
		// Skip any path that contains "/watch/"
		if strings.Contains(pathKey, "/watch/") {
			continue
		}
		newPathKey := pathRegex.ReplaceAllString(pathKey, "")

		pathItemMap, ok := pathValue.(map[string]interface{})
		if !ok {
			continue
		}

		newPathItem := make(map[string]interface{})
		for methodKey, methodValue := range pathItemMap {
			// Filter out "namespace"
			if methodKey == "parameters" {
				if arr, ok := methodValue.([]interface{}); ok {
					var filtered []interface{}
					for _, paramVal := range arr {
						paramMap, ok := paramVal.(map[string]interface{})
						if !ok {
							continue
						}
						nameVal := paramMap["name"]
						if nameVal == "namespace" {
							continue
						}
						filtered = append(filtered, paramMap)
					}
					methodValue = filtered
				}
				newPathItem[methodKey] = methodValue
			} else {
				// For methods, recursively update refs
				updateRefs(methodValue)
				newPathItem[methodKey] = methodValue
			}
		}
		newPaths[newPathKey] = newPathItem
	}
	return newPaths
}

// updateRefs recursively finds $ref fields and updates them
// so that "io.k8s.apimachinery.pkg.apis.meta.v1.Time" -> "Time".
func updateRefs(obj interface{}) {
	switch val := obj.(type) {
	case []interface{}:
		for _, item := range val {
			updateRefs(item)
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

// simplifySchemaName removes e.g. "io.k8s.apimachinery.pkg.apis.meta.v1."
func simplifySchemaName(schemaName string) string {
	parts := strings.Split(schemaName, ".")
	versionRe := regexp.MustCompile(`^v\d+[a-zA-Z0-9]*$`)
	for i, p := range parts {
		if versionRe.MatchString(p) && i+1 < len(parts) {
			return strings.Join(parts[i+1:], ".")
		}
	}
	return schemaName
}
