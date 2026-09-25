package isolated

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
	pt "github.com/grafana/grafana/pkg/tests/apis/provisioning/permissions/testutil"
	"github.com/grafana/grafana/pkg/tests/testinfra"
)

// Repository status requires write access, while reading connection status requires read.
// Disable controllers so persisted repository status proves the effect of accepted writes.
func TestIntegrationProvisioning_NoneStatusWrites(t *testing.T) {
	h := common.RunGrafana(t, common.WithConnectionTypes([]string{"githubOAuth"}), func(o *testinfra.GrafanaOpts) { o.DisableControllers = true })
	for _, version := range pt.Versions {
		for _, resource := range []string{"repositories", "connections"} {
			for _, method := range []string{"GET", "PUT", "PATCH"} {
				if resource == "connections" && method != "GET" {
					continue
				}
				for _, grant := range []string{"none", "read", "write"} {
					t.Run(version+"/"+resource+"/"+method+"/"+grant, func(t *testing.T) {
						name := pt.Name()
						obj := pt.Connection(name, version)
						if resource == "repositories" {
							obj = pt.Repository(name, h.ProvisioningPath, version)
						}
						created := pt.Do(t, h.Org1.Admin, "POST", version, resource, obj).Require(t, 201).Object(t)
						var actions []string
						if grant != "none" {
							actions = []string{"provisioning." + resource + ":" + grant}
						}
						u := pt.None(t, h, pt.Actions(actions...)...)
						status := map[string]any{"observedGeneration": float64(123)}
						body := map[string]any{"status": status}
						if method == "PUT" {
							body = created
							body["status"] = status
						}
						rsp := pt.Do(t, u, method, version, resource+"/"+name+"/status", body)
						allowed := grant == "write"
						if resource == "connections" {
							allowed = grant == "read"
						}
						if allowed {
							rsp.Require(t, 200)
						} else {
							rsp.Require(t, 403)
						}
						stored := pt.Do(t, h.Org1.Admin, "GET", version, resource+"/"+name, nil).Require(t, 200).Object(t)
						storedStatus, _ := stored["status"].(map[string]any)
						if allowed && method != "GET" {
							require.Equal(t, float64(123), storedStatus["observedGeneration"])
						} else {
							require.NotEqual(t, float64(123), storedStatus["observedGeneration"])
						}
					})
				}
			}
		}
	}
}
