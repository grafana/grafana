package git

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	pt "github.com/grafana/grafana/pkg/tests/apis/provisioning/permissions/testutil"
)

// Branch migration has different deletion requirements for full, selective, and
// skip-deletion requests. Verify exported branch bytes and Grafana resource removal
// or preservation, rather than treating accepted submission as successful migration.
func TestIntegrationProvisioning_NoneBranchMigrateJob(t *testing.T) {
	for _, target := range []string{"folder", "folderless", "instance"} {
		for _, selection := range []string{"full", "selective", "skip"} {
			if target == "instance" && selection == "selective" {
				continue
			}
			t.Run(target+"/"+selection, func(t *testing.T) {
				h := sharedHelper(t)
				repo := pt.Name()
				_, local := h.CreateFolderTargetGitRepo(t, repo, nil, "write", "branch")
				if target != "folder" {
					pt.Do(t, h.Org1.Admin, "PATCH", "v0alpha1", "repositories/"+repo, map[string]any{"spec": map[string]any{"sync": map[string]any{"target": target}}}).Require(t, 200)
					h.WaitForHealthyRepository(t, repo)
				}
				for _, version := range pt.Versions {
					t.Run(version, func(t *testing.T) {
						uid := pt.Name()
						title := "Branch migrated " + uid
						pt.Request(t, h.Org1.Admin, "POST", "/apis/dashboard.grafana.app/v0alpha1/namespaces/default/dashboards", pt.Dashboard(uid, title)).Require(t, 201)
						for _, missing := range []string{"jobs", "dashboards:read", "folders:read", "dashboards:create", "folders:create", "delete", "none"} {
							t.Run(missing, func(t *testing.T) {
								actions := []string{"provisioning.jobs:create", "dashboards:read", "folders:read", "dashboards:create", "folders:create"}
								filtered := []string{}
								for _, action := range actions {
									if action != missing && !(missing == "jobs" && action == "provisioning.jobs:create") {
										filtered = append(filtered, action)
									}
								}
								grants := pt.Actions(filtered...)
								if missing != "delete" {
									if selection == "selective" {
										grants = append(grants, pt.Grant("dashboards", uid, "dashboards:delete"))
									} else {
										grants = pt.Actions(append(filtered, "dashboards:delete", "folders:delete")...)
									}
								}
								u := pt.None(t, h.ProvisioningTestHelper, grants...)
								branch := pt.Name()
								opts := map[string]any{"branch": branch, "message": "Permission migration", "skipResourceDeletion": selection == "skip"}
								if selection == "selective" {
									opts["resources"] = []any{map[string]any{"name": uid, "kind": "Dashboard", "group": "dashboard.grafana.app"}}
								}
								rsp := pt.Do(t, u, "POST", version, "repositories/"+repo+"/jobs", map[string]any{"action": "migrate", "migrate": opts})
								allowed := missing == "none" || missing == "delete" && selection == "skip"
								if !allowed {
									if missing == "delete" && selection == "selective" {
										rsp.Require(t, 500)
										require.Contains(t, string(rsp.Body), "authorize delete ")
									} else {
										rsp.Require(t, 403)
									}
									refs, err := local.Git("ls-remote", "origin", "refs/heads/"+branch)
									require.NoError(t, err)
									require.Empty(t, strings.TrimSpace(refs))
									_, err = h.DashboardsV0.Resource.Get(t.Context(), uid, metav1.GetOptions{})
									require.NoError(t, err)
									return
								}
								rsp.Require(t, 202)
								h.AwaitJobSuccess(t, &unstructured.Unstructured{Object: rsp.Object(t)})
								_, err := local.Git("fetch", "origin")
								require.NoError(t, err)
								file := strings.ToLower(strings.ReplaceAll(title, " ", "-")) + ".json"
								data, err := local.Git("show", "origin/"+branch+":"+file)
								require.NoError(t, err)
								require.Contains(t, data, uid)
								_, err = local.Git("show", "origin/main:"+file)
								require.Error(t, err)
								_, err = h.DashboardsV0.Resource.Get(t.Context(), uid, metav1.GetOptions{})
								if selection == "skip" {
									require.NoError(t, err)
								} else {
									require.True(t, apierrors.IsNotFound(err), "%v", err)
								}
							})
						}
					})
				}
			})
		}
	}
}
