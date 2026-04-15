package apiversion

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

const (
	v0alpha1APIVersion = "provisioning.grafana.app/v0alpha1"
	v1beta1APIVersion  = "provisioning.grafana.app/v1beta1"
)

// repositoryBody returns a JSON-marshalable map for creating a local Repository.
func repositoryBody(name, apiVersion, provisioningPath string) map[string]interface{} {
	return map[string]interface{}{
		"apiVersion": apiVersion,
		"kind":       "Repository",
		"metadata": map[string]interface{}{
			"name":      name,
			"namespace": "default",
		},
		"spec": map[string]interface{}{
			"title": "API Version Test - " + name,
			"type":  "local",
			"local": map[string]interface{}{
				"path": provisioningPath,
			},
			"workflows": []string{"write"},
			"sync": map[string]interface{}{
				"enabled":         false,
				"target":          "folder",
				"intervalSeconds": 60,
			},
		},
	}
}

func createRepoViaREST(t *testing.T, helper *common.ProvisioningTestHelper, name, version string) {
	t.Helper()
	body := repositoryBody(name, "provisioning.grafana.app/"+version, helper.ProvisioningPath)
	bodyBytes, err := json.Marshal(body)
	require.NoError(t, err)

	result := helper.AdminREST.Post().
		AbsPath("/apis/provisioning.grafana.app/"+version+"/namespaces/default/repositories").
		Body(bodyBytes).
		SetHeader("Content-Type", "application/json").
		Do(context.Background())
	require.NoError(t, result.Error(), "creating repository %q via %s", name, version)
}

func getRepoViaREST(t *testing.T, helper *common.ProvisioningTestHelper, name, version string) map[string]interface{} {
	t.Helper()
	result := helper.AdminREST.Get().
		AbsPath("/apis/provisioning.grafana.app/" + version + "/namespaces/default/repositories/" + name).
		Do(context.Background())
	require.NoError(t, result.Error(), "getting repository %q via %s", name, version)

	raw, err := result.Raw()
	require.NoError(t, err)

	var obj map[string]interface{}
	require.NoError(t, json.Unmarshal(raw, &obj))
	return obj
}

func listReposViaREST(t *testing.T, helper *common.ProvisioningTestHelper, version string) map[string]interface{} {
	t.Helper()
	result := helper.AdminREST.Get().
		AbsPath("/apis/provisioning.grafana.app/" + version + "/namespaces/default/repositories").
		Do(context.Background())
	require.NoError(t, result.Error(), "listing repositories via %s", version)

	raw, err := result.Raw()
	require.NoError(t, err)

	var obj map[string]interface{}
	require.NoError(t, json.Unmarshal(raw, &obj))
	return obj
}

