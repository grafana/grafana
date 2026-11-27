// SPDX-License-Identifier: AGPL-3.0-only

package v1beta2

import (
	"encoding/json"
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/apimachinery/pkg/watch"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

const (
	group              = "provisioning.grafana.app"
	v0alpha1APIVersion = group + "/v0alpha1"
	v1beta1APIVersion  = group + "/v1beta1"
	v1beta2APIVersion  = group + "/v1beta2"
)

func repositoryBody(name, apiVersion, provisioningPath string) map[string]interface{} {
	return map[string]interface{}{
		"apiVersion": apiVersion,
		"kind":       "Repository",
		"metadata":   map[string]interface{}{"name": name, "namespace": "default"},
		"spec": map[string]interface{}{
			"title":     "v1beta2 test - " + name,
			"type":      "local",
			"local":     map[string]interface{}{"path": provisioningPath},
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
		"metadata":   map[string]interface{}{"name": name, "namespace": "default"},
		"spec": map[string]interface{}{
			"title": "v1beta2 test - " + name,
			"type":  "github",
			"github": map[string]interface{}{
				"appID":          "123456",
				"installationID": "789012",
			},
		},
		"secure": map[string]interface{}{
			"privateKey": map[string]interface{}{"create": common.TestGithubPrivateKeyBase64()},
		},
	}
}

func v1beta2Client(helper *common.ProvisioningTestHelper, resource string) *apis.K8sResourceClient {
	return helper.GetResourceClient(apis.ResourceClientArgs{
		User:      helper.Org1.Admin,
		Namespace: "default",
		GVR:       schema.GroupVersionResource{Group: group, Version: "v1beta2", Resource: resource},
	})
}

func storedObject(t *testing.T, helper *common.ProvisioningTestHelper, resource, name string) map[string]interface{} {
	t.Helper()
	ctx, _ := identity.WithServiceIdentity(t.Context(), helper.Org1.OrgID)
	rsp, err := helper.GetEnv().ResourceClient.Read(ctx, &resourcepb.ReadRequest{
		Key: &resourcepb.ResourceKey{Namespace: "default", Group: group, Resource: resource, Name: name},
	})
	require.NoError(t, err, "reading %s/%s from storage", resource, name)
	var stored map[string]interface{}
	require.NoError(t, json.Unmarshal(rsp.Value, &stored))
	return stored
}

func nested(obj map[string]interface{}, fields ...string) interface{} {
	var cur interface{} = obj
	for _, f := range fields {
		m, ok := cur.(map[string]interface{})
		if !ok {
			return nil
		}
		cur = m[f]
	}
	return cur
}

func listItems(t *testing.T, list map[string]interface{}) []map[string]interface{} {
	t.Helper()
	raw, _ := list["items"].([]interface{})
	items := make([]map[string]interface{}, 0, len(raw))
	for i, item := range raw {
		obj, ok := item.(map[string]interface{})
		require.True(t, ok, "item %d should be an object", i)
		items = append(items, obj)
	}
	return items
}

func TestIntegrationV1beta2Discovery(t *testing.T) {
	helper := sharedHelper(t)
	disco := helper.NewDiscoveryClient()

	resources, err := disco.ServerResourcesForGroupVersion(v1beta2APIVersion)
	require.NoError(t, err)
	names := make([]string, 0, len(resources.APIResources))
	for _, r := range resources.APIResources {
		names = append(names, r.Name)
	}
	for _, expected := range []string{
		"repositories", "repositories/status", "connections", "connections/status", "jobs", "historicjobs",
		"repositories/refs", "repositories/resources", "repositories/stats", "repositories/history", "repositories/files",
		"connections/repositories",
	} {
		assert.Contains(t, names, expected)
	}

	groups, err := disco.ServerGroups()
	require.NoError(t, err)
	for _, g := range groups.Groups {
		if g.Name != group {
			continue
		}
		assert.NotEqual(t, "v1beta2", g.PreferredVersion.Version, "v1beta2 must not become the preferred version")
		versions := make([]string, 0, len(g.Versions))
		for _, v := range g.Versions {
			versions = append(versions, v.Version)
		}
		assert.Contains(t, versions, "v1beta2")
		return
	}
	t.Fatalf("group %s not found in discovery", group)
}

func TestIntegrationV1beta2Repository(t *testing.T) {
	helper := sharedHelper(t)

	t.Run("is readable from every version and persisted as v0alpha1", func(t *testing.T) {
		for _, createVersion := range []string{"v0alpha1", "v1beta1", "v1beta2"} {
			t.Run("created via "+createVersion, func(t *testing.T) {
				name := "v1beta2-repo-" + createVersion
				_, err := helper.RESTDo("POST", createVersion, "repositories", repositoryBody(name, group+"/"+createVersion, helper.ProvisioningPath))
				require.NoError(t, err)

				for _, queryVersion := range []string{"v0alpha1", "v1beta1", "v1beta2"} {
					obj, err := helper.RESTDo("GET", queryVersion, "repositories/"+name)
					require.NoError(t, err)
					assert.Equal(t, group+"/"+queryVersion, obj["apiVersion"])
					assert.Equal(t, "v1beta2 test - "+name, nested(obj, "spec", "title"))
					assert.Equal(t, helper.ProvisioningPath, nested(obj, "spec", "local", "path"))
				}

				assert.Equal(t, v0alpha1APIVersion, storedObject(t, helper, "repositories", name)["apiVersion"])
			})
		}
	})

	t.Run("lists items as v1beta2", func(t *testing.T) {
		list, err := helper.RESTDo("GET", "v1beta2", "repositories")
		require.NoError(t, err)
		assert.Equal(t, v1beta2APIVersion, list["apiVersion"])
		items := listItems(t, list)
		require.NotEmpty(t, items)
		for _, item := range items {
			assert.Equal(t, v1beta2APIVersion, item["apiVersion"])
		}
	})

	t.Run("supports the connection field selector", func(t *testing.T) {
		client := v1beta2Client(helper, "repositories")
		all, err := client.Resource.List(t.Context(), metav1.ListOptions{FieldSelector: "spec.connection.name="})
		require.NoError(t, err)
		assert.NotEmpty(t, all.Items, "repositories without a connection match the empty name")

		none, err := client.Resource.List(t.Context(), metav1.ListOptions{FieldSelector: "spec.connection.name=does-not-exist"})
		require.NoError(t, err)
		assert.Empty(t, none.Items)
	})

	t.Run("watches as v1beta2", func(t *testing.T) {
		client := v1beta2Client(helper, "repositories")
		list, err := client.Resource.List(t.Context(), metav1.ListOptions{})
		require.NoError(t, err)

		watcher, err := client.Resource.Watch(t.Context(), metav1.ListOptions{ResourceVersion: list.GetResourceVersion()})
		require.NoError(t, err)
		defer watcher.Stop()

		name := "v1beta2-repo-watched"
		_, err = helper.RESTDo("POST", "v0alpha1", "repositories", repositoryBody(name, v0alpha1APIVersion, helper.ProvisioningPath))
		require.NoError(t, err)

		for event := range watcher.ResultChan() {
			require.NotEqual(t, watch.Error, event.Type, "watch error: %v", event.Object)
			obj, ok := event.Object.(interface{ GetName() string })
			if !ok || obj.GetName() != name || event.Type != watch.Added {
				continue
			}
			assert.Equal(t, v1beta2APIVersion, event.Object.GetObjectKind().GroupVersionKind().GroupVersion().String())
			return
		}
		t.Fatal("watch closed before the ADDED event arrived")
	})

	t.Run("patches status via v1beta2", func(t *testing.T) {
		name := "v1beta2-repo-status"
		_, err := helper.RESTDo("POST", "v1beta2", "repositories", repositoryBody(name, v1beta2APIVersion, helper.ProvisioningPath))
		require.NoError(t, err)
		helper.WaitForHealthyRepository(t, name)

		client := v1beta2Client(helper, "repositories")
		require.EventuallyWithT(t, func(c *assert.CollectT) {
			obj, err := client.Resource.Get(t.Context(), name, metav1.GetOptions{})
			if !assert.NoError(c, err) {
				return
			}
			conditions, _ := nested(obj.Object, "status", "conditions").([]interface{})
			assert.NotEmpty(c, conditions)
		}, common.WaitTimeoutDefault, common.WaitIntervalDefault, "the controller should write conditions")

		patch := `[{"op":"add","path":"/status/conditions/-","value":{"type":"V1beta2Test","status":"True","reason":"Testing","message":"from v1beta2","lastTransitionTime":"2026-11-27T10:00:00Z"}}]`
		_, err = client.Resource.Patch(t.Context(), name, types.JSONPatchType, []byte(patch), metav1.PatchOptions{}, "status")
		require.NoError(t, err)

		obj, err := helper.RESTDo("GET", "v0alpha1", "repositories/"+name)
		require.NoError(t, err)
		conditions, _ := nested(obj, "status", "conditions").([]interface{})
		var found map[string]interface{}
		for _, c := range conditions {
			if cond, ok := c.(map[string]interface{}); ok && cond["type"] == "V1beta2Test" {
				found = cond
			}
		}
		require.NotNil(t, found, "the condition patched via v1beta2 should be readable via v0alpha1")
		assert.Equal(t, "from v1beta2", found["message"])
		assert.Equal(t, "2026-11-27T10:00:00Z", found["lastTransitionTime"])
	})
}

func TestIntegrationV1beta2Admission(t *testing.T) {
	helper := sharedHelper(t)

	t.Run("rejects unknown secure keys", func(t *testing.T) {
		body := repositoryBody("v1beta2-bad-secure", v1beta2APIVersion, helper.ProvisioningPath)
		body["secure"] = map[string]interface{}{"bogus": map[string]interface{}{"create": "value"}}
		_, err := helper.RESTDo("POST", "v1beta2", "repositories", body)
		require.Error(t, err)
		assert.True(t, apierrors.IsInvalid(err), "expected 422, got %v", err)
		assert.Contains(t, err.Error(), "secure[bogus]")
	})

	t.Run("rejects unparsable condition times", func(t *testing.T) {
		body := connectionBody("v1beta2-bad-condition", v1beta2APIVersion)
		body["status"] = map[string]interface{}{
			"conditions": []interface{}{map[string]interface{}{
				"type": "Ready", "status": "True", "reason": "Available", "message": "", "lastTransitionTime": "yesterday",
			}},
		}
		_, err := helper.RESTDo("POST", "v1beta2", "connections", body)
		require.Error(t, err)
		assert.True(t, apierrors.IsInvalid(err), "expected 422, got %v", err)
		assert.Contains(t, err.Error(), "lastTransitionTime")
	})

	t.Run("applies the v0alpha1 validation", func(t *testing.T) {
		causes := map[string][]metav1.StatusCause{}
		for _, version := range []string{"v0alpha1", "v1beta2"} {
			body := repositoryBody("v1beta2-invalid-"+version, group+"/"+version, helper.ProvisioningPath)
			body["spec"].(map[string]interface{})["title"] = ""
			_, err := helper.RESTDo("POST", version, "repositories", body)
			require.Error(t, err)
			require.True(t, apierrors.IsInvalid(err), "%s: expected 422, got %v", version, err)
			var status apierrors.APIStatus
			require.ErrorAs(t, err, &status)
			require.NotNil(t, status.Status().Details)
			causes[version] = status.Status().Details.Causes
		}
		assert.NotEmpty(t, causes["v0alpha1"])
		assert.Equal(t, causes["v0alpha1"], causes["v1beta2"])
	})
}

func TestIntegrationV1beta2Connection(t *testing.T) {
	helper := sharedHelper(t)

	name := "v1beta2-connection"
	created, err := helper.RESTDo("POST", "v1beta2", "connections", connectionBody(name, v1beta2APIVersion))
	require.NoError(t, err)
	assert.Equal(t, v1beta2APIVersion, created["apiVersion"])
	secureName, _ := nested(created, "secure", "privateKey", "name").(string)
	require.NotEmpty(t, secureName, "the inline secure value should be stored")

	for _, version := range []string{"v0alpha1", "v1beta1", "v1beta2"} {
		obj, err := helper.RESTDo("GET", version, "connections/"+name)
		require.NoError(t, err)
		assert.Equal(t, group+"/"+version, obj["apiVersion"])
		assert.Equal(t, secureName, nested(obj, "secure", "privateKey", "name"), version)
		assert.Equal(t, "123456", nested(obj, "spec", "github", "appID"), version)
	}

	assert.Equal(t, v0alpha1APIVersion, storedObject(t, helper, "connections", name)["apiVersion"])
}

func TestIntegrationV1beta2Jobs(t *testing.T) {
	helper := sharedHelper(t)

	repo := "v1beta2-jobs"
	_, err := helper.RESTDo("POST", "v0alpha1", "repositories", repositoryBody(repo, v0alpha1APIVersion, helper.ProvisioningPath))
	require.NoError(t, err)
	helper.WaitForHealthyRepository(t, repo)
	helper.SyncAndWait(t, repo, nil)

	jobs, err := helper.RESTDo("GET", "v1beta2", "jobs")
	require.NoError(t, err)
	assert.Equal(t, v1beta2APIVersion, jobs["apiVersion"])

	require.EventuallyWithT(t, func(c *assert.CollectT) {
		list, err := helper.RESTDo("GET", "v1beta2", "historicjobs")
		if !assert.NoError(c, err) {
			return
		}
		assert.Equal(c, v1beta2APIVersion, list["apiVersion"])
		var matched []map[string]interface{}
		for _, item := range listItems(t, list) {
			if nested(item, "spec", "repository") == repo {
				matched = append(matched, item)
			}
		}
		if !assert.NotEmpty(c, matched, "the finished sync should be in the history") {
			return
		}
		for _, item := range matched {
			assert.Equal(c, v1beta2APIVersion, item["apiVersion"])
			assert.Equal(c, "pull", nested(item, "spec", "action"))
			assert.Equal(c, "success", nested(item, "status", "state"), fmt.Sprintf("job %v", nested(item, "metadata", "name")))
		}
	}, common.WaitTimeoutDefault, common.WaitIntervalDefault)
}
