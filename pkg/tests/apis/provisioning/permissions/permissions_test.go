package permissions

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/types"

	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

// Each operation is checked with no grants, insufficient grants, and its required
// grants on the same None user. Administrators only prepare and clean up fixtures.
func TestIntegrationProvisioning_NoneRBAC(t *testing.T) {
	h := common.SharedHelper(t, env)
	u := h.CreateUser("none-permissions", apis.Org1, org.RoleNone, nil)
	grantSets := map[string][]string{
		"none":              nil,
		"repository-read":   {"provisioning.repositories:read"},
		"repository-create": {"provisioning.repositories:create"},
		"repository-write":  {"provisioning.repositories:write"},
		"repository-delete": {"provisioning.repositories:delete"},
		"connection-read":   {"provisioning.connections:read"},
		"connection-create": {"provisioning.connections:create"},
		"connection-write":  {"provisioning.connections:write"},
		"connection-delete": {"provisioning.connections:delete"},
		"settings-read":     {"provisioning.settings:read"},
		"stats-read":        {"provisioning.stats:read"},
		"job-read":          {"provisioning.jobs:read"},
		"job-create":        {"provisioning.jobs:create"},
		"job-delete":        {"provisioning.jobs:delete"},
		"history-read":      {"provisioning.historicjobs:read"},
		"dashboard-read":    {"dashboards:read"},
		"dashboard-create":  {"dashboards:create"},
		"dashboard-write":   {"dashboards:write"},
		"dashboard-delete":  {"dashboards:delete"},
		"folder-read":       {"folders:read"},
		"folder-create":     {"folders:create"},
		"pull":              {"provisioning.jobs:create", "provisioning.repositories:write"},
		"push":              {"provisioning.jobs:create", "dashboards:read", "folders:read"},
		"migrate":           {"provisioning.jobs:create", "dashboards:read", "folders:read", "dashboards:create", "folders:create"},
	}
	repo := "none-repository"
	repoPath := "repositories/" + repo
	filesPath := repoPath + "/files/"
	repoClient := common.GetRepositoryClientV1Beta1(h.K8sTestHelper)
	gv := repoClient.Args.GVR.GroupVersion()
	adminREST := h.Org1.Admin.RESTClient(t, &gv)
	h.CreateRepositoryNoWait(t, common.TestRepo{
		Name: repo, SyncTarget: "folderless", Workflows: []string{"write"},
	})
	_, err := repoClient.Resource.Patch(t.Context(), repo, types.MergePatchType,
		[]byte(`{"status":{"health":{"healthy":true},"sync":{"state":"success","started":0}}}`), metav1.PatchOptions{}, "status")
	require.NoError(t, err)
	_, err = common.GetConnectionClientV1Beta1(h.K8sTestHelper).Resource.Create(t.Context(),
		&unstructured.Unstructured{Object: connection("none-connection")}, metav1.CreateOptions{})
	require.NoError(t, err)
	err = adminREST.Post().
		Namespace(repoClient.Args.Namespace).
		Resource("repositories").
		Name(repo).
		SubResource("files", "existing.json").
		Body(common.AsJSON(dashboard("none-existing-dashboard"))).
		SetHeader("Content-Type", "application/json").
		Do(t.Context()).Error()
	require.NoError(t, err)
	require.NoError(t, os.WriteFile(filepath.Join(h.ProvisioningPath, "README.md"), []byte("Permission fixture"), 0600))
	var job unstructured.Unstructured
	err = adminREST.Post().
		Namespace(repoClient.Args.Namespace).
		Resource("repositories").
		Name(repo).
		SubResource("jobs").
		Body(common.AsJSON(map[string]any{"action": "pull", "pull": map[string]any{}})).
		SetHeader("Content-Type", "application/json").
		Do(t.Context()).Into(&job)
	require.NoError(t, err)
	require.NotEmpty(t, job.GetName())
	jobPath := "jobs/" + job.GetName()

	cases := []struct {
		name, method, path                 string
		body                               any
		requiredGrants, insufficientGrants string
		status                             int
	}{
		{"read repository", "GET", repoPath, nil, "repository-read", "repository-write", 200},
		{"list repositories", "GET", "repositories", nil, "repository-read", "repository-create", 200},
		{"create repository", "POST", "repositories", repository(t, h, "none-created-repository", filepath.Join(h.ProvisioningPath, "created")), "repository-create", "repository-write", 201},
		{"update repository", "PATCH", repoPath, map[string]any{"spec": map[string]any{"title": "Updated"}}, "repository-write", "repository-read", 200},
		{"inspect resources", "GET", repoPath + "/resources", nil, "repository-write", "repository-read", 200},
		{"read repository status", "GET", repoPath + "/status", nil, "repository-write", "repository-read", 200},
		{"update repository status", "PATCH", repoPath + "/status", map[string]any{"status": map[string]any{"observedGeneration": 1}}, "repository-write", "repository-read", 200},
		{"test repository", "POST", repoPath + "/test", repository(t, h, repo, h.ProvisioningPath), "repository-write", "repository-read", 200},
		{"read connection", "GET", "connections/none-connection", nil, "connection-read", "connection-write", 200},
		{"list connections", "GET", "connections", nil, "connection-read", "connection-create", 200},
		{"create connection", "POST", "connections", connection("none-created-connection"), "connection-create", "connection-write", 201},
		{"update connection", "PATCH", "connections/none-connection", map[string]any{"spec": map[string]any{"title": "Updated"}}, "connection-write", "connection-read", 200},
		{"read connection status", "GET", "connections/none-connection/status", nil, "connection-read", "connection-write", 200},
		{"read settings", "GET", "settings", nil, "settings-read", "stats-read", 200},
		{"read stats", "GET", "stats", nil, "stats-read", "settings-read", 200},
		{"read job", "GET", jobPath, nil, "job-read", "history-read", 200},
		{"list jobs", "GET", "jobs", nil, "job-read", "history-read", 200},
		{"read repository jobs", "GET", repoPath + "/jobs", nil, "job-read", "history-read", 200},
		{"read job history", "GET", "historicjobs", nil, "history-read", "job-read", 200},
		{"delete job", "DELETE", jobPath, nil, "job-delete", "job-read", 200},
		{"list files", "GET", filesPath, nil, "repository-read", "dashboard-read", 200},
		{"read dashboard", "GET", filesPath + "existing.json", nil, "dashboard-read", "repository-read", 200},
		{"read raw file", "GET", filesPath + "README.md", nil, "folder-read", "repository-read", 200},
		{"create dashboard", "POST", filesPath + "created.json", dashboard("none-created-dashboard"), "dashboard-create", "repository-write", 200},
		{"update dashboard", "PUT", filesPath + "existing.json", dashboard("none-existing-dashboard"), "dashboard-write", "dashboard-create", 200},
		{"create folder", "POST", filesPath + "created-folder/", nil, "folder-create", "dashboard-create", 200},
		{"submit pull", "POST", repoPath + "/jobs", map[string]any{"action": "pull", "pull": map[string]any{}}, "pull", "repository-write", 202},
		{"submit push", "POST", repoPath + "/jobs", map[string]any{"action": "push", "push": map[string]any{}}, "push", "job-create", 202},
		{"submit migration", "POST", repoPath + "/jobs", map[string]any{"action": "migrate", "migrate": map[string]any{}}, "migrate", "job-create", 202},
		{"release resources", "POST", "repositories/none-missing/jobs", map[string]any{"action": "releaseResources"}, "pull", "repository-write", 202},
		{"delete resources", "POST", "repositories/none-missing/jobs", map[string]any{"action": "deleteResources"}, "pull", "repository-write", 202},
		{"delete dashboard", "DELETE", filesPath + "existing.json", nil, "dashboard-delete", "dashboard-write", 200},
		{"delete connection", "DELETE", "connections/none-connection", nil, "connection-delete", "connection-write", 200},
		{"delete repository", "DELETE", "repositories/none-created-repository", nil, "repository-delete", "repository-write", 200},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			for _, expected := range []struct {
				grants string
				status int
			}{
				{"none", 403},
				{tc.insufficientGrants, 403},
				{tc.requiredGrants, tc.status},
			} {
				t.Run(expected.grants, func(t *testing.T) {
					setPermissions(t, h, u, grantSets[expected.grants])
					response := request(t, u, tc.method, tc.path, tc.body, expected.status)
					if expected.status == 202 {
						var job struct {
							Metadata struct{ Name string }
						}
						require.NoError(t, json.Unmarshal(response, &job))
						request(t, h.Org1.Admin, "DELETE", "jobs/"+job.Metadata.Name, nil, 200)
					}
				})
			}
		})
	}

	// Having jobs:create alone must not authorize administrative submissions.
	userREST := u.RESTClient(t, &gv)
	for _, action := range []string{"pull", "releaseResources", "deleteResources"} {
		t.Run(action+" without repository write", func(t *testing.T) {
			target := "none-missing"
			body := map[string]any{"action": action}
			if action == "pull" {
				target = repo
				body["pull"] = map[string]any{}
			}
			setPermissions(t, h, u, grantSets["job-create"])
			var statusCode int
			result := userREST.Post().
				Namespace(repoClient.Args.Namespace).
				Resource("repositories").
				Name(target).
				SubResource("jobs").
				Body(common.AsJSON(body)).
				SetHeader("Content-Type", "application/json").
				Do(t.Context()).StatusCode(&statusCode)
			require.Error(t, result.Error())
			require.Equal(t, 403, statusCode)
		})
	}
}
