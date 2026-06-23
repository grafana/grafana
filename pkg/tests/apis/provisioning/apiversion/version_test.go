package apiversion

import (
	"context"
	"encoding/json"
	"fmt"
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

func connectionBody(name, apiVersion string) map[string]interface{} {
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

// TestIntegrationVersionConsistency verifies that the provisioning API returns
// the correct apiVersion in responses matching the endpoint version, regardless
// of which version was used for creation. Covers GET, LIST, CREATE, UPDATE, and
// DELETE across both Repository and Connection resources.
func TestIntegrationVersionConsistency(t *testing.T) {
	helper := sharedHelper(t)

	type resourceDef struct {
		resource string
		body     func(name, apiVersion string) map[string]interface{}
	}

	resources := []resourceDef{
		{
			resource: "repositories",
			body: func(name, apiVersion string) map[string]interface{} {
				return repositoryBody(name, apiVersion, helper.ProvisioningPath)
			},
		},
		{
			resource: "connections",
			body:     connectionBody,
		},
	}

	versionCombos := []struct {
		name            string
		createVersion   string
		queryVersion    string
		expectedVersion string
	}{
		{"same v1beta1", "v1beta1", "v1beta1", v1beta1APIVersion},
		{"same v0alpha1", "v0alpha1", "v0alpha1", v0alpha1APIVersion},
		{"create v0alpha1 query v1beta1", "v0alpha1", "v1beta1", v1beta1APIVersion},
		{"create v1beta1 query v0alpha1", "v1beta1", "v0alpha1", v0alpha1APIVersion},
	}

	t.Run("GET returns endpoint version", func(t *testing.T) {
		for _, res := range resources {
			t.Run(res.resource, func(t *testing.T) {
				for i, tc := range versionCombos {
					t.Run(tc.name, func(t *testing.T) {
						name := fmt.Sprintf("ver-get-%s-%d", res.resource[:4], i)
						body := res.body(name, "provisioning.grafana.app/"+tc.createVersion)
						_, err := helper.RESTDo("POST", tc.createVersion, res.resource, body)
						require.NoError(t, err)

						obj, err := helper.RESTDo("GET", tc.queryVersion, res.resource+"/"+name)
						require.NoError(t, err)
						assert.Equal(t, tc.expectedVersion, obj["apiVersion"])
					})
				}
			})
		}
	})

	t.Run("LIST returns endpoint version for list and all items", func(t *testing.T) {
		for _, res := range resources {
			t.Run(res.resource, func(t *testing.T) {
				for _, version := range []string{"v0alpha1", "v1beta1"} {
					t.Run(version, func(t *testing.T) {
						expected := "provisioning.grafana.app/" + version
						obj, err := helper.RESTDo("GET", version, res.resource)
						require.NoError(t, err)
						assert.Equal(t, expected, obj["apiVersion"])

						items, _ := obj["items"].([]interface{})
						require.GreaterOrEqual(t, len(items), 1, "list should contain at least one item")
						for i, item := range items {
							itemObj, ok := item.(map[string]interface{})
							require.True(t, ok, "item %d should be a map", i)
							assert.Equal(t, expected, itemObj["apiVersion"], "item %d", i)
						}
					})
				}
			})
		}
	})

	t.Run("CREATE response returns endpoint version", func(t *testing.T) {
		for _, version := range []string{"v0alpha1", "v1beta1"} {
			t.Run(version, func(t *testing.T) {
				expected := "provisioning.grafana.app/" + version
				name := "ver-create-" + version
				body := repositoryBody(name, expected, helper.ProvisioningPath)
				obj, err := helper.RESTDo("POST", version, "repositories", body)
				require.NoError(t, err)
				assert.Equal(t, expected, obj["apiVersion"])
			})
		}
	})

	t.Run("UPDATE response returns endpoint version", func(t *testing.T) {
		for _, version := range []string{"v0alpha1", "v1beta1"} {
			t.Run(version, func(t *testing.T) {
				expected := "provisioning.grafana.app/" + version
				name := "ver-update-" + version
				body := repositoryBody(name, expected, helper.ProvisioningPath)
				_, err := helper.RESTDo("POST", version, "repositories", body)
				require.NoError(t, err)

				var obj map[string]interface{}
				err = common.RetryOnConflict(t, func() error {
					current, err := helper.RESTDo("GET", version, "repositories/"+name)
					if err != nil {
						return err
					}
					if err := unstructured.SetNestedField(current, "Updated Title", "spec", "title"); err != nil {
						return err
					}
					obj, err = helper.RESTDo("PUT", version, "repositories/"+name, current)
					return err
				})
				require.NoError(t, err)
				assert.Equal(t, expected, obj["apiVersion"])
			})
		}
	})

	t.Run("DELETE response returns endpoint version", func(t *testing.T) {
		for _, version := range []string{"v0alpha1", "v1beta1"} {
			t.Run(version, func(t *testing.T) {
				expected := "provisioning.grafana.app/" + version
				name := "ver-delete-" + version
				body := repositoryBody(name, expected, helper.ProvisioningPath)
				_, err := helper.RESTDo("POST", version, "repositories", body)
				require.NoError(t, err)

				obj, err := helper.RESTDo("DELETE", version, "repositories/"+name)
				require.NoError(t, err)
				if kind, _ := obj["kind"].(string); kind == "Repository" {
					assert.Equal(t, expected, obj["apiVersion"])
				}
			})
		}
	})
}

// TestIntegrationDynamicClientVersionConsistency verifies version consistency
// when using the typed dynamic client (schema.GroupVersionResource with v1beta1).
func TestIntegrationDynamicClientVersionConsistency(t *testing.T) {
	helper := sharedHelper(t)
	ctx := context.Background()
	repoClient := common.GetRepositoryClientV1Beta1(helper.K8sTestHelper)

	t.Run("create and get", func(t *testing.T) {
		repo := &unstructured.Unstructured{
			Object: repositoryBody("dyn-v1beta1-repo", v1beta1APIVersion, helper.ProvisioningPath),
		}

		created, err := repoClient.Resource.Create(ctx, repo, metav1.CreateOptions{})
		require.NoError(t, err)
		assert.Equal(t, v1beta1APIVersion, created.GetAPIVersion())

		fetched, err := repoClient.Resource.Get(ctx, "dyn-v1beta1-repo", metav1.GetOptions{})
		require.NoError(t, err)
		assert.Equal(t, v1beta1APIVersion, fetched.GetAPIVersion())
	})

	t.Run("list", func(t *testing.T) {
		list, err := repoClient.Resource.List(ctx, metav1.ListOptions{})
		require.NoError(t, err)
		assert.Equal(t, v1beta1APIVersion, list.GetAPIVersion())

		for i, item := range list.Items {
			assert.Equal(t, v1beta1APIVersion, item.GetAPIVersion(),
				"item %d (%s)", i, item.GetName())
		}
	})
}

// TestIntegrationAPIGroupDiscoveryVersions checks that the provisioning API
// group advertises both v0alpha1 and v1beta1, and that v1beta1 resource
// endpoints exist with the expected resources.
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
		assert.True(t, versions["v0alpha1"], "v0alpha1 should be listed")
		assert.True(t, versions["v1beta1"], "v1beta1 should be listed")
	})

	t.Run("v1beta1 resource list contains expected resources", func(t *testing.T) {
		result := helper.AdminREST.Get().
			AbsPath("/apis/provisioning.grafana.app/v1beta1").
			Do(ctx)
		require.NoError(t, result.Error())

		raw, err := result.Raw()
		require.NoError(t, err)

		var resourceList metav1.APIResourceList
		require.NoError(t, json.Unmarshal(raw, &resourceList))

		assert.Equal(t, v1beta1APIVersion, resourceList.GroupVersion)

		resourceNames := make(map[string]bool)
		for _, r := range resourceList.APIResources {
			resourceNames[r.Name] = true
		}
		assert.True(t, resourceNames["repositories"], "repositories should be in v1beta1")
		assert.True(t, resourceNames["connections"], "connections should be in v1beta1")
	})
}
