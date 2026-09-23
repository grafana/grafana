package permissions

import (
	"os"
	"path/filepath"
	"testing"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	pt "github.com/grafana/grafana/pkg/tests/apis/provisioning/permissions/testutil"
)

// Export requires jobs:create and reads for every supported resource kind, even for
// selective exports. Successful workers need no resource create or delete grants.
func TestIntegrationProvisioning_NonePushJob(t *testing.T) {
	h := sharedHelper(t)
	repo := pt.LocalRepo(t, h, "folder")
	uid := pt.Name()
	pt.Request(t, h.Org1.Admin, "POST", "/apis/dashboard.grafana.app/v0alpha1/namespaces/default/dashboards", pt.Dashboard(uid, "Exported dashboard")).Require(t, 201)
	for _, version := range pt.Versions {
		for _, selective := range []bool{false, true} {
			for _, grant := range []string{"none", "resources", "jobs", "dashboardRead", "folderRead", "allRead"} {
				name := grant + "/full"
				if selective {
					name = grant + "/selective"
				}
				t.Run(version+"/"+name, func(t *testing.T) {
					var actions []string
					if grant != "none" && grant != "resources" {
						actions = append(actions, "provisioning.jobs:create")
					}
					if grant == "dashboardRead" || grant == "allRead" || grant == "resources" {
						actions = append(actions, "dashboards:read")
					}
					if grant == "folderRead" || grant == "allRead" || grant == "resources" {
						actions = append(actions, "folders:read")
					}
					u := pt.None(t, h, pt.Actions(actions...)...)
					opts := map[string]any{}
					if selective {
						opts["resources"] = []any{map[string]any{"name": uid, "kind": "Dashboard", "group": "dashboard.grafana.app"}}
					}
					before := pt.JobCount(t, h)
					rsp := pt.Do(t, u, "POST", version, "repositories/"+repo+"/jobs", map[string]any{"action": "push", "push": opts})
					if grant != "allRead" {
						rsp.Require(t, 403)
						require.Equal(t, before, pt.JobCount(t, h))
						return
					}
					pt.AwaitSuccess(t, h, rsp)
					data, err := os.ReadFile(filepath.Join(h.ProvisioningPath, "exported-dashboard.json"))
					require.NoError(t, err)
					require.Contains(t, string(data), "Exported dashboard")
				})
			}
		}
	}
}

// Direct migration requires read/create grants, but its delete check depends on the
// target and skip-deletion option. Removing each grant distinguishes those cases
// and verifies that only accepted migrations establish repository ownership.
func TestIntegrationProvisioning_NoneMigrateJob(t *testing.T) {
	for _, target := range []string{"folder", "folderless", "instance"} {
		for _, skip := range []bool{false, true} {
			name := target + "/delete"
			if skip {
				name = target + "/keep"
			}
			t.Run(name, func(t *testing.T) {
				h := sharedHelper(t)
				repo := pt.LocalRepo(t, h, target)
				for _, missing := range []string{"jobs", "dashboards:read", "folders:read", "dashboards:create", "folders:create", "delete", "none"} {
					t.Run(missing, func(t *testing.T) {
						uid := pt.Name()
						pt.Request(t, h.Org1.Admin, "POST", "/apis/dashboard.grafana.app/v0alpha1/namespaces/default/dashboards", pt.Dashboard(uid, "Migrated dashboard "+uid)).Require(t, 201)
						actions := []string{"provisioning.jobs:create", "dashboards:read", "folders:read", "dashboards:create", "folders:create"}
						if missing != "delete" {
							actions = append(actions, "dashboards:delete", "folders:delete")
						}
						filtered := []string{}
						for _, action := range actions {
							if action != missing && !(missing == "jobs" && action == "provisioning.jobs:create") {
								filtered = append(filtered, action)
							}
						}
						u := pt.None(t, h, pt.Actions(filtered...)...)
						before := pt.JobCount(t, h)
						rsp := pt.Do(t, u, "POST", "v0alpha1", "repositories/"+repo+"/jobs", map[string]any{"action": "migrate", "migrate": map[string]any{"skipResourceDeletion": skip}})
						allowed := missing == "none" || (missing == "delete" && (skip || target != "instance"))
						if !allowed {
							rsp.Require(t, 403)
							require.Equal(t, before, pt.JobCount(t, h))
							stored, err := h.DashboardsV0.Resource.Get(t.Context(), uid, metav1.GetOptions{})
							require.NoError(t, err)
							require.Empty(t, stored.GetAnnotations()["grafana.app/managerId"])
							return
						}
						pt.AwaitSuccess(t, h, rsp)
						obj, err := h.DashboardsV0.Resource.Get(t.Context(), uid, metav1.GetOptions{})
						require.NoError(t, err)
						require.Equal(t, repo, obj.GetAnnotations()["grafana.app/managerId"])
					})
				}
			})
		}
	}
}

