package isolated

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
	pt "github.com/grafana/grafana/pkg/tests/apis/provisioning/permissions/testutil"
	"github.com/grafana/grafana/pkg/tests/testinfra"
)

// Repository pull, performance, and cleanup jobs require both job-create and repository
// write grants. Cleanup accepts missing repositories but must reject active ones.
func TestIntegrationProvisioning_NoneAdministrativeJobs(t *testing.T) {
	h := common.RunGrafana(t, func(o *testinfra.GrafanaOpts) {
		o.EnableFeatureToggles = append(o.EnableFeatureToggles, featuremgmt.FlagProvisioningPerformance)
	})
	repo := pt.LocalRepo(t, h, "folder")
	for _, version := range pt.Versions {
		for _, action := range []string{"pull", "test", "releaseResources", "deleteResources"} {
			for _, grant := range []string{"none", "jobs", "repository", "both"} {
				t.Run(version+"/"+action+"/"+grant, func(t *testing.T) {
					var actions []string
					if grant == "jobs" || grant == "both" {
						actions = append(actions, "provisioning.jobs:create")
					}
					if grant == "repository" || grant == "both" {
						actions = append(actions, "provisioning.repositories:write")
					}
					u := pt.None(t, h, pt.Actions(actions...)...)
					target := repo
					spec := map[string]any{"action": action}
					switch action {
					case "pull":
						spec["pull"] = map[string]any{}
					case "test":
						spec["test"] = map[string]any{"duration": "1ms"}
					default:
						target = pt.Name()
					}
					before := pt.JobCount(t, h)
					rsp := pt.Do(t, u, "POST", version, "repositories/"+target+"/jobs", spec)
					if grant != "both" {
						rsp.Require(t, 403)
						require.Equal(t, before, pt.JobCount(t, h))
						return
					}
					pt.AwaitSuccess(t, h, rsp)
					if target != repo {
						pt.Do(t, u, "POST", version, "repositories/"+repo+"/jobs", spec).Require(t, 409)
					}
				})
			}
		}
	}
}
