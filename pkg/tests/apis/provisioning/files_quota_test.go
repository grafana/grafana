package provisioning

import (
	"context"
	"io"
	"net/http"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestIntegrationProvisioning_FilesQuotaEnforcement(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	t.Run("no quota configured allows create and update via files endpoint", func(t *testing.T) {
		// No quota limit = unlimited, both POST (create) and PUT (update) should succeed
		helper := runGrafana(t)
		ctx := context.Background()

		const repo = "files-quota-unlimited-repo"
		repoPath := filepath.Join(helper.ProvisioningPath, repo)
		helper.CreateRepo(t, TestRepo{
			Name:   repo,
			Path:   repoPath,
			Target: "folder",
			Copies: map[string]string{
				"testdata/all-panels.json": "dashboard1.json",
			},
			SkipResourceAssertions: true,
		})

		// Wait for quota condition to show unlimited
		helper.WaitForQuotaReconciliation(t, repo, provisioning.ReasonQuotaUnlimited)

		// POST (create) should succeed
		var createStatusCode int
		result := helper.AdminREST.Post().
			Namespace("default").
			Resource("repositories").
			Name(repo).
			SubResource("files", "new-dashboard.json").
			Body(helper.LoadFile("testdata/text-options.json")).
			SetHeader("Content-Type", "application/json").
			Do(ctx).StatusCode(&createStatusCode)
		require.NoError(t, result.Error(), "POST (create) should succeed when no quota is configured")
		require.Equal(t, http.StatusOK, createStatusCode, "should return 200 OK for create")

		// PUT (update) should succeed
		var updateStatusCode int
		result = helper.AdminREST.Put().
			Namespace("default").
			Resource("repositories").
			Name(repo).
			SubResource("files", "dashboard1.json").
			Body(helper.LoadFile("testdata/text-options.json")).
			SetHeader("Content-Type", "application/json").
			Do(ctx).StatusCode(&updateStatusCode)
		require.NoError(t, result.Error(), "PUT (update) should succeed when no quota is configured")
		require.Equal(t, http.StatusOK, updateStatusCode, "should return 200 OK for update")

		// POST with originalPath (move) should succeed
		resp := helper.postFilesRequest(t, repo, filesPostOptions{
			targetPath:   "moved-dashboard.json",
			originalPath: "new-dashboard.json",
			message:      "move dashboard",
		})
		defer resp.Body.Close() //nolint:errcheck
		require.Equal(t, http.StatusOK, resp.StatusCode, "POST (move) should succeed when no quota is configured")
	})

	t.Run("within quota allows create and update via files endpoint", func(t *testing.T) {
		// With folder target: 1 dashboard + 1 folder = 2 resources, limit 10 → within quota
		helper := runGrafana(t, func(opts *testinfra.GrafanaOpts) {
			opts.ProvisioningMaxResourcesPerRepository = 10
		})
		ctx := context.Background()

		const repo = "files-quota-within-repo"
		repoPath := filepath.Join(helper.ProvisioningPath, repo)
		helper.CreateRepo(t, TestRepo{
			Name:   repo,
			Path:   repoPath,
			Target: "folder",
			Copies: map[string]string{
				"testdata/all-panels.json": "dashboard1.json",
			},
			SkipResourceAssertions: true,
		})

		// Wait for quota condition to show within quota
		helper.WaitForQuotaReconciliation(t, repo, provisioning.ReasonWithinQuota)

		// POST (create) should succeed
		var createStatusCode int
		result := helper.AdminREST.Post().
			Namespace("default").
			Resource("repositories").
			Name(repo).
			SubResource("files", "new-dashboard.json").
			Body(helper.LoadFile("testdata/text-options.json")).
			SetHeader("Content-Type", "application/json").
			Do(ctx).StatusCode(&createStatusCode)
		require.NoError(t, result.Error(), "POST (create) should succeed when within quota")
		require.Equal(t, http.StatusOK, createStatusCode, "should return 200 OK for create")

		// PUT (update) should succeed
		var updateStatusCode int
		result = helper.AdminREST.Put().
			Namespace("default").
			Resource("repositories").
			Name(repo).
			SubResource("files", "dashboard1.json").
			Body(helper.LoadFile("testdata/text-options.json")).
			SetHeader("Content-Type", "application/json").
			Do(ctx).StatusCode(&updateStatusCode)
		require.NoError(t, result.Error(), "PUT (update) should succeed when within quota")
		require.Equal(t, http.StatusOK, updateStatusCode, "should return 200 OK for update")

		// POST with originalPath (move) should succeed
		resp := helper.postFilesRequest(t, repo, filesPostOptions{
			targetPath:   "moved-dashboard.json",
			originalPath: "new-dashboard.json",
			message:      "move dashboard",
		})
		defer resp.Body.Close() //nolint:errcheck
		require.Equal(t, http.StatusOK, resp.StatusCode, "POST (move) should succeed when within quota")
	})

	t.Run("quota reached blocks create but allows update via files endpoint", func(t *testing.T) {
		// With folder target: 1 dashboard + 1 folder = 2 resources, limit 2 → exactly at limit (reached)
		helper := runGrafana(t, func(opts *testinfra.GrafanaOpts) {
			opts.ProvisioningMaxResourcesPerRepository = 2
		})
		ctx := context.Background()

		const repo = "files-quota-reached-repo"
		repoPath := filepath.Join(helper.ProvisioningPath, repo)
		helper.CreateRepo(t, TestRepo{
			Name:   repo,
			Path:   repoPath,
			Target: "folder",
			Copies: map[string]string{
				"testdata/all-panels.json": "dashboard1.json",
			},
			SkipResourceAssertions: true,
		})

		// Wait for quota condition to show reached
		helper.WaitForQuotaReconciliation(t, repo, provisioning.ReasonQuotaReached)

		// POST (create) should be blocked with Forbidden
		result := helper.AdminREST.Post().
			Namespace("default").
			Resource("repositories").
			Name(repo).
			SubResource("files", "new-dashboard.json").
			Body(helper.LoadFile("testdata/text-options.json")).
			SetHeader("Content-Type", "application/json").
			Do(ctx)
		require.Error(t, result.Error(), "POST (create) should be blocked when quota is reached")
		require.True(t, apierrors.IsForbidden(result.Error()), "error should be Forbidden, got: %v", result.Error())

		// PUT (update) should succeed since quota reached only blocks creates
		var updateStatusCode int
		result = helper.AdminREST.Put().
			Namespace("default").
			Resource("repositories").
			Name(repo).
			SubResource("files", "dashboard1.json").
			Body(helper.LoadFile("testdata/text-options.json")).
			SetHeader("Content-Type", "application/json").
			Do(ctx).StatusCode(&updateStatusCode)
		require.NoError(t, result.Error(), "PUT (update) should succeed when quota is reached")
		require.Equal(t, http.StatusOK, updateStatusCode, "should return 200 OK for update")

		// POST with originalPath (move) should succeed
		resp := helper.postFilesRequest(t, repo, filesPostOptions{
			targetPath:   "moved-dashboard.json",
			originalPath: "dashboard1.json",
			message:      "move dashboard",
		})
		defer resp.Body.Close() //nolint:errcheck
		require.Equal(t, http.StatusOK, resp.StatusCode, "POST (move) should succeed when quota is reached")
	})

	t.Run("quota exceeded blocks both create and update via files endpoint", func(t *testing.T) {
		// With folder target: 2 dashboards + 1 folder = 3 resources, limit 1 → exceeded
		helper := runGrafana(t, func(opts *testinfra.GrafanaOpts) {
			opts.ProvisioningMaxResourcesPerRepository = 1
		})
		ctx := context.Background()

		const repo = "files-quota-exceeded-repo"
		repoPath := filepath.Join(helper.ProvisioningPath, repo)
		helper.CreateRepo(t, TestRepo{
			Name:   repo,
			Path:   repoPath,
			Target: "folder",
			Copies: map[string]string{
				// Adding 2 dashboards + 1 folder = 3 resources, exceeding limit of 1
				"testdata/all-panels.json":   "dashboard1.json",
				"testdata/text-options.json": "dashboard2.json",
			},
			SkipResourceAssertions: true,
		})

		// Wait for quota condition to show exceeded
		helper.WaitForQuotaReconciliation(t, repo, provisioning.ReasonQuotaExceeded)

		// POST (create) should be blocked with Forbidden
		result := helper.AdminREST.Post().
			Namespace("default").
			Resource("repositories").
			Name(repo).
			SubResource("files", "new-dashboard.json").
			Body(helper.LoadFile("testdata/timeline-demo.json")).
			SetHeader("Content-Type", "application/json").
			Do(ctx)
		require.Error(t, result.Error(), "POST (create) should be blocked when quota is exceeded")
		require.True(t, apierrors.IsForbidden(result.Error()), "error should be Forbidden, got: %v", result.Error())

		// PUT (update) should also be blocked with Forbidden
		result = helper.AdminREST.Put().
			Namespace("default").
			Resource("repositories").
			Name(repo).
			SubResource("files", "dashboard1.json").
			Body(helper.LoadFile("testdata/text-options.json")).
			SetHeader("Content-Type", "application/json").
			Do(ctx)
		require.Error(t, result.Error(), "PUT (update) should be blocked when quota is exceeded")
		require.True(t, apierrors.IsForbidden(result.Error()), "error should be Forbidden, got: %v", result.Error())

		// POST with originalPath (move) should also be blocked
		resp := helper.postFilesRequest(t, repo, filesPostOptions{
			targetPath:   "moved-dashboard.json",
			originalPath: "dashboard1.json",
			message:      "move dashboard",
		})
		defer resp.Body.Close() //nolint:errcheck
		body, err := io.ReadAll(resp.Body)
		require.NoError(t, err)
		require.Equal(t, http.StatusForbidden, resp.StatusCode, "POST (move) should be blocked when quota is exceeded, body: %s", string(body))
	})
}