// TestIntegrationRepositoryVersionConsistency verifies that the provisioning API
// server returns the correct apiVersion in responses depending on which version
// endpoint the request was made against. This is the primary diagnostic test for
// the shared-Go-type multi-version serialization issue.
func TestIntegrationRepositoryVersionConsistency(t *testing.T) {
	helper := sharedHelper(t)

	t.Run("GET via v1beta1 returns v1beta1 apiVersion", func(t *testing.T) {
		const repoName = "version-get-v1beta1"
		createRepoViaREST(t, helper, repoName, "v1beta1")

		raw := getRepoViaREST(t, helper, repoName, "v1beta1")

		apiVersion, _ := raw["apiVersion"].(string)
		assert.Equal(t, v1beta1APIVersion, apiVersion,
			"GET via v1beta1 endpoint must return v1beta1 apiVersion, got %q", apiVersion)

		kind, _ := raw["kind"].(string)
		assert.Equal(t, "Repository", kind)
	})

	t.Run("GET via v0alpha1 returns v0alpha1 apiVersion", func(t *testing.T) {
		const repoName = "version-get-v0alpha1"
		createRepoViaREST(t, helper, repoName, "v0alpha1")

		raw := getRepoViaREST(t, helper, repoName, "v0alpha1")

		apiVersion, _ := raw["apiVersion"].(string)
		assert.Equal(t, v0alpha1APIVersion, apiVersion,
			"GET via v0alpha1 endpoint must return v0alpha1 apiVersion, got %q", apiVersion)
	})

	// The cross-version test: create via v0alpha1, read via v1beta1.
	// The response version MUST match the endpoint version, not the creation version.
	t.Run("create via v0alpha1, GET via v1beta1 returns v1beta1", func(t *testing.T) {
		const repoName = "version-cross-get"
		createRepoViaREST(t, helper, repoName, "v0alpha1")

		raw := getRepoViaREST(t, helper, repoName, "v1beta1")

		apiVersion, _ := raw["apiVersion"].(string)
		assert.Equal(t, v1beta1APIVersion, apiVersion,
			"GET via v1beta1 must return v1beta1 even when created via v0alpha1, got %q", apiVersion)
	})

	t.Run("create via v1beta1, GET via v0alpha1 returns v0alpha1", func(t *testing.T) {
		const repoName = "version-cross-get-rev"
		createRepoViaREST(t, helper, repoName, "v1beta1")

		raw := getRepoViaREST(t, helper, repoName, "v0alpha1")

		apiVersion, _ := raw["apiVersion"].(string)
		assert.Equal(t, v0alpha1APIVersion, apiVersion,
			"GET via v0alpha1 must return v0alpha1 even when created via v1beta1, got %q", apiVersion)
	})

	t.Run("LIST via v1beta1 returns v1beta1 for list and all items", func(t *testing.T) {
		const repoName = "version-list-v1beta1"
		createRepoViaREST(t, helper, repoName, "v0alpha1")

		raw := listReposViaREST(t, helper, "v1beta1")

		listAPIVersion, _ := raw["apiVersion"].(string)
		assert.Equal(t, v1beta1APIVersion, listAPIVersion,
			"LIST response apiVersion must be v1beta1, got %q", listAPIVersion)

		items, _ := raw["items"].([]interface{})
		require.GreaterOrEqual(t, len(items), 1, "list should contain at least one item")

		for i, item := range items {
			obj, ok := item.(map[string]interface{})
			require.True(t, ok, "item %d should be a map", i)
			itemAPIVersion, _ := obj["apiVersion"].(string)
			itemName := "(unknown)"
			if md, ok := obj["metadata"].(map[string]interface{}); ok {
				if n, ok := md["name"].(string); ok {
					itemName = n
				}
			}
			assert.Equal(t, v1beta1APIVersion, itemAPIVersion,
				"LIST item %d (%s) must have v1beta1 apiVersion, got %q", i, itemName, itemAPIVersion)
		}
	})

	t.Run("LIST via v0alpha1 returns v0alpha1 for list and all items", func(t *testing.T) {
		const repoName = "version-list-v0alpha1"
		createRepoViaREST(t, helper, repoName, "v1beta1")

		raw := listReposViaREST(t, helper, "v0alpha1")

		listAPIVersion, _ := raw["apiVersion"].(string)
		assert.Equal(t, v0alpha1APIVersion, listAPIVersion,
			"LIST response apiVersion must be v0alpha1, got %q", listAPIVersion)

		items, _ := raw["items"].([]interface{})
		require.GreaterOrEqual(t, len(items), 1, "list should contain at least one item")

		for i, item := range items {
			obj, ok := item.(map[string]interface{})
			require.True(t, ok, "item %d should be a map", i)
			itemAPIVersion, _ := obj["apiVersion"].(string)
			itemName := "(unknown)"
			if md, ok := obj["metadata"].(map[string]interface{}); ok {
				if n, ok := md["name"].(string); ok {
					itemName = n
				}
			}
			assert.Equal(t, v0alpha1APIVersion, itemAPIVersion,
				"LIST item %d (%s) must have v0alpha1 apiVersion, got %q", i, itemName, itemAPIVersion)
		}
	})

	// Test CREATE response: the version in the response to a POST must match
	// the endpoint version, not whatever gvks[0] happens to be.
	t.Run("CREATE response via v1beta1 has v1beta1 apiVersion", func(t *testing.T) {
		const repoName = "version-create-resp-v1beta1"
		body := repositoryBody(repoName, v1beta1APIVersion, helper.ProvisioningPath)
		bodyBytes, err := json.Marshal(body)
		require.NoError(t, err)

		result := helper.AdminREST.Post().
			AbsPath("/apis/provisioning.grafana.app/v1beta1/namespaces/default/repositories").
			Body(bodyBytes).
			SetHeader("Content-Type", "application/json").
			Do(context.Background())
		require.NoError(t, result.Error())

		raw, err := result.Raw()
		require.NoError(t, err)

		var obj map[string]interface{}
		require.NoError(t, json.Unmarshal(raw, &obj))

		apiVersion, _ := obj["apiVersion"].(string)
		assert.Equal(t, v1beta1APIVersion, apiVersion,
			"CREATE response via v1beta1 must have v1beta1 apiVersion, got %q", apiVersion)
	})

	t.Run("CREATE response via v0alpha1 has v0alpha1 apiVersion", func(t *testing.T) {
		const repoName = "version-create-resp-v0alpha1"
		body := repositoryBody(repoName, v0alpha1APIVersion, helper.ProvisioningPath)
		bodyBytes, err := json.Marshal(body)
		require.NoError(t, err)

		result := helper.AdminREST.Post().
			AbsPath("/apis/provisioning.grafana.app/v0alpha1/namespaces/default/repositories").
			Body(bodyBytes).
			SetHeader("Content-Type", "application/json").
			Do(context.Background())
		require.NoError(t, result.Error())

		raw, err := result.Raw()
		require.NoError(t, err)

		var obj map[string]interface{}
		require.NoError(t, json.Unmarshal(raw, &obj))

		apiVersion, _ := obj["apiVersion"].(string)
		assert.Equal(t, v0alpha1APIVersion, apiVersion,
			"CREATE response via v0alpha1 must have v0alpha1 apiVersion, got %q", apiVersion)
	})

	// Test UPDATE response: PUT to v1beta1 endpoint must reflect v1beta1.
	t.Run("UPDATE response via v1beta1 has v1beta1 apiVersion", func(t *testing.T) {
		const repoName = "version-update-resp"
		createRepoViaREST(t, helper, repoName, "v1beta1")

		result := helper.AdminREST.Get().
			AbsPath("/apis/provisioning.grafana.app/v1beta1/namespaces/default/repositories/" + repoName).
			Do(context.Background())
		require.NoError(t, result.Error())

		var current unstructured.Unstructured
		require.NoError(t, result.Into(&current))

		// Modify the title
		require.NoError(t, unstructured.SetNestedField(current.Object, "Updated Title", "spec", "title"))

		updatedBytes, err := json.Marshal(current.Object)
		require.NoError(t, err)

		updateResult := helper.AdminREST.Put().
			AbsPath("/apis/provisioning.grafana.app/v1beta1/namespaces/default/repositories/"+repoName).
			Body(updatedBytes).
			SetHeader("Content-Type", "application/json").
			Do(context.Background())
		require.NoError(t, updateResult.Error())

		raw, err := updateResult.Raw()
		require.NoError(t, err)

		var obj map[string]interface{}
		require.NoError(t, json.Unmarshal(raw, &obj))

		apiVersion, _ := obj["apiVersion"].(string)
		assert.Equal(t, v1beta1APIVersion, apiVersion,
			"UPDATE response via v1beta1 must have v1beta1 apiVersion, got %q", apiVersion)
	})

	// Test DELETE response via v1beta1.
	t.Run("DELETE response via v1beta1 has v1beta1 apiVersion", func(t *testing.T) {
		const repoName = "version-delete-resp"
		createRepoViaREST(t, helper, repoName, "v1beta1")

		result := helper.AdminREST.Delete().
			AbsPath("/apis/provisioning.grafana.app/v1beta1/namespaces/default/repositories/" + repoName).
			Do(context.Background())
		require.NoError(t, result.Error())

		raw, err := result.Raw()
		require.NoError(t, err)

		var obj map[string]interface{}
		require.NoError(t, json.Unmarshal(raw, &obj))

		apiVersion, _ := obj["apiVersion"].(string)
		kind, _ := obj["kind"].(string)
		// DELETE may return a Status object or the deleted Repository.
		// If it's the Repository, the apiVersion must be v1beta1.
		if kind == "Repository" {
			assert.Equal(t, v1beta1APIVersion, apiVersion,
				"DELETE response (Repository) via v1beta1 must have v1beta1 apiVersion, got %q", apiVersion)
		}
	})
}

