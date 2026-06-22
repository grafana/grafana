package playlists

import (
	"testing"

	ghmock "github.com/migueleliasweb/go-github-mock/src/mock"

	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
	"github.com/grafana/grafana/pkg/tests/testinfra"
)

// env runs a single shared Grafana server for the package with Playlist enabled as an
// active provisioning resource. Playlist ships ":disabled" by default; enabling it here
// exercises the export/sync paths that the provisioning identity must be authorized for.
var env = common.NewSharedEnv(
	common.WithoutProvisioningFolderMetadata,
	func(opts *testinfra.GrafanaOpts) {
		// Setting [provisioning] resources replaces the default set. This package only
		// needs playlists; folders remain because they are foundational to provisioning.
		opts.ProvisioningResources = []string{
			"folder.grafana.app/Folder:folder",
			"playlist.grafana.app/Playlist",
		}
		// Exercise the playlist apiserver's RBAC authorizer (playlists:read/write),
		// which the provisioning identity must satisfy for both directions.
		opts.EnableFeatureToggles = append(opts.EnableFeatureToggles, featuremgmt.FlagPlaylistsRBAC)
	},
)

func sharedHelper(t *testing.T) *common.ProvisioningTestHelper {
	t.Helper()
	helper := env.GetCleanHelper(t)
	helper.GetEnv().GithubRepoFactory.Client = ghmock.NewMockedHTTPClient()
	return helper
}

// playlistClient returns a dynamic client for playlists scoped to Org1 admin in the
// default namespace (org1). It is not part of the shared helper, so each test builds
// its own.
func playlistClient(t *testing.T, helper *common.ProvisioningTestHelper) *apis.K8sResourceClient {
	t.Helper()
	return helper.GetResourceClient(apis.ResourceClientArgs{
		User:      helper.Org1.Admin,
		Namespace: "default",
		GVR:       common.PlaylistGVR,
	})
}

func TestMain(m *testing.M) {
	env.RunTestMain(m)
}
