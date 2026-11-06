package bootstrap

import (
	"encoding/base64"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/tests/testsuite"
)

// TestIntegrationProvisioning_Bootstrap covers the self-inception: a directory mounted
// as bootstrap_path is synced by a repository Grafana registers itself, so the dashboards,
// folders, repositories and connections declared in that directory all come up with it.
// That repository's own configuration is not editable; what it provisions is.
//
// The repository declared in the bootstrap path reads a sibling directory rather than one
// inside the bootstrap path, so the two repositories never claim the same resource.
func TestIntegrationProvisioning_Bootstrap(t *testing.T) {
	root := t.TempDir()
	bootstrapPath := filepath.Join(root, "bootstrap")
	nestedPath := filepath.Join(root, "nested")
	require.NoError(t, os.MkdirAll(filepath.Join(bootstrapPath, "team-a"), 0o750))
	require.NoError(t, os.MkdirAll(nestedPath, 0o750))

	writeManifest(t, bootstrapPath, "repository.yaml", nestedRepository(nestedPath))
	writeManifest(t, bootstrapPath, "connection.yaml", bootstrappedConnection())
	writeManifest(t, bootstrapPath, "github-repository.yaml", tokenRepository())
	writeManifest(t, bootstrapPath, "dashboard.json", dashboard("bootstrap-dashboard"))
	writeManifest(t, filepath.Join(bootstrapPath, "team-a"), "_folder.json", folder("bootstrap-team-folder", "Team A"))
	writeManifest(t, filepath.Join(bootstrapPath, "team-a"), "overview.json", dashboard("bootstrap-team-dashboard"))
	writeManifest(t, nestedPath, "dashboard.json", dashboard("nested-dashboard"))

	helper := common.RunGrafana(t,
		common.WithProvisioningBootstrapPath(bootstrapPath),
		func(opts *testinfra.GrafanaOpts) {
			// The bootstrap path is permitted implicitly; the directory the repository it
			// declares reads is a separate mount, so it has to be permitted explicitly.
			opts.PermittedProvisioningPaths += "|" + nestedPath
		},
	)

	t.Run("registers a local repository over the configured path", func(t *testing.T) {
		repo, err := helper.Repositories.Resource.Get(t.Context(), "bootstrap", metav1.GetOptions{})
		require.NoError(t, err, "the bootstrap repository should exist at startup")

		spec := repo.Object["spec"].(map[string]any)
		assert.Equal(t, "local", spec["type"])
		assert.Equal(t, bootstrapPath, spec["local"].(map[string]any)["path"])
		assert.Equal(t, []any{"write"}, spec["workflows"])
		assert.Equal(t, true, spec["sync"].(map[string]any)["enabled"])
	})

	t.Run("marks its own configuration as not editable", func(t *testing.T) {
		repo, err := helper.Repositories.Resource.Get(t.Context(), "bootstrap", metav1.GetOptions{})
		require.NoError(t, err)

		manager, ok := metaOf(t, repo).GetManagerProperties()
		require.True(t, ok, "the bootstrap repository should declare a manager")
		assert.Equal(t, utils.ManagerKindFileProvisioning, manager.Kind)
		assert.False(t, manager.AllowsEdits, "its configuration comes from bootstrap_path")
	})

	helper.AwaitJobs(t, "bootstrap")

	t.Run("provisions the dashboards and folders in the path", func(t *testing.T) {
		helper.RequireDashboards(t, "bootstrap-dashboard", "bootstrap-team-dashboard")
		folders := helper.RequireFolders(t, "bootstrap-team-folder")
		assert.Equal(t, "Team A", folders[0].Object["spec"].(map[string]any)["title"])
	})

	t.Run("provisions the repository declared in the path", func(t *testing.T) {
		nested := requireRepository(t, helper, "nested")
		manager, ok := metaOf(t, nested).GetManagerProperties()
		require.True(t, ok, "the provisioned repository should be managed")
		assert.Equal(t, utils.ManagerKindRepo, manager.Kind)
		assert.Equal(t, "bootstrap", manager.Identity)
	})

	t.Run("provisions the connection declared in the path", func(t *testing.T) {
		connection, err := helper.Connections.Resource.Get(t.Context(), "bootstrapped-connection", metav1.GetOptions{})
		require.NoError(t, err, "the connection declared in the bootstrap path should exist")

		manager, ok := metaOf(t, connection).GetManagerProperties()
		require.True(t, ok)
		assert.Equal(t, "bootstrap", manager.Identity)
		// The private key reached the secret store: a reference is persisted, never the value.
		secure := connection.Object["secure"].(map[string]any)["privateKey"].(map[string]any)
		assert.NotEmpty(t, secure["name"], "the private key should be stored as a reference")
		assert.NotContains(t, secure, "create")
	})

	t.Run("the repository it provisioned syncs its own content", func(t *testing.T) {
		helper.AwaitJobs(t, "nested")
		helper.RequireDashboards(t, "nested-dashboard")
	})

	t.Run("re-syncing the bootstrap path is clean", func(t *testing.T) {
		helper.SyncAndWait(t, "bootstrap", nil)
		job := helper.AwaitLatestHistoricJob(t, "bootstrap")
		assert.Equal(t, "success", mustString(t, job, "status", "state"),
			"a repeated sync must not report the resources it already provisioned")
	})

	t.Run("forbids instance-target repositories", func(t *testing.T) {
		// An instance-target repository may only exist where no other repository does, so
		// the bootstrap repository rules it out. The target is dropped from the allowed
		// set, which is what the caller and the UI see.
		instance := &unstructured.Unstructured{Object: nestedRepository(nestedPath)}
		instance.SetName("instance-target")
		instance.Object["spec"].(map[string]any)["sync"].(map[string]any)["target"] = "instance"

		_, err := helper.Repositories.Resource.Create(t.Context(), instance, metav1.CreateOptions{})
		require.Error(t, err)
		assert.Contains(t, err.Error(), "sync target is not supported")
	})

	t.Run("the resources it provisions stay editable", func(t *testing.T) {
		nested := requireRepository(t, helper, "nested")
		nested.Object["spec"].(map[string]any)["title"] = "Edited through the API"

		// The write is routed to the bootstrap repository's files endpoint, which commits
		// it back to the mounted directory.
		_, err := helper.Repositories.Resource.Update(t.Context(), nested, metav1.UpdateOptions{})
		require.NoError(t, err, "a resource provisioned by the bootstrap repository should be editable")

		edited := readFile(t, bootstrapPath, "repository.yaml")
		assert.Contains(t, edited, "Edited through the API",
			"the edit should be written back to the file it came from")
	})

	t.Run("editing a repository keeps its secure values", func(t *testing.T) {
		repo := requireRepository(t, helper, "with-token")
		before := mustString(t, repo, "secure", "token", "name")
		require.NotEmpty(t, before, "the token should have been encrypted on create")

		repo.Object["spec"].(map[string]any)["title"] = "Edited through the API"
		_, err := helper.Repositories.Resource.Update(t.Context(), repo, metav1.UpdateOptions{})
		require.NoError(t, err, "a repository provisioned by the bootstrap repository should be editable")

		updated := requireRepository(t, helper, "with-token")
		assert.Equal(t, "Edited through the API", mustString(t, updated, "spec", "title"))
		assert.Equal(t, before, mustString(t, updated, "secure", "token", "name"),
			"the token reference must survive an edit")

		file := readFile(t, bootstrapPath, "github-repository.yaml")
		assert.Contains(t, file, before, "the committed file should carry the reference")
		assert.NotContains(t, file, "create", "the plaintext token must not be written back")
	})

	t.Run("editing a connection keeps its secure values", func(t *testing.T) {
		connection, err := helper.Connections.Resource.Get(t.Context(), "bootstrapped-connection", metav1.GetOptions{})
		require.NoError(t, err)
		before := mustString(t, connection, "secure", "privateKey", "name")

		connection.Object["spec"].(map[string]any)["title"] = "Edited through the API"
		_, err = helper.Connections.Resource.Update(t.Context(), connection, metav1.UpdateOptions{})
		require.NoError(t, err, "a connection provisioned by the bootstrap repository should be editable")

		// The edit round-trips through the file, which only ever carried a reference once
		// the secret was encrypted. Rewriting it must not drop that reference.
		updated, err := helper.Connections.Resource.Get(t.Context(), "bootstrapped-connection", metav1.GetOptions{})
		require.NoError(t, err)
		assert.Equal(t, "Edited through the API", mustString(t, updated, "spec", "title"))
		assert.Equal(t, before, mustString(t, updated, "secure", "privateKey", "name"),
			"the private key reference must survive an edit")

		file := readFile(t, bootstrapPath, "connection.yaml")
		assert.Contains(t, file, before, "the committed file should carry the reference")
		assert.NotContains(t, file, "create", "the plaintext key must not be written back")
	})
}

