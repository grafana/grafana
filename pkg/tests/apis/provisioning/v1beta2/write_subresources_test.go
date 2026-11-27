// SPDX-License-Identifier: AGPL-3.0-only

package v1beta2

import (
	"encoding/json"
	"net/http"
	"net/url"
	"strings"
	"testing"
	"uuid"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

// doSubresource sends body to subpath, which may have a query, below the default namespace and
// returns the status code and raw response.
func doSubresource(t *testing.T, helper *common.ProvisioningTestHelper, method, version, subpath string, body []byte) (int, []byte) {
	t.Helper()
	subpath, rawQuery, _ := strings.Cut(subpath, "?")
	query, err := url.ParseQuery(rawQuery)
	require.NoError(t, err)
	req := helper.AdminREST.Verb(method).
		AbsPath("/apis/"+group+"/"+version+"/namespaces/default/"+subpath).
		SetHeader("Content-Type", "application/json")
	for key, values := range query {
		for _, value := range values {
			req = req.Param(key, value)
		}
	}
	if body != nil {
		req = req.Body(body)
	}
	var code int
	raw, _ := req.Do(t.Context()).StatusCode(&code).Raw()
	return code, raw
}

func decodeBody(t *testing.T, raw []byte) map[string]interface{} {
	t.Helper()
	var body map[string]interface{}
	require.NoError(t, json.Unmarshal(raw, &body), "%s", raw)
	return body
}

// requireSameWrite sends each version its own body and asserts both answer alike, apart from the
// version in apiVersion. It returns the v1beta2 body.
func requireSameWrite(t *testing.T, helper *common.ProvisioningTestHelper, method, subpath string, bodies map[string][]byte, expectedCode int) map[string]interface{} {
	t.Helper()
	responses := map[string]map[string]interface{}{}
	for _, version := range []string{"v0alpha1", "v1beta2"} {
		code, raw := doSubresource(t, helper, method, version, subpath, bodies[version])
		require.Equal(t, expectedCode, code, "%s %s %s: %s", method, version, subpath, raw)
		responses[version] = decodeBody(t, raw)
	}
	assert.Equal(t, withAPIVersion(responses["v0alpha1"], v1beta2APIVersion), responses["v1beta2"], "%s %s", method, subpath)
	return responses["v1beta2"]
}

func sameBody(body []byte) map[string][]byte {
	return map[string][]byte{"v0alpha1": body, "v1beta2": body}
}

func withAPIVersion(obj map[string]interface{}, apiVersion string) map[string]interface{} {
	out := make(map[string]interface{}, len(obj))
	for k, v := range obj {
		out[k] = v
	}
	if obj["apiVersion"] == v0alpha1APIVersion {
		out["apiVersion"] = apiVersion
	}
	return out
}

func mustJSON(t *testing.T, v interface{}) []byte {
	t.Helper()
	raw, err := json.Marshal(v)
	require.NoError(t, err)
	return raw
}

// withoutVolatile drops what differs between two writes of equivalent resources: server-set
// identity and timestamps, folder UIDs hashed from version-specific paths, and the version in
// names, paths and apiVersions.
func withoutVolatile(v interface{}) interface{} {
	switch v := v.(type) {
	case map[string]interface{}:
		out := make(map[string]interface{}, len(v))
		for k, val := range v {
			switch k {
			case "uid", "resourceVersion", "creationTimestamp", "generation", "managedFields", "hash", "timestamp",
				"grafana.app/folder", "grafana.app/updatedTimestamp", "grafana.app/sourceChecksum", "grafana.app/sourceTimestamp":
				continue
			}
			out[k] = withoutVolatile(val)
		}
		return out
	case []interface{}:
		out := make([]interface{}, len(v))
		for i, val := range v {
			out[i] = withoutVolatile(val)
		}
		return out
	case string:
		return strings.NewReplacer("v0alpha1", "VERSION", "v1beta2", "VERSION").Replace(v)
	default:
		return v
	}
}

func dashboardFile(t *testing.T, name string) []byte {
	return mustJSON(t, map[string]interface{}{
		"apiVersion": "dashboard.grafana.app/v1beta1",
		"kind":       "Dashboard",
		"metadata":   map[string]interface{}{"name": name},
		"spec":       map[string]interface{}{"title": "Dashboard " + name, "schemaVersion": 41},
	})
}

func TestIntegrationV1beta2WriteSubresources(t *testing.T) {
	helper := sharedHelper(t)

	repo := "v1beta2-write-subresources"
	_, err := helper.RESTDo("POST", "v0alpha1", "repositories", repositoryBody(repo, v0alpha1APIVersion, helper.ProvisioningPath))
	require.NoError(t, err)
	helper.WaitForHealthyRepository(t, repo)
	repoPath := "repositories/" + repo

	t.Run("test the stored repository", func(t *testing.T) {
		body := requireSameWrite(t, helper, http.MethodPost, repoPath+"/test", sameBody([]byte(`{}`)), http.StatusOK)
		assert.Equal(t, "TestResults", body["kind"])
		assert.Equal(t, true, body["success"])
	})

	t.Run("test a repository spec", func(t *testing.T) {
		requireSameWrite(t, helper, http.MethodPost, repoPath+"/test", map[string][]byte{
			"v0alpha1": mustJSON(t, repositoryBody(repo, v0alpha1APIVersion, helper.ProvisioningPath)),
			"v1beta2":  mustJSON(t, repositoryBody(repo, v1beta2APIVersion, helper.ProvisioningPath)),
		}, http.StatusOK)
	})

	t.Run("test an invalid repository spec", func(t *testing.T) {
		bodies := map[string][]byte{}
		for _, version := range []string{"v0alpha1", "v1beta2"} {
			spec := repositoryBody(repo, group+"/"+version, helper.ProvisioningPath)
			spec["spec"].(map[string]interface{})["title"] = ""
			bodies[version] = mustJSON(t, spec)
		}
		body := requireSameWrite(t, helper, http.MethodPost, repoPath+"/test", bodies, http.StatusUnprocessableEntity)
		assert.NotEmpty(t, body["errors"])
	})

	t.Run("files", func(t *testing.T) {
		responses := map[string]map[string]map[string]interface{}{}
		for _, version := range []string{"v0alpha1", "v1beta2"} {
			file := repoPath + "/files/" + version + "/dashboard.json?message=" + version
			steps := []struct {
				name, method, path string
				body               []byte
			}{
				{"create", http.MethodPost, file, dashboardFile(t, "v1beta2-files-"+version)},
				{"update", http.MethodPut, file, dashboardFile(t, "v1beta2-files-"+version)},
				{"create folder", http.MethodPost, repoPath + "/files/" + version + "/folder/", nil},
				{"move", http.MethodPost, repoPath + "/files/" + version + "/moved.json?originalPath=" + version + "/dashboard.json", nil},
				{"delete", http.MethodDelete, repoPath + "/files/" + version + "/moved.json", nil},
			}
			responses[version] = map[string]map[string]interface{}{}
			for _, step := range steps {
				code, raw := doSubresource(t, helper, step.method, version, step.path, step.body)
				require.Equal(t, http.StatusOK, code, "%s %s: %s", version, step.name, raw)
				responses[version][step.name] = decodeBody(t, raw)
			}
		}
		for step, v1 := range responses["v1beta2"] {
			v0 := responses["v0alpha1"][step]
			assert.Equal(t, v1beta2APIVersion, v1["apiVersion"], step)
			assert.Equal(t, "ResourceWrapper", v1["kind"], step)
			assert.Equal(t, withoutVolatile(v0), withoutVolatile(v1), step)
		}
	})

	t.Run("files with an invalid body", func(t *testing.T) {
		bodies := sameBody([]byte(`{"not": "a resource"`))
		requireSameWrite(t, helper, http.MethodPost, repoPath+"/files/invalid.json", bodies, http.StatusBadRequest)
	})

	t.Run("jobs", func(t *testing.T) {
		pull := []byte(`{"action":"pull","pull":{"incremental":false}}`)
		jobs := map[string]map[string]interface{}{}
		for _, version := range []string{"v0alpha1", "v1beta2"} {
			code, raw := doSubresource(t, helper, http.MethodPost, version, repoPath+"/jobs", pull)
			require.Equal(t, http.StatusAccepted, code, "%s: %s", version, raw)
			jobs[version] = decodeBody(t, raw)
			helper.AwaitJobs(t, repo)
		}
		assert.Equal(t, group+"/v1beta2", jobs["v1beta2"]["apiVersion"])
		assert.Equal(t, "Job", jobs["v1beta2"]["kind"])
		for _, job := range jobs {
			delete(job["metadata"].(map[string]interface{}), "name")
		}
		assert.Equal(t, withoutVolatile(jobs["v0alpha1"]), withoutVolatile(jobs["v1beta2"]))

		for version, job := range jobs {
			uid, _ := nested(job, "metadata", "uid").(string)
			require.NotEmpty(t, uid, version)
			require.EventuallyWithT(t, func(c *assert.CollectT) {
				code, raw := doSubresource(t, helper, http.MethodGet, "v0alpha1", repoPath+"/jobs/"+uid, nil)
				assert.Equal(c, http.StatusOK, code, "%s", raw)
			}, common.WaitTimeoutDefault, common.WaitIntervalDefault, "the %s job should be in the history", version)
			historic := requireSameResponse(t, helper, repoPath+"/jobs/"+uid, http.StatusOK)
			assert.Equal(t, "Job", historic["kind"])
			assert.Equal(t, "success", nested(historic, "status", "state"))
		}

		list := requireSameResponse(t, helper, repoPath+"/jobs", http.StatusOK)
		assert.Equal(t, "JobList", list["kind"])
		assert.GreaterOrEqual(t, len(listItems(t, list)), 2)

		requireSameResponse(t, helper, repoPath+"/jobs/"+uuid.New().String(), http.StatusNotFound)
	})

	t.Run("jobs with unknown fields", func(t *testing.T) {
		code, raw := doSubresource(t, helper, http.MethodPost, "v0alpha1", repoPath+"/jobs", []byte(`{"action":"pull","bogus":true}`))
		require.Equal(t, http.StatusBadRequest, code, "%s", raw)
		code, raw = doSubresource(t, helper, http.MethodPost, "v1beta2", repoPath+"/jobs", []byte(`{"action":"pull","bogus":true}`))
		require.Equal(t, http.StatusBadRequest, code, "%s", raw)
		assert.Contains(t, string(raw), "unknown field")
	})

	t.Run("webhook", func(t *testing.T) {
		requireSameWrite(t, helper, http.MethodPost, repoPath+"/webhook", sameBody([]byte(`{}`)), http.StatusBadRequest)
	})

	t.Run("render", func(t *testing.T) {
		requireSameResponse(t, helper, repoPath+"/render/"+uuid.New().String(), http.StatusNotFound)
		requireSameResponse(t, helper, repoPath+"/render/not_a_uuid", http.StatusBadRequest)
	})

	t.Run("connection authorize", func(t *testing.T) {
		name := "v1beta2-write-subresources-connection"
		_, err := helper.CreateGithubConnection(t, &unstructured.Unstructured{Object: connectionBody(name, v0alpha1APIVersion)})
		require.NoError(t, err)
		path := "connections/" + name + "/authorize"

		bodies := map[string][]byte{}
		for _, version := range []string{"v0alpha1", "v1beta2"} {
			bodies[version] = mustJSON(t, map[string]interface{}{
				"apiVersion": group + "/" + version,
				"kind":       "ConnectionAuthorizeRequest",
				"spec":       map[string]interface{}{"code": "abc", "redirectURI": "https://example.com/callback"},
			})
		}
		// GitHub App connections are not authorized with OAuth; reaching that check shows the code arrived.
		requireSameWrite(t, helper, http.MethodPost, path, bodies, http.StatusNotImplemented)
		requireSameWrite(t, helper, http.MethodPost, path, sameBody([]byte(`{"spec":{}}`)), http.StatusBadRequest)
	})
}
