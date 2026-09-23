package isolated

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"

	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
	pt "github.com/grafana/grafana/pkg/tests/apis/provisioning/permissions/testutil"
	"github.com/grafana/grafana/pkg/tests/testinfra"
)

// Explicit grants cannot enable disabled metadata, export, or performance features.
// Confirm rejection before jobs are queued while retaining legacy raw-file read access.
func TestIntegrationProvisioning_NoneFeatureRestrictions(t *testing.T) {
	h := common.RunGrafana(t, common.WithoutProvisioningFolderMetadata, common.WithoutExportFeatureFlag)
	pt.Write(t, h, "nested/README.md", []byte("Read me"))
	repo := pt.LocalRepo(t, h, "folder")
	u := pt.None(t, h, pt.Actions("provisioning.jobs:create", "provisioning.repositories:write", "dashboards:read", "dashboards:create", "dashboards:delete", "folders:read", "folders:create", "folders:write", "folders:delete")...)
	for _, version := range pt.Versions {
		for _, action := range []string{"push", "migrate", "test", "fixFolderMetadata"} {
			t.Run(version+"/"+action, func(t *testing.T) {
				spec := map[string]any{"action": action, action: map[string]any{}}
				if action == "test" {
					spec[action] = map[string]any{"duration": "1ms"}
				}
				before := pt.JobCount(t, h)
				pt.Do(t, u, "POST", version, "repositories/"+repo+"/jobs", spec).Require(t, 400)
				require.Equal(t, before, pt.JobCount(t, h))
			})
		}
		pt.Do(t, u, "PUT", version, "repositories/"+repo+"/files/nested/", pt.Folder(pt.Name(), "Changed")).Require(t, 405)
		_, err := os.Stat(filepath.Join(h.ProvisioningPath, "nested/_folder.json"))
		require.True(t, os.IsNotExist(err))
		require.Contains(t, string(pt.Do(t, u, "GET", version, "repositories/"+repo+"/files/nested/README.md", nil).Require(t, 200).Body), "Read me")
	}
}

// Configure playlists to verify that file authorization also uses the corresponding
// resource action for kinds beyond dashboards and folders, not repository-read access.
func TestIntegrationProvisioning_NoneGenericResourceRead(t *testing.T) {
	h := common.RunGrafana(t, func(o *testinfra.GrafanaOpts) {
		o.ProvisioningResources = []string{"folder.grafana.app/Folder:folder", "dashboard.grafana.app/Dashboard:folder", "playlist.grafana.app/Playlist"}
		o.EnableFeatureToggles = append(o.EnableFeatureToggles, "playlistsRBAC")
		if o.UnifiedStorageConfig == nil {
			o.UnifiedStorageConfig = map[string]setting.UnifiedStorageConfig{}
		}
		o.UnifiedStorageConfig["playlists.playlist.grafana.app"] = setting.UnifiedStorageConfig{DualWriterMode: grafanarest.Mode5}
	})
	uid := pt.Name()
	manifest := map[string]any{"apiVersion": "playlist.grafana.app/v1", "kind": "Playlist", "metadata": map[string]any{"name": uid}, "spec": map[string]any{"title": "Permission playlist", "interval": "5m", "items": []any{map[string]any{"type": "dashboard_by_tag", "value": "provisioning"}}}}
	pt.Write(t, h, "playlist.json", manifest)
	repo := pt.LocalRepo(t, h, "folder")
	for _, version := range pt.Versions {
		for _, grant := range []string{"none", "repository", "playlist"} {
			t.Run(version+"/"+grant, func(t *testing.T) {
				var actions []string
				if grant == "repository" {
					actions = []string{"provisioning.repositories:read"}
				}
				if grant == "playlist" {
					actions = []string{"playlists:read"}
				}
				u := pt.None(t, h, pt.Actions(actions...)...)
				rsp := pt.Do(t, u, "GET", version, "repositories/"+repo+"/files/playlist.json", nil)
				if grant == "playlist" {
					rsp.Require(t, 200)
					require.Contains(t, string(rsp.Body), "Permission playlist")
				} else {
					rsp.Require(t, 403)
				}
			})
		}
	}
}