func mustString(t *testing.T, obj *unstructured.Unstructured, fields ...string) string {
	t.Helper()
	value, found, err := unstructured.NestedString(obj.Object, fields...)
	require.NoError(t, err)
	require.True(t, found, "expected %v to be set", fields)
	return value
}

func requireRepository(t *testing.T, helper *common.ProvisioningTestHelper, name string) *unstructured.Unstructured {
	t.Helper()
	var repo *unstructured.Unstructured
	require.EventuallyWithT(t, func(c *assert.CollectT) {
		found, err := helper.Repositories.Resource.Get(t.Context(), name, metav1.GetOptions{})
		if assert.NoError(c, err, "expected repository %q to exist", name) {
			repo = found
		}
	}, common.WaitTimeoutDefault, common.WaitIntervalDefault)
	return repo
}

func metaOf(t *testing.T, obj *unstructured.Unstructured) utils.GrafanaMetaAccessor {
	t.Helper()
	meta, err := utils.MetaAccessor(obj)
	require.NoError(t, err)
	return meta
}

func readFile(t *testing.T, dir, name string) string {
	t.Helper()
	body, err := os.ReadFile(filepath.Join(dir, name)) // #nosec G304 -- a path this test wrote
	require.NoError(t, err)
	return string(body)
}

func writeManifest(t *testing.T, dir, name string, content map[string]any) {
	t.Helper()
	body, err := json.MarshalIndent(content, "", "  ")
	require.NoError(t, err)
	require.NoError(t, os.WriteFile(filepath.Join(dir, name), body, 0o600))
}

