package isolated

import (
	"net/http"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
	pt "github.com/grafana/grafana/pkg/tests/apis/provisioning/permissions/testutil"
	"github.com/grafana/grafana/pkg/tests/testinfra"
)

// Exercise each verb independently so one provisioning grant cannot stand in for
// another, including watches, patches, collection deletion, and history read access.
// Disable controllers so worker consumption and reconciliation cannot mask CRUD results.
func TestIntegrationProvisioning_NoneCRUD(t *testing.T) {
	h := common.RunGrafana(t, common.WithConnectionTypes([]string{"github", "githubOAuth"}), func(o *testinfra.GrafanaOpts) { o.DisableControllers = true })
	for _, version := range pt.Versions {
		for _, resource := range []string{"repositories", "connections", "jobs", "historicjobs"} {
			t.Run(version+"/"+resource, func(t *testing.T) {
				for _, operation := range []struct{ name, method, action string }{
					{"get", "GET", "read"}, {"list", "GET", "read"}, {"watch", "GET", "read"},
					{"create", "POST", "create"}, {"update", "PUT", "write"}, {"patch", "PATCH", "write"},
					{"delete", "DELETE", "delete"}, {"deleteCollection", "DELETE", "delete"},
				} {
					if resource == "jobs" && (operation.action == "create" || operation.action == "write") {
						continue
					}
					t.Run(operation.name, func(t *testing.T) {
						grants := []string{"none", "unrelated", "read", "create", "write", "delete"}
						if resource == "historicjobs" && operation.action != "read" {
							grants = []string{"none", "unrelated", "read"}
						}
						for _, grant := range grants {
							t.Run(grant, func(t *testing.T) {
								var actions []string
								switch grant {
								case "read", "create", "write", "delete":
									actions = []string{"provisioning." + resource + ":" + grant}
								case "unrelated":
									actions = []string{"provisioning.stats:read"}
								}
								u := pt.None(t, h, pt.Actions(actions...)...)
								name := pt.Name()
								var obj map[string]any
								switch resource {
								case "repositories":
									path := filepath.Join(h.ProvisioningPath, name)
									require.NoError(t, os.MkdirAll(path, 0750))
									obj = pt.Repository(name, path, version)
								case "connections":
									obj = pt.Connection(name, version)
								default:
									kind := "Job"
									if resource == "historicjobs" {
										kind = "HistoricJob"
									}
									obj = map[string]any{"apiVersion": "provisioning.grafana.app/" + version, "kind": kind, "metadata": map[string]any{"name": name}, "spec": map[string]any{"repository": "fixture-repo", "action": "pull", "pull": map[string]any{}}, "status": map[string]any{"state": "success"}}
								}
								obj["metadata"].(map[string]any)["labels"] = map[string]any{"none-case": name}
								path := resource + "/" + name
								var before map[string]any
								if operation.name != "create" {
									before = pt.Do(t, h.Org1.Admin, "POST", version, resource, obj).Require(t, 201).Object(t)
								}
								var body any
								switch operation.name {
								case "create":
									path = resource
									body = obj
								case "list", "deleteCollection":
									path = resource + "?labelSelector=none-case%3D" + name
								case "watch":
									path = resource + "?watch=true&resourceVersion=0&timeoutSeconds=1&labelSelector=none-case%3D" + name
								case "update":
									body = before
									meta := before["metadata"].(map[string]any)
									annotations, _ := meta["annotations"].(map[string]any)
									if annotations == nil {
										annotations = map[string]any{}
										meta["annotations"] = annotations
									}
									annotations["audit-result"] = "updated"
								case "patch":
									body = map[string]any{"metadata": map[string]any{"annotations": map[string]any{"audit-result": "updated"}}}
								}
								rsp := pt.Do(t, u, operation.method, version, path, body)
								if grant != operation.action {
									rsp.Require(t, http.StatusForbidden)
									stored := pt.Do(t, h.Org1.Admin, "GET", version, resource+"/"+name, nil)
									if operation.name == "create" {
										stored.Require(t, 404)
									} else {
										stored.Require(t, 200)
										require.NotContains(t, string(stored.Body), "audit-result")
									}
									return
								}
								expected := 200
								if operation.name == "create" {
									expected = 201
								}
								rsp.Require(t, expected)
								switch operation.action {
								case "create", "write":
									stored := pt.Do(t, h.Org1.Admin, "GET", version, resource+"/"+name, nil).Require(t, 200)
									if operation.action == "write" {
										require.Contains(t, string(stored.Body), "audit-result")
									}
									if resource == "connections" {
										require.NotContains(t, string(stored.Body), "test-client-secret")
									}
								case "delete":
									stored := pt.Do(t, h.Org1.Admin, "GET", version, resource+"/"+name, nil)
									if stored.Code == 200 {
										require.NotEmpty(t, stored.Object(t)["metadata"].(map[string]any)["deletionTimestamp"])
									} else {
										stored.Require(t, 404)
									}
								case "read":
									require.Contains(t, string(rsp.Body), name)
								}
							})
						}
					})
				}
			})
		}
	}
}
