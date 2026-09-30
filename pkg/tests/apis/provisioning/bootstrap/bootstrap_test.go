package bootstrap

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	dashboardV1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
)

const (
	waitTimeout  = 60 * time.Second
	pollInterval = 100 * time.Millisecond
	tokenValue   = "bootstrap-token"
)

// githubRepoManifest renders a Repository manifest of type github in the given namespace (which
// selects the org: "default" is org 1, "org-N" is org N). The token is sourced from the environment
// so it never appears literally in the file (the file-as-IaC pattern).
func githubRepoManifest(name, namespace string) string {
	return fmt.Sprintf(`
apiVersion: provisioning.grafana.app/v0alpha1
kind: Repository
metadata:
  name: %s
  namespace: %s
spec:
  title: %s
  type: github
  github:
    url: https://github.com/grafana/grafana-git-sync-demo
    branch: integration-test
    path: ""
  sync:
    enabled: false
    target: folder
    intervalSeconds: 60
  workflows: []
secure:
  token:
    create: "$__env{GH_PAT}"
`, name, namespace, name)
}

// dashboardManifest is an unsupported kind: the provisioning bootstrap must ignore it, because once
// a Repository is configured Git Sync provisions dashboards/folders from the repository itself.
func dashboardManifest(name string) string {
	return fmt.Sprintf(`
apiVersion: dashboard.grafana.app/v1beta1
kind: Dashboard
metadata:
  name: %s
  namespace: default
spec:
  title: %s
`, name, name)
}

func bootGrafana(t *testing.T, manifests map[string]string) *apis.K8sTestHelper {
	t.Helper()
	return apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
		EnableFeatureToggles: []string{featuremgmt.FlagProvisioning},
		UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
			"dashboards.dashboard.grafana.app": {DualWriterMode: grafanarest.Mode5, EnableMigration: true},
			"folders.folder.grafana.app":       {DualWriterMode: grafanarest.Mode5, EnableMigration: true},
		},
		ProvisioningAllowedTargets: []string{"folder", "instance", "folderless"},
		ProvisioningAllowInsecure:  true,
		// Inline secret encryption at admission requires the secret manager DB migrations.
		SecretsManagerEnableDBMigrations: true,
		BootstrapManifests:               manifests,
	})
}