// Path moves require source-write and destination-create grants. Resource-reference
// deletes also need read access for lookup. Inspect worker results and ensure denied
// submissions never queue work.
func TestIntegrationProvisioning_NoneDeleteAndMoveJobs(t *testing.T) {
	for _, action := range []string{"delete", "move"} {
		for _, kind := range []string{"path", "resource", "directory"} {
			if action == "move" && kind == "resource" {
				continue
			}
			t.Run(action+"/"+kind, func(t *testing.T) {
				h := sharedHelper(t)
				folder := pt.Name()
				uid := pt.Name()
				pt.Write(t, h, "source/_folder.json", pt.Folder(folder, "Source"))
				pt.Write(t, h, "source/dashboard.json", pt.Dashboard(uid, "Dashboard"))
				pt.Write(t, h, "target/_folder.json", pt.Folder(pt.Name(), "Target"))
				repo := pt.LocalRepo(t, h, "folder")
				for _, grant := range []string{"none", "resources", "jobs", "source", "all"} {
					t.Run(grant, func(t *testing.T) {
						actions := []string{}
						if grant != "none" && grant != "resources" {
							actions = append(actions, "provisioning.jobs:create")
						}
						resource := "dashboards"
						if kind == "directory" {
							resource = "folders"
						}
						if kind == "resource" && (grant == "source" || grant == "all" || grant == "resources") {
							actions = append(actions, "dashboards:read")
						}
						if grant == "source" || grant == "all" || grant == "resources" {
							verb := "write"
							if action == "delete" {
								verb = "delete"
							}
							actions = append(actions, resource+":"+verb)
						}
						if grant == "all" || grant == "resources" {
							actions = append(actions, resource+":create")
						}
						u := pt.None(t, h, pt.Actions(actions...)...)
						opts := map[string]any{}
						switch kind {
						case "path":
							opts["paths"] = []string{"source/dashboard.json"}
						case "directory":
							opts["paths"] = []string{"source/"}
						case "resource":
							opts["resources"] = []any{map[string]any{"name": uid, "kind": "Dashboard", "group": "dashboard.grafana.app"}}
						}
						if action == "move" {
							opts["targetPath"] = "target/"
						}
						allowed := grant == "all" || (grant == "source" && action == "delete")
						before := pt.JobCount(t, h)
						rsp := pt.Do(t, u, "POST", "v0alpha1", "repositories/"+repo+"/jobs", map[string]any{"action": action, action: opts})
						if !allowed {
							if grant == "jobs" || grant == "source" {
								rsp.Require(t, 500)
								require.Contains(t, string(rsp.Body), "authorize ")
							} else {
								rsp.Require(t, 403)
							}
							require.Equal(t, before, pt.JobCount(t, h))
							_, err := os.Stat(filepath.Join(h.ProvisioningPath, "source/dashboard.json"))
							require.NoError(t, err)
							return
						}
						pt.AwaitSuccess(t, h, rsp)
						if action == "delete" {
							_, err := h.DashboardsV0.Resource.Get(t.Context(), uid, metav1.GetOptions{})
							require.True(t, apierrors.IsNotFound(err))
						} else {
							_, err := os.Stat(filepath.Join(h.ProvisioningPath, "target/dashboard.json"))
							if kind == "directory" {
								_, err = os.Stat(filepath.Join(h.ProvisioningPath, "target/source/dashboard.json"))
							}
							require.NoError(t, err)
						}
						// Restore the source so both minimal and comprehensive grants exercise real resources.
						pt.Write(t, h, "source/_folder.json", pt.Folder(folder, "Source"))
						pt.Write(t, h, "source/dashboard.json", pt.Dashboard(uid, "Dashboard"))
						if action == "move" {
							require.NoError(t, os.RemoveAll(filepath.Join(h.ProvisioningPath, "target")))
							pt.Write(t, h, "target/_folder.json", pt.Folder(pt.Name(), "Target"))
						}
						h.SyncAndWait(t, repo, nil)
					})
				}
			})
		}
	}
}

// The same completed job uses jobs:read through a repository and historicjobs:read
// through top-level history. Neither read grant should unlock the other endpoint.
func TestIntegrationProvisioning_NoneJobHistory(t *testing.T) {
	h := sharedHelper(t)
	repo := pt.LocalRepo(t, h, "folder")
	job := h.TriggerJobAndWaitForComplete(t, repo, provisioning.JobSpec{Action: provisioning.JobActionPull, Pull: &provisioning.SyncJobOptions{}})
	uid := job.GetLabels()["provisioning.grafana.app/original-uid"]
	require.NotEmpty(t, uid)
	name := job.GetName()
	for _, version := range pt.Versions {
		for _, grant := range []string{"none", "jobs", "historicjobs"} {
			t.Run(version+"/"+grant, func(t *testing.T) {
				var actions []string
				if grant != "none" {
					actions = []string{"provisioning." + grant + ":read"}
				}
				u := pt.None(t, h, pt.Actions(actions...)...)
				for _, endpoint := range []string{"repositories/" + repo + "/jobs", "repositories/" + repo + "/jobs/" + uid, "historicjobs", "historicjobs/" + name} {
					rsp := pt.Do(t, u, "GET", version, endpoint, nil)
					allowed := (grant == "jobs" && endpoint[0] == 'r') || (grant == "historicjobs" && endpoint[0] == 'h')
					if allowed {
						rsp.Require(t, 200)
						require.Contains(t, string(rsp.Body), repo)
					} else {
						rsp.Require(t, 403)
					}
				}
			})
		}
	}
}