// TestIntegrationRepositoryVersionInDynamicClient verifies version consistency
// when using the typed dynamic client (schema.GroupVersionResource with v1beta1).
// This catches issues in the K8s client-go / discovery layer.
func TestIntegrationRepositoryVersionInDynamicClient(t *testing.T) {
	helper := sharedHelper(t)
	ctx := context.Background()

	repoClient := common.GetRepositoryClientV1Beta1(helper.K8sTestHelper)

	t.Run("create and get via dynamic v1beta1 client", func(t *testing.T) {
		repo := &unstructured.Unstructured{
			Object: repositoryBody("dyn-v1beta1-repo", v1beta1APIVersion, helper.ProvisioningPath),
		}

		created, err := repoClient.Resource.Create(ctx, repo, metav1.CreateOptions{})
		require.NoError(t, err)

		assert.Equal(t, v1beta1APIVersion, created.GetAPIVersion(),
			"dynamic client CREATE response must have v1beta1 apiVersion, got %q", created.GetAPIVersion())

		fetched, err := repoClient.Resource.Get(ctx, "dyn-v1beta1-repo", metav1.GetOptions{})
		require.NoError(t, err)

		assert.Equal(t, v1beta1APIVersion, fetched.GetAPIVersion(),
			"dynamic client GET response must have v1beta1 apiVersion, got %q", fetched.GetAPIVersion())
	})

	t.Run("list via dynamic v1beta1 client", func(t *testing.T) {
		list, err := repoClient.Resource.List(ctx, metav1.ListOptions{})
		require.NoError(t, err)

		assert.Equal(t, v1beta1APIVersion, list.GetAPIVersion(),
			"dynamic client LIST apiVersion must be v1beta1, got %q", list.GetAPIVersion())

		for i, item := range list.Items {
			assert.Equal(t, v1beta1APIVersion, item.GetAPIVersion(),
				"dynamic client LIST item %d (%s) must have v1beta1, got %q",
				i, item.GetName(), item.GetAPIVersion())
		}
	})
}

