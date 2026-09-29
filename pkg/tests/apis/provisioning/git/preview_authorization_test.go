package git

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	"github.com/grafana/grafana/pkg/services/accesscontrol/resourcepermissions"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

func TestIntegrationGitFiles_PreviewUnsyncedFolders(t *testing.T) {
	helper := sharedGitHelper(t)
	const (
		repoName = "hash-preview-ancestor"
		branch   = "feature-preview"
		title    = "Unsynced dashboard preview"
	)

	_, local := helper.CreateFolderTargetGitRepo(t, repoName, map[string][]byte{
		"team/existing.json": common.DashboardJSON("hash-preview-existing", "Existing dashboard", 1),
	}, "write", "branch")
	helper.ProvisioningTestHelper.SyncAndWait(t, repoName, nil)
	teamUID := resources.ParseFolder("team/", repoName).ID
	helper.RequireFolders(t, repoName, teamUID)

	_, err := local.Git("checkout", "-b", branch)
	require.NoError(t, err)
	require.NoError(t, local.CreateFile("team/new/deep/dashboard.json", string(common.DashboardJSON("hash-preview-team", title, 1))))
	require.NoError(t, local.CreateFile("new/deep/dashboard.json", string(common.DashboardJSON("hash-preview-root", title, 1))))
	_, err = local.Git("add", ".")
	require.NoError(t, err)
	_, err = local.Git("commit", "-m", "Add dashboards in unsynced folders")
	require.NoError(t, err)
	_, err = local.Git("push", "origin", branch)
	require.NoError(t, err)

	missingFolders := []string{
		resources.ParseFolder("team/new/", repoName).ID,
		resources.ParseFolder("team/new/deep/", repoName).ID,
		resources.ParseFolder("new/", repoName).ID,
		resources.ParseFolder("new/deep/", repoName).ID,
	}
	helper.RequireFoldersNotFound(t, missingFolders...)
	helper.RequireDashboardsNotFound(t, "hash-preview-team", "hash-preview-root")

	for _, tt := range []struct {
		name     string
		userName string
		folder   string
		path     string
		uid      string
		allowed  bool
	}{
		{
			name:     "read permission on the nearest existing ancestor",
			userName: "hash-preview-team-reader",
			folder:   teamUID,
			path:     "team/new/deep/dashboard.json",
			uid:      "hash-preview-team",
			allowed:  true,
		},
		{
			name:     "read permission on the synced repository root",
			userName: "hash-preview-root-reader",
			folder:   repoName,
			path:     "new/deep/dashboard.json",
			uid:      "hash-preview-root",
			allowed:  true,
		},
		{
			name:     "no ancestor grant",
			userName: "hash-preview-no-grants",
			path:     "team/new/deep/dashboard.json",
			uid:      "hash-preview-team",
		},
	} {
		t.Run(tt.name, func(t *testing.T) {
			var permissions []resourcepermissions.SetResourcePermissionCommand
			if tt.folder != "" {
				permissions = []resourcepermissions.SetResourcePermissionCommand{{
					Actions:           []string{"dashboards:read", "folders:read"},
					Resource:          "folders",
					ResourceAttribute: "uid",
					ResourceID:        tt.folder,
				}}
			}
			user := helper.CreateUser(tt.userName, apis.Org1, org.RoleNone, permissions)
			gv := provisioning.RepositoryResourceInfo.GroupVersion()
			client := user.RESTClient(t, &gv)
			result := client.Get().
				Namespace("default").
				Resource("repositories").
				Name(repoName).
				SubResource("files", tt.path).
				Param("ref", branch).
				Do(t.Context())

			if tt.allowed {
				raw, err := result.Raw()
				require.NoError(t, err)
				var wrapper provisioning.ResourceWrapper
				require.NoError(t, json.Unmarshal(raw, &wrapper))
				require.Empty(t, wrapper.Errors)
				require.Equal(t, tt.uid, common.MustNestedString(wrapper.Resource.File.Object, "metadata", "name"))
				require.Equal(t, title, common.MustNestedString(wrapper.Resource.File.Object, "spec", "title"))
				require.Empty(t, wrapper.Resource.Existing.Object)
			} else {
				require.True(t, apierrors.IsForbidden(result.Error()), "expected forbidden, got %v", result.Error())
			}

			helper.RequireFoldersNotFound(t, missingFolders...)
			helper.RequireDashboardsNotFound(t, "hash-preview-team", "hash-preview-root")
		})
	}
}

func TestIntegrationGitFiles_PreviewWithoutExistingAncestor(t *testing.T) {
	for _, target := range []string{"folder", "instance"} {
		t.Run(target, func(t *testing.T) {
			helper := sharedGitHelper(t)
			repoName := "hash-preview-no-ancestor-" + target
			const (
				branch = "feature-preview"
				path   = "new/deep/dashboard.json"
				uid    = "hash-preview-no-ancestor"
			)

			createRepo := helper.CreateFolderTargetGitRepo
			if target == "instance" {
				createRepo = helper.CreateGitRepo
			}
			_, local := createRepo(t, repoName, nil, "write", "branch")
			_, err := local.Git("checkout", "-b", branch)
			require.NoError(t, err)
			require.NoError(t, local.CreateFile(path, string(common.DashboardJSON(uid, "Preview without an ancestor", 1))))
			_, err = local.Git("add", ".")
			require.NoError(t, err)
			_, err = local.Git("commit", "-m", "Add dashboard before syncing the repository")
			require.NoError(t, err)
			_, err = local.Git("push", "origin", branch)
			require.NoError(t, err)

			missingFolders := []string{
				repoName,
				resources.ParseFolder("new/", repoName).ID,
				resources.ParseFolder("new/deep/", repoName).ID,
			}
			helper.RequireFoldersNotFound(t, missingFolders...)
			helper.RequireDashboardsNotFound(t, uid)

			result := helper.AdminREST.Get().
				Namespace("default").
				Resource("repositories").
				Name(repoName).
				SubResource("files", path).
				Param("ref", branch).
				Do(t.Context())
			require.True(t, apierrors.IsForbidden(result.Error()), "expected forbidden even for an admin, got %v", result.Error())
			require.ErrorContains(t, result.Error(), "no existing folder for read authorization")

			helper.RequireFoldersNotFound(t, missingFolders...)
			helper.RequireDashboardsNotFound(t, uid)
		})
	}
}
