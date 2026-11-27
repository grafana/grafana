// SPDX-License-Identifier: AGPL-3.0-only

package v1beta2

import (
	"encoding/json"
	"maps"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

// getSubresource returns the status code and JSON body of a GET below the default namespace.
func getSubresource(t *testing.T, helper *common.ProvisioningTestHelper, version, subpath string) (int, map[string]interface{}) {
	t.Helper()
	var code int
	raw, _ := helper.AdminREST.Get().
		AbsPath("/apis/" + group + "/" + version + "/namespaces/default/" + subpath).
		Do(t.Context()).
		StatusCode(&code).
		Raw()
	var body map[string]interface{}
	require.NoError(t, json.Unmarshal(raw, &body), "%s %s: %s", version, subpath, raw)
	return code, body
}

// requireSameResponse asserts both versions answer subpath alike, apart from the version in
// apiVersion, and returns the v1beta2 body.
func requireSameResponse(t *testing.T, helper *common.ProvisioningTestHelper, subpath string, expectedCode int) map[string]interface{} {
	t.Helper()
	v0Code, v0 := getSubresource(t, helper, "v0alpha1", subpath)
	v1Code, v1 := getSubresource(t, helper, "v1beta2", subpath)
	require.Equal(t, expectedCode, v0Code, "v0alpha1 %s: %v", subpath, v0)
	require.Equal(t, expectedCode, v1Code, "v1beta2 %s: %v", subpath, v1)

	expected := make(map[string]interface{}, len(v0))
	maps.Copy(expected, v0)
	if v0["apiVersion"] == v0alpha1APIVersion {
		expected["apiVersion"] = v1beta2APIVersion
	}
	assert.Equal(t, expected, v1, subpath)
	return v1
}

func itemFields(t *testing.T, list map[string]interface{}, field string) []interface{} {
	t.Helper()
	items := listItems(t, list)
	values := make([]interface{}, 0, len(items))
	for _, item := range items {
		values = append(values, item[field])
	}
	return values
}

func TestIntegrationV1beta2Subresources(t *testing.T) {
	helper := sharedHelper(t)

	repo := "v1beta2-subresources"
	helper.CopyToProvisioningPath(t, "../testdata/all-panels.json", "v1beta2-dashboard.json")
	_, err := helper.RESTDo("POST", "v0alpha1", "repositories", repositoryBody(repo, v0alpha1APIVersion, helper.ProvisioningPath))
	require.NoError(t, err)
	helper.WaitForHealthyRepository(t, repo)
	helper.SyncAndWait(t, repo, nil)

	t.Run("resources", func(t *testing.T) {
		body := requireSameResponse(t, helper, "repositories/"+repo+"/resources", http.StatusOK)
		assert.Equal(t, "ResourceList", body["kind"])
		assert.NotEmpty(t, listItems(t, body), "the synced dashboard should be listed")
	})

	t.Run("stats", func(t *testing.T) {
		body := requireSameResponse(t, helper, "repositories/"+repo+"/stats", http.StatusOK)
		assert.Equal(t, "ResourceCountList", body["kind"])
		assert.NotEmpty(t, listItems(t, body))
	})

	t.Run("files listing", func(t *testing.T) {
		body := requireSameResponse(t, helper, "repositories/"+repo+"/files/", http.StatusOK)
		assert.Equal(t, "FileList", body["kind"])
		assert.Contains(t, itemFields(t, body, "path"), "v1beta2-dashboard.json")
	})

	t.Run("file", func(t *testing.T) {
		body := requireSameResponse(t, helper, "repositories/"+repo+"/files/v1beta2-dashboard.json", http.StatusOK)
		assert.Equal(t, "ResourceWrapper", body["kind"])
		assert.Equal(t, "v1beta2-dashboard.json", body["path"])
		assert.Equal(t, "Dashboard", nested(body, "resource", "file", "kind"))
	})

	t.Run("missing file", func(t *testing.T) {
		requireSameResponse(t, helper, "repositories/"+repo+"/files/missing.json", http.StatusNotFound)
	})

	// Local repositories are not versioned, so refs and history answer with the same error.
	t.Run("refs", func(t *testing.T) {
		requireSameResponse(t, helper, "repositories/"+repo+"/refs", http.StatusBadRequest)
	})

	t.Run("history", func(t *testing.T) {
		requireSameResponse(t, helper, "repositories/"+repo+"/history/v1beta2-dashboard.json", http.StatusBadRequest)
	})

	t.Run("missing repository", func(t *testing.T) {
		requireSameResponse(t, helper, "repositories/does-not-exist/files/", http.StatusNotFound)
	})

	t.Run("connection repositories", func(t *testing.T) {
		name := "v1beta2-subresources-connection"
		_, err := helper.CreateGithubConnection(t, &unstructured.Unstructured{Object: connectionBody(name, v0alpha1APIVersion)})
		require.NoError(t, err)

		body := requireSameResponse(t, helper, "connections/"+name+"/repositories", http.StatusOK)
		assert.Equal(t, "ExternalRepositoryList", body["kind"])
		assert.NotEmpty(t, listItems(t, body))
	})
}

func TestIntegrationV1beta2NamespaceRoutes(t *testing.T) {
	helper := sharedHelper(t)

	repo := "v1beta2-routes"
	_, err := helper.RESTDo("POST", "v1beta2", "repositories", repositoryBody(repo, v1beta2APIVersion, helper.ProvisioningPath))
	require.NoError(t, err)
	helper.WaitForHealthyRepository(t, repo)

	t.Run("settings", func(t *testing.T) {
		body := requireSameResponse(t, helper, "settings", http.StatusOK)
		assert.NotContains(t, body, "apiVersion", "the settings body has no apiVersion on any version")
		assert.Contains(t, itemFields(t, body, "name"), repo)
		assert.NotEmpty(t, body["availableRepositoryTypes"])
	})

	t.Run("stats", func(t *testing.T) {
		body := requireSameResponse(t, helper, "stats", http.StatusOK)
		assert.Equal(t, v1beta2APIVersion, body["apiVersion"])
		assert.Equal(t, "ResourceStats", body["kind"])
		assert.NotEmpty(t, body["instance"])
	})
}