// TestIntegrationConnectionVersionConsistency performs the same version check
// on the Connection resource (same shared-type pattern as Repository).
func TestIntegrationConnectionVersionConsistency(t *testing.T) {
	helper := sharedHelper(t)

	connectionBody := func(name, apiVersion string) map[string]interface{} {
		return map[string]interface{}{
			"apiVersion": apiVersion,
			"kind":       "Connection",
			"metadata": map[string]interface{}{
				"name":      name,
				"namespace": "default",
			},
			"spec": map[string]interface{}{
				"title": "Version Test Connection - " + name,
				"type":  "github",
				"github": map[string]interface{}{
					"appID":          "123456",
					"installationID": "789012",
				},
			},
			"secure": map[string]interface{}{
				"privateKey": map[string]interface{}{
					"create": common.TestGithubPrivateKeyBase64(),
				},
			},
		}
	}

	createConnection := func(t *testing.T, name, version string) {
		t.Helper()
		body := connectionBody(name, "provisioning.grafana.app/"+version)
		bodyBytes, err := json.Marshal(body)
		require.NoError(t, err)

		result := helper.AdminREST.Post().
			AbsPath("/apis/provisioning.grafana.app/"+version+"/namespaces/default/connections").
			Body(bodyBytes).
			SetHeader("Content-Type", "application/json").
			Do(context.Background())
		require.NoError(t, result.Error(), "creating connection %q via %s", name, version)
	}

	getConnection := func(t *testing.T, name, version string) map[string]interface{} {
		t.Helper()
		result := helper.AdminREST.Get().
			AbsPath("/apis/provisioning.grafana.app/" + version + "/namespaces/default/connections/" + name).
			Do(context.Background())
		require.NoError(t, result.Error(), "getting connection %q via %s", name, version)

		raw, err := result.Raw()
		require.NoError(t, err)

		var obj map[string]interface{}
		require.NoError(t, json.Unmarshal(raw, &obj))
		return obj
	}

	t.Run("GET connection via v1beta1 returns v1beta1 apiVersion", func(t *testing.T) {
		const name = "conn-version-v1beta1"
		createConnection(t, name, "v1beta1")

		raw := getConnection(t, name, "v1beta1")
		apiVersion, _ := raw["apiVersion"].(string)
		assert.Equal(t, v1beta1APIVersion, apiVersion,
			"GET connection via v1beta1 must return v1beta1, got %q", apiVersion)
	})

	t.Run("create connection via v0alpha1, GET via v1beta1 returns v1beta1", func(t *testing.T) {
		const name = "conn-version-cross"
		createConnection(t, name, "v0alpha1")

		raw := getConnection(t, name, "v1beta1")
		apiVersion, _ := raw["apiVersion"].(string)
		assert.Equal(t, v1beta1APIVersion, apiVersion,
			"GET connection via v1beta1 must return v1beta1 even when created via v0alpha1, got %q", apiVersion)
	})

	t.Run("LIST connections via v1beta1 returns v1beta1 for all items", func(t *testing.T) {
		const name = "conn-version-list"
		createConnection(t, name, "v0alpha1")

		result := helper.AdminREST.Get().
			AbsPath("/apis/provisioning.grafana.app/v1beta1/namespaces/default/connections").
			Do(context.Background())
		require.NoError(t, result.Error())

		raw, err := result.Raw()
		require.NoError(t, err)

		var obj map[string]interface{}
		require.NoError(t, json.Unmarshal(raw, &obj))

		listAPIVersion, _ := obj["apiVersion"].(string)
		assert.Equal(t, v1beta1APIVersion, listAPIVersion,
			"LIST connections apiVersion must be v1beta1, got %q", listAPIVersion)

		items, _ := obj["items"].([]interface{})
		for i, item := range items {
			itemObj, ok := item.(map[string]interface{})
			require.True(t, ok, "item %d should be a map", i)
			itemAPIVersion, _ := itemObj["apiVersion"].(string)
			assert.Equal(t, v1beta1APIVersion, itemAPIVersion,
				"LIST connections item %d must have v1beta1, got %q", i, itemAPIVersion)
		}
	})
}

