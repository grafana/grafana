package provisioning

import (
	"encoding/json"
	"path"
	"testing"

	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
	"github.com/stretchr/testify/require"
)

// TestIntegrationProvisioning_LocalRepositoryAllowsSecureValues is the other half
// of the git guard: a local repository's files never leave the instance, so a
// plaintext secure value is allowed there.
func TestIntegrationProvisioning_LocalRepositoryAllowsSecureValues(t *testing.T) {
	helper := sharedHelper(t)

	const repo = "local-secure-values"
	// Its own directory and folder scope: an instance-scoped repository over the
	// shared provisioning path outlives this test on the shared server and claims
	// resources other tests expect to be unmanaged.
	helper.CreateLocalRepo(t, common.TestRepo{
		Name:       repo,
		LocalPath:  path.Join(helper.ProvisioningPath, repo),
		SyncTarget: "folder",
		Workflows:  []string{"write"},
	})

	body, err := json.MarshalIndent(map[string]any{
		"apiVersion": "dashboard.grafana.app/v1",
		"kind":       "Dashboard",
		"metadata":   map[string]any{"name": "local-secure-dash"},
		"spec":       map[string]any{"title": "local-secure-dash"},
		"secure":     map[string]any{"apiKey": map[string]any{"create": "do-not-commit-me"}},
	}, "", "\t")
	require.NoError(t, err)

	result := helper.AdminREST.Post().
		Namespace("default").
		Resource("repositories").
		Name(repo).
		SubResource("files", "dashboard.json").
		Param("message", "Create a dashboard with a secret").
		Body(body).
		SetHeader("Content-Type", "application/json").
		Do(t.Context())

	require.NoError(t, result.Error(), "a local repository should accept a plaintext secure value")
	helper.RequireRepoFileExists(t, repo, "dashboard.json")
}
