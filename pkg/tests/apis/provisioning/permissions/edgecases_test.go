package permissions

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
	pt "github.com/grafana/grafana/pkg/tests/apis/provisioning/permissions/testutil"
)

// Mixed authorized and restricted targets must be rejected before any work is queued.
// Missing resource references instead reach the worker and produce a warning or error.
func TestIntegrationProvisioning_NoneMixedAndMissingJobTargets(t *testing.T) {
	for _, action := range []string{"delete", "move"} {
		t.Run(action, func(t *testing.T) {
			h := sharedHelper(t)
			allowed, restricted, target := pt.Name(), pt.Name(), pt.Name()
			uid, privateUID := pt.Name(), pt.Name()
			pt.Write(t, h, "allowed/_folder.json", pt.Folder(allowed, "Allowed"))
			pt.Write(t, h, "restricted/_folder.json", pt.Folder(restricted, "Restricted"))
			pt.Write(t, h, "target/_folder.json", pt.Folder(target, "Target"))
			pt.Write(t, h, "allowed/dashboard.json", pt.Dashboard(uid, "Allowed dashboard"))
			pt.Write(t, h, "restricted/dashboard.json", pt.Dashboard(privateUID, "Restricted dashboard"))
			repo := pt.LocalRepo(t, h, "folder")
			verb := "dashboards:delete"
			if action == "move" {
				verb = "dashboards:write"
			}
			grants := pt.Actions("provisioning.jobs:create", "dashboards:read")
			grants = append(grants, pt.Grant("folders", allowed, verb), pt.Grant("folders", target, "dashboards:create"))
			u := pt.None(t, h, grants...)
			for _, version := range pt.Versions {
				for _, kind := range []string{"path", "resource"} {
					t.Run(version+"/mixed/"+kind, func(t *testing.T) {
						opts := map[string]any{}
						if action == "move" {
							opts["targetPath"] = "target/"
						}
						if kind == "path" {
							opts["paths"] = []string{"allowed/dashboard.json", "restricted/dashboard.json"}
						} else {
							opts["resources"] = []any{map[string]any{"name": uid, "kind": "Dashboard", "group": "dashboard.grafana.app"}, map[string]any{"name": privateUID, "kind": "Dashboard", "group": "dashboard.grafana.app"}}
						}
						before := pt.JobCount(t, h)
						rsp := pt.Do(t, u, "POST", version, "repositories/"+repo+"/jobs", map[string]any{"action": action, action: opts}).Require(t, 500)
						require.Contains(t, string(rsp.Body), "permission denied")
						require.Equal(t, before, pt.JobCount(t, h))
						for _, path := range []string{"allowed/dashboard.json", "restricted/dashboard.json"} {
							_, err := os.Stat(filepath.Join(h.ProvisioningPath, path))
							require.NoError(t, err)
						}
						_, err := os.Stat(filepath.Join(h.ProvisioningPath, "target/dashboard.json"))
						require.True(t, os.IsNotExist(err))
						for _, id := range []string{uid, privateUID} {
							_, err := h.DashboardsV0.Resource.Get(t.Context(), id, metav1.GetOptions{})
							require.NoError(t, err)
						}
					})
				}
				t.Run(version+"/missing-reference", func(t *testing.T) {
					opts := map[string]any{"resources": []any{map[string]any{"name": pt.Name(), "kind": "Dashboard", "group": "dashboard.grafana.app"}}}
					if action == "move" {
						opts["targetPath"] = "target/"
					}
					rsp := pt.Do(t, u, "POST", version, "repositories/"+repo+"/jobs", map[string]any{"action": action, action: opts}).Require(t, 202)
					finished := h.AwaitJob(t, &unstructured.Unstructured{Object: rsp.Object(t)})
					state := "error"
					if action == "delete" {
						state = "warning"
					}
					require.Equal(t, state, common.MustNestedString(finished.Object, "status", "state"), string(pt.JSON(t, finished.Object)))
					require.Contains(t, string(pt.JSON(t, finished.Object)), "not found")
					_, err := h.DashboardsV0.Resource.Get(t.Context(), privateUID, metav1.GetOptions{})
					require.NoError(t, err)
				})
			}
		})
	}
}