func nestedRepository(path string) map[string]any {
	return map[string]any{
		"apiVersion": "provisioning.grafana.app/v0alpha1",
		"kind":       "Repository",
		"metadata":   map[string]any{"name": "nested"},
		"spec": map[string]any{
			"title":     "Declared by the bootstrap repository",
			"type":      "local",
			"local":     map[string]any{"path": path},
			"workflows": []any{},
			"sync":      map[string]any{"enabled": true, "target": "folderless"},
		},
	}
}

// tokenRepository is a repository with a secure value of its own. Sync and webhooks are
// off: it is here to be edited, not to reach GitHub. A plaintext token is accepted because
// the repository carrying the file is local, where secure values are allowed.
func tokenRepository() map[string]any {
	return map[string]any{
		"apiVersion": "provisioning.grafana.app/v0alpha1",
		"kind":       "Repository",
		"metadata":   map[string]any{"name": "with-token"},
		"spec": map[string]any{
			"title":     "Declared by the bootstrap repository",
			"type":      "github",
			"github":    map[string]any{"url": "https://github.com/grafana/grafana-git-sync-demo", "branch": "main"},
			"webhook":   map[string]any{"disabled": true},
			"workflows": []any{},
			"sync":      map[string]any{"enabled": false, "target": "folderless"},
		},
		"secure": map[string]any{
			"token": map[string]any{"create": "not-a-real-token"},
		},
	}
}

func bootstrappedConnection() map[string]any {
	return map[string]any{
		"apiVersion": "provisioning.grafana.app/v0alpha1",
		"kind":       "Connection",
		"metadata":   map[string]any{"name": "bootstrapped-connection"},
		"spec": map[string]any{
			"title":  "Declared by the bootstrap repository",
			"type":   "github",
			"github": map[string]any{"appID": "123456", "installationID": "454545"},
		},
		"secure": map[string]any{
			"privateKey": map[string]any{
				"create": base64.StdEncoding.EncodeToString([]byte(common.TestGithubPrivateKeyPEM)),
			},
		},
	}
}

func folder(name, title string) map[string]any {
	return map[string]any{
		"apiVersion": "folder.grafana.app/v1beta1",
		"kind":       "Folder",
		"metadata":   map[string]any{"name": name},
		"spec":       map[string]any{"title": title},
	}
}

func dashboard(name string) map[string]any {
	return map[string]any{
		"apiVersion": "dashboard.grafana.app/v1",
		"kind":       "Dashboard",
		"metadata":   map[string]any{"name": name},
		"spec":       map[string]any{"title": name},
	}
}

func TestMain(m *testing.M) {
	testsuite.Run(m)
}