// TestIntegrationAPIGroupDiscoveryVersions checks that the provisioning API
// group advertises both v0alpha1 and v1beta1, and that v1beta1 resource
// endpoints actually exist and return correctly versioned content.
func TestIntegrationAPIGroupDiscoveryVersions(t *testing.T) {
	helper := sharedHelper(t)
	ctx := context.Background()

	t.Run("API group lists both versions", func(t *testing.T) {
		result := helper.AdminREST.Get().AbsPath("/apis/provisioning.grafana.app").Do(ctx)
		require.NoError(t, result.Error())

		raw, err := result.Raw()
		require.NoError(t, err)

		var group metav1.APIGroup
		require.NoError(t, json.Unmarshal(raw, &group))

		versions := make(map[string]bool)
		for _, v := range group.Versions {
			versions[v.Version] = true
		}
		assert.True(t, versions["v0alpha1"], "v0alpha1 should be listed in API group versions")
		assert.True(t, versions["v1beta1"], "v1beta1 should be listed in API group versions")
	})

	t.Run("v1beta1 resource list endpoint returns v1beta1 resources", func(t *testing.T) {
		result := helper.AdminREST.Get().
			AbsPath("/apis/provisioning.grafana.app/v1beta1").
			Do(ctx)
		require.NoError(t, result.Error())

		raw, err := result.Raw()
		require.NoError(t, err)

		var resourceList metav1.APIResourceList
		require.NoError(t, json.Unmarshal(raw, &resourceList))

		assert.Equal(t, "provisioning.grafana.app/v1beta1", resourceList.GroupVersion,
			"resource list groupVersion must be v1beta1, got %q", resourceList.GroupVersion)

		resourceNames := make(map[string]bool)
		for _, r := range resourceList.APIResources {
			resourceNames[r.Name] = true
		}
		assert.True(t, resourceNames["repositories"], "repositories should be in v1beta1 resources")
		assert.True(t, resourceNames["connections"], "connections should be in v1beta1 resources")
	})
}

