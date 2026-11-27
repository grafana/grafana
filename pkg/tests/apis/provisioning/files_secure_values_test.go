package provisioning

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

// The fixture is a v1 dashboard carrying a secure block because no file-backed kind
// declares inline secure values yet: provisioning keys off the field, not the kind, and
// v1 dashboards are exempt from strict validation, so only the repository file keeps it.
func TestIntegrationProvisioning_FileUpdateKeepsSecureValues(t *testing.T) {
	helper := sharedHelper(t)

	const (
		repo      = "secure-values-repo"
		plaintext = "s3cr3t"
	)
	helper.CreateLocalRepo(t, common.TestRepo{
		Name:       repo,
		SyncTarget: "instance",
		Workflows:  []string{"write"},
	})

	dashboard := func(name, title string, secure map[string]any) []byte {
		obj := map[string]any{
			"apiVersion": "dashboard.grafana.app/v1",
			"kind":       "Dashboard",
			"metadata":   map[string]any{"name": name},
			"spec":       map[string]any{"title": title},
		}
		if secure != nil {
			obj["secure"] = secure
		}
		data, err := json.Marshal(obj)
		require.NoError(t, err, "should marshal the dashboard body")
		return data
	}

	committedFile := func(t *testing.T, path string) map[string]any {
		t.Helper()
		data, err := os.ReadFile(filepath.Join(helper.ProvisioningPath, path)) //nolint:gosec // a path the test itself wrote into the provisioning directory
		require.NoError(t, err, "the committed file should be readable")
		var file map[string]any
		require.NoError(t, json.Unmarshal(data, &file), "the committed file should be valid JSON")
		return file
	}

	for i, tt := range []struct {
		name   string
		update map[string]any
		want   map[string]any
	}{
		{
			name:   "a reference the update carries is written as it stands",
			update: map[string]any{"token": map[string]any{"name": "inline-abc"}},
			want:   map[string]any{"token": map[string]any{"name": "inline-abc"}},
		},
		{
			name:   "an omitted secure block keeps the committed plaintext",
			update: nil,
			want:   map[string]any{"token": map[string]any{"create": plaintext}},
		},
		{
			name:   "a new plaintext replaces the committed one",
			update: map[string]any{"token": map[string]any{"create": "rotated"}},
			want:   map[string]any{"token": map[string]any{"create": "rotated"}},
		},
		{
			name:   "an explicit removal drops the committed plaintext",
			update: map[string]any{"token": map[string]any{"remove": true}},
			want:   map[string]any{"token": map[string]any{"remove": true}},
		},
	} {
		t.Run(tt.name, func(t *testing.T) {
			name := fmt.Sprintf("secure-values-%d", i)
			path := name + ".json"

			created := helper.AdminREST.Post().
				Namespace("default").
				Resource("repositories").
				Name(repo).
				SubResource("files", path).
				Body(dashboard(name, "Secure values", map[string]any{
					"token": map[string]any{"create": plaintext},
				})).
				SetHeader("Content-Type", "application/json").
				Do(t.Context())
			require.NoError(t, created.Error(), "creating the file should succeed")
			require.Equal(t,
				map[string]any{"token": map[string]any{"create": plaintext}},
				committedFile(t, path)["secure"],
				"the created file should hold the plaintext it was given")

			updated := helper.AdminREST.Put().
				Namespace("default").
				Resource("repositories").
				Name(repo).
				SubResource("files", path).
				Body(dashboard(name, "Secure values updated", tt.update)).
				SetHeader("Content-Type", "application/json").
				Do(t.Context())
			require.NoError(t, updated.Error(), "updating the file should succeed")

			file := committedFile(t, path)
			require.Equal(t, tt.want, file["secure"])
			require.Equal(t, "Secure values updated", file["spec"].(map[string]any)["title"],
				"the rest of the update must still land")
		})
	}

	t.Run("a move carrying new content keeps the moved file's plaintext", func(t *testing.T) {
		const (
			name   = "secure-values-moved"
			source = "secure-values-move-source.json"
			target = "secure-values-move-target.json"
		)

		created := helper.AdminREST.Post().
			Namespace("default").
			Resource("repositories").
			Name(repo).
			SubResource("files", source).
			Body(dashboard(name, "Secure values", map[string]any{
				"token": map[string]any{"create": plaintext},
			})).
			SetHeader("Content-Type", "application/json").
			Do(t.Context())
		require.NoError(t, created.Error(), "creating the file to move should succeed")

		resp := helper.PostFilesRequest(t, repo, common.FilesPostOptions{
			TargetPath:   target,
			OriginalPath: source,
			Message:      "move with new content",
			Body:         string(dashboard(name, "Secure values moved", nil)),
		})
		// nolint:errcheck
		defer resp.Body.Close()
		require.Equal(t, http.StatusOK, resp.StatusCode, "the move should succeed")

		file := committedFile(t, target)
		require.Equal(t,
			map[string]any{"token": map[string]any{"create": plaintext}},
			file["secure"],
			"the moved file must keep the plaintext of the file it came from")
		require.Equal(t, "Secure values moved", file["spec"].(map[string]any)["title"])
	})
}
