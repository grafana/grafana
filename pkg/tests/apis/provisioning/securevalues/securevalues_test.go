// Package securevalues covers provisioning a resource of the secrets group. It runs its own
// server because the kind is declared disabled by default, and lives in its own package because
// the shared provisioning suite brings up a git container this does not need.
//
// The assertions go through the files endpoint rather than a client for the kind: the secrets
// API is served only by Enterprise, and the point of this feature is that a local repository
// does not need it -- provisioning addresses the kind through the in-process service. Every
// write and read runs a dry run against that service, so the action it reports is what tells us
// whether the secure value really is in the store.
package securevalues

import (
	"encoding/json"
	"fmt"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/client-go/rest"

	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
	"github.com/grafana/grafana/pkg/tests/testinfra"
)

const (
	repo      = "local-secure-values"
	plaintext = "do-not-commit-me"
)

var env = common.NewSharedEnv(func(opts *testinfra.GrafanaOpts) {
	// Setting [provisioning] resources replaces the default set, where the secrets kind is
	// declared but disabled.
	opts.ProvisioningResources = []string{
		"folder.grafana.app/Folder:folder",
		"dashboard.grafana.app/Dashboard:folder",
		"secret.grafana.app/SecureValue",
	}
})

func TestMain(m *testing.M) {
	env.RunTestMain(m)
}

func secureValueFile(t *testing.T, name, description, value string) []byte {
	t.Helper()

	body, err := json.Marshal(map[string]any{
		"apiVersion": "secret.grafana.app/v1beta1",
		"kind":       "SecureValue",
		"metadata":   map[string]any{"name": name},
		"spec": map[string]any{
			"description": description,
			"value":       value,
		},
	})
	require.NoError(t, err, "should marshal the secure value")

	return body
}

// resourceObjects is the part of the files endpoint's answer these tests read: what the write
// would do, and the objects that came from the secret store.
type resourceObjects struct {
	Action   string         `json:"action"`
	Existing map[string]any `json:"existing"`
	DryRun   map[string]any `json:"dryRun"`
	Upsert   map[string]any `json:"upsert"`
}

// existingName is the name of the object Grafana already holds, empty when it holds none.
func (r resourceObjects) existingName() string {
	metadata, ok := r.Existing["metadata"].(map[string]any)
	if !ok {
		return ""
	}
	name, _ := metadata["name"].(string)

	return name
}

// requireValueNotReturned checks every object that came back from the secret store. The file
// itself is excluded: its plaintext is what the caller committed to the repository, while a
// value is write-only everywhere else -- including the simulated write a dry run answers with.
func (r resourceObjects) requireValueNotReturned(t *testing.T) {
	t.Helper()

	for name, obj := range map[string]map[string]any{"existing": r.Existing, "dryRun": r.DryRun, "upsert": r.Upsert} {
		if obj == nil {
			continue
		}
		raw, err := json.Marshal(obj)
		require.NoError(t, err)
		require.NotContains(t, string(raw), plaintext, "%s must not carry the value", name)
	}
}

// resource runs req and returns what the files endpoint reported for the resource.
func resource(t *testing.T, req *rest.Request) resourceObjects {
	t.Helper()

	raw, err := req.DoRaw(t.Context())
	require.NoError(t, err, "the request should succeed: %s", raw)

	var wrapper struct {
		Resource resourceObjects `json:"resource"`
	}
	require.NoError(t, json.Unmarshal(raw, &wrapper), "the response should be a resource wrapper")

	return wrapper.Resource
}

func fileRequest(helper *common.ProvisioningTestHelper, verb, path string) *rest.Request {
	var req *rest.Request
	switch verb {
	case "POST":
		req = helper.AdminREST.Post()
	case "PUT":
		req = helper.AdminREST.Put()
	case "DELETE":
		req = helper.AdminREST.Delete()
	default:
		req = helper.AdminREST.Get()
	}

	return req.
		Namespace("default").
		Resource("repositories").
		Name(repo).
		SubResource("files", path).
		SetHeader("Content-Type", "application/json")
}

func TestIntegrationProvisioning_LocalRepositoryProvisionsSecureValues(t *testing.T) {
	helper := env.GetCleanHelper(t)

	// Its own directory: an instance-scoped repository over the shared provisioning path claims
	// resources the other tests expect to be unmanaged.
	helper.CreateLocalRepo(t, common.TestRepo{
		Name:       repo,
		LocalPath:  filepath.Join(helper.ProvisioningPath, repo),
		SyncTarget: "folder",
		Workflows:  []string{"write"},
	})

	t.Run("a file creates the secure value and a read finds it in the store", func(t *testing.T) {
		const (
			name = "provisioned-secure-value"
			path = "provisioned-secure-value.json"
		)

		created := resource(t, fileRequest(helper, "POST", path).
			Body(secureValueFile(t, name, "provisioned", plaintext)))
		require.Equal(t, "create", created.Action, "the file should have created the secure value")
		created.requireValueNotReturned(t)

		read := resource(t, fileRequest(helper, "GET", path))
		require.Equal(t, "update", read.Action, "a second write would update, so the value is in the store")
		require.Equal(t, name, read.existingName(), "the stored secure value should come back")
		read.requireValueNotReturned(t)
	})

	t.Run("an update rotates the value and a delete removes it", func(t *testing.T) {
		const (
			name = "rotated-secure-value"
			path = "rotated-secure-value.json"
		)

		created := resource(t, fileRequest(helper, "POST", path).
			Body(secureValueFile(t, name, "before", plaintext)))
		require.Equal(t, "create", created.Action)

		rotated := resource(t, fileRequest(helper, "PUT", path).
			Body(secureValueFile(t, name, "after", "rotated-"+plaintext)))
		require.Equal(t, "update", rotated.Action, "rotating should update the stored value")
		require.Equal(t, name, rotated.existingName())

		deleted := fileRequest(helper, "DELETE", path).Do(t.Context())
		require.NoError(t, deleted.Error(), "deleting the file should succeed")

		// A create means the delete reached the secret store, not just the repository file.
		recreated := resource(t, fileRequest(helper, "POST", path).
			Body(secureValueFile(t, name, "again", plaintext)))
		require.Equal(t, "create", recreated.Action, "the deleted secure value should be gone from the store")
	})

	t.Run("a sync provisions the secure values the repository holds", func(t *testing.T) {
		const count = 2

		names := make([]string, 0, count)
		for i := range count {
			name := fmt.Sprintf("synced-secure-value-%d", i)
			names = append(names, name)
			helper.WriteToProvisioningPath(t, filepath.Join(repo, name+".json"),
				secureValueFile(t, name, fmt.Sprintf("synced %d", i), plaintext))
		}

		helper.SyncAndWait(t, repo, nil)

		for _, name := range names {
			synced := resource(t, fileRequest(helper, "GET", name+".json"))
			require.Equal(t, "update", synced.Action, "%s should have been provisioned by the sync", name)
			require.Equal(t, name, synced.existingName())
			synced.requireValueNotReturned(t)
		}
	})
}