// TestIntegrationRawHTTPVersionDiagnostic provides detailed diagnostic output
// for debugging the version mismatch. It logs the full raw JSON response so
// that when the test fails, the output gives immediate visibility into what
// the server is actually returning.
func TestIntegrationRawHTTPVersionDiagnostic(t *testing.T) {
	helper := sharedHelper(t)
	ctx := context.Background()

	const repoName = "diag-raw-version"
	createRepoViaREST(t, helper, repoName, "v0alpha1")

	for _, version := range []string{"v0alpha1", "v1beta1"} {
		t.Run("raw GET /"+version+"/"+repoName, func(t *testing.T) {
			result := helper.AdminREST.Get().
				AbsPath("/apis/provisioning.grafana.app/" + version + "/namespaces/default/repositories/" + repoName).
				Do(ctx)
			require.NoError(t, result.Error())

			raw, err := result.Raw()
			require.NoError(t, err)

			var obj map[string]interface{}
			require.NoError(t, json.Unmarshal(raw, &obj))

			apiVersion, _ := obj["apiVersion"].(string)
			kind, _ := obj["kind"].(string)

			t.Logf("Endpoint version: %s", version)
			t.Logf("Response apiVersion: %s", apiVersion)
			t.Logf("Response kind: %s", kind)
			t.Logf("Full response (first 2048 bytes):\n%s", truncate(string(raw), 2048))

			expected := "provisioning.grafana.app/" + version
			assert.Equal(t, expected, apiVersion,
				"GET via %s must return %s, got %q", version, expected, apiVersion)
		})
	}

	for _, version := range []string{"v0alpha1", "v1beta1"} {
		t.Run("raw LIST /"+version, func(t *testing.T) {
			result := helper.AdminREST.Get().
				AbsPath("/apis/provisioning.grafana.app/" + version + "/namespaces/default/repositories").
				Do(ctx)
			require.NoError(t, result.Error())

			raw, err := result.Raw()
			require.NoError(t, err)

			var obj map[string]interface{}
			require.NoError(t, json.Unmarshal(raw, &obj))

			apiVersion, _ := obj["apiVersion"].(string)

			t.Logf("LIST endpoint version: %s", version)
			t.Logf("LIST response apiVersion: %s", apiVersion)

			items, _ := obj["items"].([]interface{})
			for i, item := range items {
				itemObj, _ := item.(map[string]interface{})
				itemVersion, _ := itemObj["apiVersion"].(string)
				itemName := "(unknown)"
				if md, ok := itemObj["metadata"].(map[string]interface{}); ok {
					if n, ok := md["name"].(string); ok {
						itemName = n
					}
				}
				t.Logf("  item[%d] name=%s apiVersion=%s", i, itemName, itemVersion)
			}

			expected := "provisioning.grafana.app/" + version
			assert.Equal(t, expected, apiVersion,
				"LIST via %s must return %s, got %q", version, expected, apiVersion)
		})
	}
}

func truncate(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen] + "... (truncated)"
}
