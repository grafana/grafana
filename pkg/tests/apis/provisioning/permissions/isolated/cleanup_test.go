package isolated

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
	pt "github.com/grafana/grafana/pkg/tests/apis/provisioning/permissions/testutil"
	"github.com/grafana/grafana/pkg/tests/testinfra"
)

// Cleanup of a terminating repository still requires both job-create and repository
// write grants. Keep its finalizer with controllers stopped to test this state reliably.
func TestIntegrationProvisioning_NoneTerminatingCleanupJobs(t *testing.T) {
	h := common.RunGrafana(t, func(o *testinfra.GrafanaOpts) { o.DisableControllers = true })
	for _, version := range pt.Versions {
		for _, action := range []string{"releaseResources", "deleteResources"} {
			for _, grant := range []string{"none", "jobs", "repository", "both"} {
				t.Run(version+"/"+action+"/"+grant, func(t *testing.T) {
					name := pt.Name()
					obj := pt.Repository(name, h.ProvisioningPath, version)
					obj["metadata"].(map[string]any)["finalizers"] = []string{"release-orphan-resources"}
					pt.Do(t, h.Org1.Admin, "POST", version, "repositories", obj).Require(t, 201)
					pt.Do(t, h.Org1.Admin, "DELETE", version, "repositories/"+name, nil).Require(t, 200)
					stored := pt.Do(t, h.Org1.Admin, "GET", version, "repositories/"+name, nil).Require(t, 200).Object(t)
					require.NotEmpty(t, stored["metadata"].(map[string]any)["deletionTimestamp"])
					var actions []string
					if grant == "jobs" || grant == "both" {
						actions = append(actions, "provisioning.jobs:create")
					}
					if grant == "repository" || grant == "both" {
						actions = append(actions, "provisioning.repositories:write")
					}
					u := pt.None(t, h, pt.Actions(actions...)...)
					before := pt.JobCount(t, h)
					rsp := pt.Do(t, u, "POST", version, "repositories/"+name+"/jobs", map[string]any{"action": action})
					if grant == "both" {
						rsp.Require(t, 202)
						require.Equal(t, before+1, pt.JobCount(t, h))
					} else {
						rsp.Require(t, 403)
						require.Equal(t, before, pt.JobCount(t, h))
					}
				})
			}
		}
	}
}