// Resource grants do not authorize taking ownership from another repository.
// A rejected takeover must preserve both the existing owner and repository contents.
func TestIntegrationProvisioning_NoneOwnershipBoundary(t *testing.T) {
	h := sharedHelper(t)
	uid := pt.Name()
	pt.Write(t, h, "dashboard.json", pt.Dashboard(uid, "Owned"))
	owner := pt.LocalRepo(t, h, "folder")
	other := pt.Name()
	otherPath := filepath.Join(h.ProvisioningPath, other)
	require.NoError(t, os.MkdirAll(otherPath, 0750))
	obj := pt.Repository(other, otherPath, "v0alpha1")
	pt.Do(t, h.Org1.Admin, "POST", "v0alpha1", "repositories", obj).Require(t, 201)
	h.WaitForHealthyRepository(t, other)
	u := pt.None(t, h, pt.Actions("dashboards:create", "dashboards:write", "dashboards:delete", "folders:create", "folders:write")...)
	for _, version := range pt.Versions {
		pt.Do(t, u, "POST", version, "repositories/"+other+"/files/dashboard.json", pt.Dashboard(uid, "Takeover")).Require(t, 400)
		_, err := os.Stat(filepath.Join(otherPath, "dashboard.json"))
		require.True(t, os.IsNotExist(err))
		stored, err := h.DashboardsV0.Resource.Get(t.Context(), uid, metav1.GetOptions{})
		require.NoError(t, err)
		require.Equal(t, owner, stored.GetAnnotations()["grafana.app/managerId"])
	}
}

// Metadata repair remains subject to repository workflows even with job, repository,
// and folder grants; rejection must create neither a job nor folder metadata.
func TestIntegrationProvisioning_NoneFixMetadataWorkflow(t *testing.T) {
	h := sharedHelper(t)
	repo := pt.LocalRepo(t, h, "folder")
	pt.Write(t, h, "legacy/.keep", []byte{})
	pt.Do(t, h.Org1.Admin, "PATCH", "v0alpha1", "repositories/"+repo, map[string]any{"spec": map[string]any{"workflows": []string{}}}).Require(t, 200)
	h.WaitForHealthyRepository(t, repo)
	u := pt.None(t, h, pt.Actions("provisioning.jobs:create", "provisioning.repositories:write", "folders:create", "folders:write")...)
	for _, version := range pt.Versions {
		before := pt.JobCount(t, h)
		pt.Do(t, u, "POST", version, "repositories/"+repo+"/jobs", map[string]any{"action": "fixFolderMetadata"}).Require(t, 403)
		require.Equal(t, before, pt.JobCount(t, h))
		_, err := os.Stat(filepath.Join(h.ProvisioningPath, "legacy/_folder.json"))
		require.True(t, os.IsNotExist(err))
	}
}

// Explicit folder creation checks the parent, while metadata updates check the folder.
// A sibling scope or unrelated action must not authorize either mutation.
func TestIntegrationProvisioning_NoneFolderPermissionScopes(t *testing.T) {
	h := sharedHelper(t)
	parent, sibling := pt.Name(), pt.Name()
	pt.Write(t, h, "parent/_folder.json", pt.Folder(parent, "Parent"))
	pt.Write(t, h, "sibling/_folder.json", pt.Folder(sibling, "Sibling"))
	repo := pt.LocalRepo(t, h, "folder")
	for _, version := range pt.Versions {
		for _, operation := range []string{"root-create", "nested-create", "metadata-update"} {
			for _, grant := range []string{"none", "unrelated", "sibling", "required"} {
				t.Run(version+"/"+operation+"/"+grant, func(t *testing.T) {
					scope := parent
					action := "folders:create"
					method := "POST"
					path := "parent/" + pt.Name() + "/"
					var body any
					if operation == "root-create" {
						scope = repo
						path = pt.Name() + "/"
					}
					if operation == "metadata-update" {
						action = "folders:write"
						method = "PUT"
						path = "parent/"
						body = pt.Folder(parent, pt.Name())
					}
					var grants = pt.Actions()
					switch grant {
					case "required":
						grants = append(grants, pt.Grant("folders", scope, action))
					case "sibling":
						grants = append(grants, pt.Grant("folders", sibling, action))
					case "unrelated":
						grants = pt.Actions("dashboards:create")
					}
					u := pt.None(t, h, grants...)
					before, err := os.ReadFile(filepath.Join(h.ProvisioningPath, "parent/_folder.json"))
					require.NoError(t, err)
					rsp := pt.Do(t, u, method, version, "repositories/"+repo+"/files/"+path, body)
					if grant != "required" {
						rsp.Require(t, 403)
						after, err := os.ReadFile(filepath.Join(h.ProvisioningPath, "parent/_folder.json"))
						require.NoError(t, err)
						require.Equal(t, before, after)
						if method == "POST" {
							_, err = os.Stat(filepath.Join(h.ProvisioningPath, path))
							require.True(t, os.IsNotExist(err))
						}
						return
					}
					rsp.Require(t, 200)
					metadata, err := os.ReadFile(filepath.Join(h.ProvisioningPath, path, "_folder.json"))
					require.NoError(t, err)
					id := pt.Response{Body: metadata}.Object(t)["metadata"].(map[string]any)["name"].(string)
					_, err = h.Folders.Resource.Get(t.Context(), id, metav1.GetOptions{})
					require.NoError(t, err)
				})
			}
		}
	}
}
