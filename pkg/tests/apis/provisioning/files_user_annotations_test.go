package provisioning

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

// A file written by Git Sync keeps metadata.name and the user annotations only:
// labels, the namespace, server fields and Grafana-owned annotations are derived
// again when the file is read back, so a request body must not be able to plant
// them in the repository. grafana.app/useCrossDashboardVariables is user content
// set from the dashboard UI even though it lives under the Grafana domain.
func TestIntegrationProvisioning_FileWritesKeepUserAnnotations(t *testing.T) {
	helper := sharedHelper(t)

	const (
		repo         = "user-annotations-repo"
		name         = "user-annotations-dash"
		path         = "cross-vars/user-annotations.json"
		renamedTitle = "User annotations renamed"

		ownerKey        = "example.com/owner"
		crossVarsKey    = utils.AnnoKeyUseCrossDashboardVariables
		crossVarsAll    = `{"global":"all","folder":"none"}`
		crossVarsPicked = `{"global":["gateway_base_url"],"folder":"none"}`
	)

	helper.CreateLocalRepo(t, common.TestRepo{
		Name:       repo,
		SyncTarget: "instance",
		Workflows:  []string{"write"},
	})

	originalSpec := map[string]any{
		"title":         "User annotations",
		"schemaVersion": 42,
		"editable":      true,
		"tags":          []any{"git-sync"},
		"panels":        []any{},
		"time":          map[string]any{"from": "now-6h", "to": "now"},
	}

	// asDecodedJSON returns v as it decodes from a JSON file, to compare it with one.
	asDecodedJSON := func(t *testing.T, v any) map[string]any {
		t.Helper()
		data, err := json.Marshal(v)
		require.NoError(t, err)
		var decoded map[string]any
		require.NoError(t, json.Unmarshal(data, &decoded))
		return decoded
	}

	committedFile := func(t *testing.T, path string) map[string]any {
		t.Helper()
		data, err := os.ReadFile(filepath.Join(helper.ProvisioningPath, path)) //nolint:gosec // a path the test itself wrote into the provisioning directory
		require.NoError(t, err, "the committed file should be readable")
		var file map[string]any
		require.NoError(t, json.Unmarshal(data, &file), "the committed file should be valid JSON")
		return file
	}

	liveDashboard := func(t *testing.T, name string) *unstructured.Unstructured {
		t.Helper()
		live, err := helper.DashboardsV1.Resource.Get(t.Context(), name, metav1.GetOptions{})
		require.NoError(t, err, "the dashboard should exist in Grafana")
		return live
	}

	// frontendBody is what the dashboard UI sends when it saves a provisioned
	// dashboard: the live object's full metadata (meta.k8s) and its spec.
	frontendBody := func(t *testing.T, live *unstructured.Unstructured) map[string]any {
		t.Helper()
		obj := live.DeepCopy().Object
		return map[string]any{
			"apiVersion": obj["apiVersion"],
			"kind":       obj["kind"],
			"metadata":   obj["metadata"],
			"spec":       obj["spec"],
		}
	}

	bodyAnnotations := func(t *testing.T, body map[string]any) map[string]any {
		t.Helper()
		annotations, found, err := unstructured.NestedMap(body, "metadata", "annotations")
		require.NoError(t, err)
		require.True(t, found, "the body should carry annotations")
		return annotations
	}

	writeFile := func(t *testing.T, verb, path string, body map[string]any) {
		t.Helper()
		data, err := json.Marshal(body)
		require.NoError(t, err, "should marshal the dashboard body")
		req := helper.AdminREST.Put()
		if verb == "POST" {
			req = helper.AdminREST.Post()
		}
		result := req.
			Namespace("default").
			Resource("repositories").
			Name(repo).
			SubResource(append([]string{"files"}, strings.Split(path, "/")...)...).
			Body(data).
			SetHeader("Content-Type", "application/json").
			Do(t.Context())
		require.NoError(t, result.Error(), "%s of %s should succeed", verb, path)
	}

	committed, err := json.MarshalIndent(map[string]any{
		"apiVersion": "dashboard.grafana.app/v1",
		"kind":       "Dashboard",
		"metadata": map[string]any{
			"name":   name,
			"labels": map[string]any{"team": "platform"},
			"annotations": map[string]any{
				ownerKey:     "team-a",
				crossVarsKey: crossVarsAll,
			},
		},
		"spec": originalSpec,
	}, "", "  ")
	require.NoError(t, err)
	helper.WriteToProvisioningPath(t, path, committed)
	helper.SyncAndWait(t, repo, nil)

	t.Run("a frontend save keeps the user annotations and nothing Grafana derives", func(t *testing.T) {
		live := liveDashboard(t, name)
		annotations := live.GetAnnotations()
		require.Equal(t, "team-a", annotations[ownerKey], "sync should load the user annotation")
		require.Equal(t, crossVarsAll, annotations[crossVarsKey], "sync should load the cross-dashboard variables")
		require.Equal(t, "platform", live.GetLabels()["team"], "sync should load the label")

		body := frontendBody(t, live)
		// Guard the premise: the body really carries the Grafana-owned and server
		// fields that must not reach the file.
		sent := bodyAnnotations(t, body)
		require.Equal(t, string(utils.ManagerKindRepo), sent[utils.AnnoKeyManagerKind])
		require.Equal(t, repo, sent[utils.AnnoKeyManagerIdentity])
		require.Equal(t, path, sent[utils.AnnoKeySourcePath])
		for _, key := range []string{utils.AnnoKeySourceChecksum, utils.AnnoKeyFolder, utils.AnnoKeyCreatedBy} {
			require.NotEmpty(t, sent[key], "the body should carry %s", key)
		}
		// The dashboard has not been updated since sync created it; a frontend that
		// saved it before would send these as well.
		sent[utils.AnnoKeyUpdatedBy] = "user:frontend"
		sent[utils.AnnoKeyUpdatedTimestamp] = "2026-01-01T00:00:00Z"
		require.NoError(t, unstructured.SetNestedMap(body, sent, "metadata", "annotations"))
		meta := body["metadata"].(map[string]any)
		for _, key := range []string{"namespace", "uid", "resourceVersion", "generation", "creationTimestamp", "labels"} {
			require.NotEmpty(t, meta[key], "the body should carry metadata.%s", key)
		}

		require.NoError(t, unstructured.SetNestedField(body, renamedTitle, "spec", "title"))
		writeFile(t, "PUT", path, body)

		file := committedFile(t, path)
		require.Equal(t, map[string]any{
			"name": name,
			"annotations": map[string]any{
				ownerKey:     "team-a",
				crossVarsKey: crossVarsAll,
			},
		}, file["metadata"], "only the name and the user annotations should be written")
		// The dashboard API fills in defaults (templating, timepicker, ...) on the
		// live spec, so the body echoes those back: the spec is written as sent.
		require.Equal(t, asDecodedJSON(t, body["spec"]), file["spec"], "the spec should be written as sent")
		fileSpec := file["spec"].(map[string]any)
		for key, value := range asDecodedJSON(t, originalSpec) {
			if key == "title" {
				require.Equal(t, renamedTitle, fileSpec[key])
				continue
			}
			require.Equal(t, value, fileSpec[key], "the authored spec.%s should be unchanged", key)
		}
		require.Len(t, file, 4, "the file should hold apiVersion, kind, metadata and spec only, got %v", file)
		require.Equal(t, "dashboard.grafana.app/v1", file["apiVersion"])
		require.Equal(t, "Dashboard", file["kind"])
	})

	t.Run("an annotation-only change is written and applied", func(t *testing.T) {
		specBefore := committedFile(t, path)["spec"]
		body := frontendBody(t, liveDashboard(t, name))
		sent := bodyAnnotations(t, body)
		sent[crossVarsKey] = crossVarsPicked
		require.NoError(t, unstructured.SetNestedMap(body, sent, "metadata", "annotations"))
		writeFile(t, "PUT", path, body)

		file := committedFile(t, path)
		require.Equal(t, map[string]any{
			"name": name,
			"annotations": map[string]any{
				ownerKey:     "team-a",
				crossVarsKey: crossVarsPicked,
			},
		}, file["metadata"])
		require.Equal(t, specBefore, file["spec"], "the spec should be unchanged")

		annotations := liveDashboard(t, name).GetAnnotations()
		require.Equal(t, crossVarsPicked, annotations[crossVarsKey], "the write should apply the new selection")
		require.Equal(t, "team-a", annotations[ownerKey])
		require.Equal(t, repo, annotations[utils.AnnoKeyManagerIdentity], "the dashboard should still be managed by the repository")

		// Reading the file back must yield the same selection.
		helper.SyncAndWait(t, repo, nil)
		require.Equal(t, crossVarsPicked, liveDashboard(t, name).GetAnnotations()[crossVarsKey],
			"a sync from the file should keep the selection")
	})

	t.Run("removing the annotation removes it from the file and the dashboard", func(t *testing.T) {
		body := frontendBody(t, liveDashboard(t, name))
		sent := bodyAnnotations(t, body)
		require.Contains(t, sent, crossVarsKey, "the premise: the dashboard carries the selection before the removal")
		delete(sent, crossVarsKey)
		require.NoError(t, unstructured.SetNestedMap(body, sent, "metadata", "annotations"))
		writeFile(t, "PUT", path, body)

		require.Equal(t, map[string]any{
			"name":        name,
			"annotations": map[string]any{ownerKey: "team-a"},
		}, committedFile(t, path)["metadata"])

		annotations := liveDashboard(t, name).GetAnnotations()
		require.NotContains(t, annotations, crossVarsKey, "the dashboard should no longer carry the selection")
		require.Equal(t, "team-a", annotations[ownerKey])
	})

	t.Run("server-owned keys in a request body never reach the file", func(t *testing.T) {
		const (
			createdName = "server-owned-dash"
			createdPath = "server-owned.json"
			plantedUID  = "11111111-2222-3333-4444-555555555555"
		)
		writeFile(t, "POST", createdPath, map[string]any{
			"apiVersion": "dashboard.grafana.app/v1",
			"kind":       "Dashboard",
			"metadata": map[string]any{
				"name":            createdName,
				"namespace":       "default",
				"uid":             plantedUID,
				"resourceVersion": "12345",
				"annotations": map[string]any{
					utils.AnnoKeyCreatedBy:                "user:evil",
					utils.AnnoKeyManagerKind:              "plugin",
					utils.AnnoKeyManagerIdentity:          "other",
					utils.AnnoKeySourcePath:               "elsewhere.json",
					utils.AnnoKeyFolder:                   "bogus",
					"grafana.app/folderTitle":             "x",
					"grafana.app/saved-from-ui":           "x",
					"grafana.com/updatedBy":               "x",
					utils.AnnoKeyKubectlLastAppliedConfig: "{}",
					ownerKey:                              "me",
				},
			},
			"spec": map[string]any{
				"title":         "Server-owned keys",
				"schemaVersion": 42,
				"panels":        []any{},
			},
			"status": map[string]any{
				"conversion": map[string]any{"failed": false, "storedVersion": "v1"},
			},
		})

		file := committedFile(t, createdPath)
		require.Equal(t, map[string]any{
			"name":        createdName,
			"annotations": map[string]any{ownerKey: "me"},
		}, file["metadata"], "only the name and the user annotation should be written")
		require.NotContains(t, file, "status", "status should not be written")

		live := liveDashboard(t, createdName)
		annotations := live.GetAnnotations()
		require.Equal(t, repo, annotations[utils.AnnoKeyManagerIdentity])
		require.Equal(t, string(utils.ManagerKindRepo), annotations[utils.AnnoKeyManagerKind])
		require.Equal(t, createdPath, annotations[utils.AnnoKeySourcePath])
		require.NotEqual(t, "user:evil", annotations[utils.AnnoKeyCreatedBy])
		require.NotEqual(t, "bogus", annotations[utils.AnnoKeyFolder])
		require.Equal(t, "me", annotations[ownerKey])
		for _, key := range []string{"grafana.app/folderTitle", "grafana.app/saved-from-ui", "grafana.com/updatedBy", utils.AnnoKeyKubectlLastAppliedConfig} {
			require.NotContains(t, annotations, key, "the dashboard should not carry %s from the request body", key)
		}
		require.NotEqual(t, plantedUID, string(live.GetUID()), "the request body should not choose the uid")
	})
}