// TestIntegrationProvisioningBootstrap boots Grafana with mounted Repository manifests and asserts
// the startup bootstrap applies them (issue #119289). It uses NewK8sTestHelper directly rather than
// the provisioning helper, whose setup wipes all provisioning resources and would delete the
// bootstrapped ones. A single boot serves several cases via subtests.
func TestIntegrationProvisioningBootstrap(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}

	t.Setenv("GH_PAT", tokenValue)

	org2Namespace := "org-2" // org 2 is created by the test helper (OrgB)
	multiDoc := githubRepoManifest("multi-a", "default") + "---" + githubRepoManifest("multi-b", "default") + "---" + dashboardManifest("skip-me")
	helper := bootGrafana(t, map[string]string{
		"github.yaml": githubRepoManifest("gh-repo", "default"),
		"multi.yaml":  multiDoc,
		"org2.yaml":   githubRepoManifest("org2-repo", org2Namespace),
	})
	ctx := context.Background()

	require.Equal(t, org2Namespace, helper.Namespacer(helper.OrgB.OrgID),
		"sanity check: org 2 maps to the org-2 namespace")

	repos := helper.GetResourceClient(apis.ResourceClientArgs{
		User:      helper.Org1.Admin,
		Namespace: "default",
		GVR:       provisioning.RepositoryResourceInfo.GroupVersionResource(),
	})

	// The repositories are applied by the startup hook; poll until the first appears.
	var ghRepo *unstructured.Unstructured
	require.EventuallyWithT(t, func(c *assert.CollectT) {
		got, err := repos.Resource.Get(ctx, "gh-repo", metav1.GetOptions{})
		if !assert.NoError(c, err) {
			return
		}
		ghRepo = got
	}, waitTimeout, pollInterval, "bootstrap repository should be created at startup")

	t.Run("encrypts the inline token via admission", func(t *testing.T) {
		name, found, err := unstructured.NestedString(ghRepo.Object, "secure", "token", "name")
		require.NoError(t, err)
		require.True(t, found, "secure.token.name should be set")
		require.NotEmpty(t, name)

		_, createFound, err := unstructured.NestedString(ghRepo.Object, "secure", "token", "create")
		require.NoError(t, err)
		require.False(t, createFound, "plaintext secure.token.create must not be persisted")

		decrypted, err := helper.GetEnv().DecryptService.Decrypt(ctx, "provisioning.grafana.app", ghRepo.GetNamespace(), name)
		require.NoError(t, err)
		require.Equal(t, tokenValue, decrypted[name].Value().DangerouslyExposeAndConsumeValue())
	})

	t.Run("marks the resource as managed by the file bootstrap", func(t *testing.T) {
		meta, err := utils.MetaAccessor(ghRepo)
		require.NoError(t, err)
		mgr, ok := meta.GetManagerProperties()
		require.True(t, ok, "bootstrap resource should be managed")
		assert.Equal(t, utils.ManagerKindFileProvisioning, mgr.Kind)
		assert.Equal(t, "file-provisioning", mgr.Identity)
		assert.False(t, mgr.AllowsEdits, "bootstrap resource should be read-only in the UI")
	})

	t.Run("applies multiple repositories across files and documents", func(t *testing.T) {
		for _, name := range []string{"multi-a", "multi-b"} {
			require.EventuallyWithT(t, func(c *assert.CollectT) {
				got, err := repos.Resource.Get(ctx, name, metav1.GetOptions{})
				if !assert.NoError(c, err) {
					return
				}
				meta, err := utils.MetaAccessor(got)
				assert.NoError(c, err)
				mgr, ok := meta.GetManagerProperties()
				assert.True(c, ok)
				assert.Equal(c, utils.ManagerKindFileProvisioning, mgr.Kind)
			}, waitTimeout, pollInterval, "repository %s should be created from a multi-document manifest", name)
		}
	})

	t.Run("skips unsupported kinds", func(t *testing.T) {
		// The bootstrap only manages Repository/Connection; the Dashboard document must be ignored.
		dashboards := helper.GetResourceClient(apis.ResourceClientArgs{
			User:      helper.Org1.Admin,
			Namespace: "default",
			GVR:       dashboardV1.DashboardResourceInfo.GroupVersionResource(),
		})
		_, err := dashboards.Resource.Get(ctx, "skip-me", metav1.GetOptions{})
		require.True(t, apierrors.IsNotFound(err), "unsupported Dashboard manifest must not be created, got: %v", err)

		// And it is certainly not created as a repository.
		_, err = repos.Resource.Get(ctx, "skip-me", metav1.GetOptions{})
		require.True(t, apierrors.IsNotFound(err), "skip-me must not exist as a repository, got: %v", err)
	})

	t.Run("applies repositories to the org selected by the manifest namespace", func(t *testing.T) {
		org2Repos := helper.GetResourceClient(apis.ResourceClientArgs{
			User:      helper.OrgB.Admin,
			Namespace: org2Namespace,
			GVR:       provisioning.RepositoryResourceInfo.GroupVersionResource(),
		})

		require.EventuallyWithT(t, func(c *assert.CollectT) {
			got, err := org2Repos.Resource.Get(ctx, "org2-repo", metav1.GetOptions{})
			if !assert.NoError(c, err) {
				return
			}
			assert.Equal(c, org2Namespace, got.GetNamespace())
		}, waitTimeout, pollInterval, "org-2 repository should be created in org 2")

		// Org isolation: the org-2 repository must not leak into org 1, and org 1's repos not into org 2.
		_, err := repos.Resource.Get(ctx, "org2-repo", metav1.GetOptions{})
		require.True(t, apierrors.IsNotFound(err), "org2-repo must not appear in org 1, got: %v", err)
		_, err = org2Repos.Resource.Get(ctx, "gh-repo", metav1.GetOptions{})
		require.True(t, apierrors.IsNotFound(err), "gh-repo must not appear in org 2, got: %v", err)
	})
}
