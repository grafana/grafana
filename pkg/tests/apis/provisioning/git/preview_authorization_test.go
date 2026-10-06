package git

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
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
				Suffix("files/"+tt.path).
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

func TestIntegrationGitFiles_PreviewRootAcrossTargets(t *testing.T) {
	for _, target := range []string{"folder", "instance", "folderless"} {
		t.Run(target, func(t *testing.T) {
			helper := sharedGitHelper(t)
			repoName := "hash-preview-root-" + target
			const (
				branch = "feature-preview"
				path   = "new/deep/dashboard.json"
				uid    = "hash-preview-root"
			)

			createRepo := helper.CreateFolderTargetGitRepo
			switch target {
			case "instance":
				createRepo = helper.CreateGitRepo
			case "folderless":
				createRepo = helper.CreateFolderlessTargetGitRepo
			}
			_, local := createRepo(t, repoName, nil, "write", "branch")
			rootGrant := resourcepermissions.SetResourcePermissionCommand{
				Actions: []string{"dashboards:read"}, Resource: "dashboards", ResourceAttribute: "uid", ResourceID: uid,
			}
			if target == "folder" {
				helper.ProvisioningTestHelper.SyncAndWait(t, repoName, nil)
				helper.RequireFolders(t, repoName)
				rootGrant.Resource, rootGrant.ResourceID = "folders", repoName
			}
			_, err := local.Git("checkout", "-b", branch)
			require.NoError(t, err)
			require.NoError(t, local.CreateFile(path, string(common.DashboardJSON(uid, "Root preview", 1))))
			_, err = local.Git("add", ".")
			require.NoError(t, err)
			_, err = local.Git("commit", "-m", "Add dashboard below unsynced directories")
			require.NoError(t, err)
			_, err = local.Git("push", "origin", branch)
			require.NoError(t, err)

			missingFolders := []string{
				resources.ParseFolder("new/", repoName).ID,
				resources.ParseFolder("new/deep/", repoName).ID,
			}
			if target != "folder" {
				missingFolders = append(missingFolders, repoName)
			}
			helper.RequireFoldersNotFound(t, missingFolders...)
			helper.RequireDashboardsNotFound(t, uid)

			for _, tt := range []struct {
				name        string
				role        org.RoleType
				permissions []resourcepermissions.SetResourcePermissionCommand
				allowed     bool
			}{
				{name: "root-grant", role: org.RoleNone, permissions: []resourcepermissions.SetResourcePermissionCommand{rootGrant}, allowed: true},
				{name: "no-grant", role: org.RoleNone},
				{name: "general-only", role: org.RoleNone, permissions: []resourcepermissions.SetResourcePermissionCommand{{
					Actions: []string{"folders:read", "dashboards:read"}, Resource: "folders", ResourceAttribute: "uid", ResourceID: "general",
				}}},
				{name: "unrelated-folder", role: org.RoleNone, permissions: []resourcepermissions.SetResourcePermissionCommand{{
					Actions: []string{"folders:read", "dashboards:read"}, Resource: "folders", ResourceAttribute: "uid", ResourceID: "unrelated-folder",
				}}},
				{name: "viewer", role: org.RoleViewer, allowed: true},
			} {
				t.Run(tt.name, func(t *testing.T) {
					reader := helper.CreateUser(repoName+"-"+tt.name, apis.Org1, tt.role, tt.permissions)
					gv := provisioning.RepositoryResourceInfo.GroupVersion()
					result := reader.RESTClient(t, &gv).Get().Namespace("default").Resource("repositories").Name(repoName).
						Suffix("files/"+path).Param("ref", branch).Do(t.Context())
					if tt.allowed {
						require.NoError(t, result.Error())
						var preview provisioning.ResourceWrapper
						require.NoError(t, result.Into(&preview))
						require.Empty(t, preview.Errors)
						require.Equal(t, uid, common.MustNestedString(preview.Resource.File.Object, "metadata", "name"))
						require.Empty(t, preview.Resource.Existing.Object)
					} else {
						require.True(t, apierrors.IsForbidden(result.Error()), "expected forbidden, got %v", result.Error())
					}
					helper.RequireFoldersNotFound(t, missingFolders...)
					helper.RequireDashboardsNotFound(t, uid)
				})
			}

			t.Run("readable unmanaged decoy blocks root fallback", func(t *testing.T) {
				decoyUID := resources.ParseFolder("new/deep/", repoName).ID
				helper.CreateUnmanagedFolderWithName(t, decoyUID, "Readable decoy", "")
				reader := helper.CreateUser(repoName+"-decoy-reader", apis.Org1, org.RoleNone, []resourcepermissions.SetResourcePermissionCommand{rootGrant, {
					Actions: []string{"folders:read", "dashboards:read"}, Resource: "folders", ResourceAttribute: "uid", ResourceID: decoyUID,
				}})
				gv := provisioning.RepositoryResourceInfo.GroupVersion()
				result := reader.RESTClient(t, &gv).Get().Namespace("default").Resource("repositories").Name(repoName).
					Suffix("files/"+path).Param("ref", branch).Do(t.Context())
				require.True(t, apierrors.IsForbidden(result.Error()), "expected forbidden, got %v", result.Error())
				require.ErrorContains(t, result.Error(), "folder does not belong to the configured repository path")
				decoy, err := helper.Folders.Resource.Get(t.Context(), decoyUID, metav1.GetOptions{})
				require.NoError(t, err)
				require.Empty(t, decoy.GetAnnotations()[utils.AnnoKeyManagerIdentity])
				helper.RequireFoldersNotFound(t, resources.ParseFolder("new/", repoName).ID)
				helper.RequireDashboardsNotFound(t, uid)
			})
		})
	}
}

func TestIntegrationGitFiles_ConfiguredBranchReadWithoutSyncedFolders(t *testing.T) {
	helper := sharedGitHelper(t)
	const repoName = "configured-read-unsynced"
	const uid = "configured-read-dashboard"
	const path = "team/dashboard.json"
	helper.CreateFolderTargetGitRepo(t, repoName, map[string][]byte{
		path: common.DashboardJSON(uid, "Read before sync", 1),
	}, "write", "branch")
	for _, ref := range []string{"", "main"} {
		t.Run("ref="+ref, func(t *testing.T) {
			raw, err := helper.AdminREST.Get().Namespace("default").Resource("repositories").Name(repoName).
				Suffix("files/"+path).Param("ref", ref).Do(t.Context()).Raw()
			require.NoError(t, err)
			var wrapper provisioning.ResourceWrapper
			require.NoError(t, json.Unmarshal(raw, &wrapper))
			require.Empty(t, wrapper.Errors)
			require.Equal(t, uid, common.MustNestedString(wrapper.Resource.File.Object, "metadata", "name"))
			helper.RequireFoldersNotFound(t, repoName, resources.ParseFolder("team/", repoName).ID)
			helper.RequireDashboardsNotFound(t, uid)
		})
	}
}

func TestIntegrationGitFiles_PreviewWithoutRepositoryRoot(t *testing.T) {
	helper := sharedGitHelper(t)
	const (
		repoName = "hash-preview-missing-root"
		branch   = "feature-preview"
		path     = "new/deep/dashboard.json"
		uid      = "hash-preview-missing-root"
	)
	_, local := helper.CreateFolderTargetGitRepo(t, repoName, nil, "write", "branch")
	_, err := local.Git("checkout", "-b", branch)
	require.NoError(t, err)
	require.NoError(t, local.CreateFile(path, string(common.DashboardJSON(uid, "Preview without a wrapper", 1))))
	_, err = local.Git("add", ".")
	require.NoError(t, err)
	_, err = local.Git("commit", "-m", "Add dashboard before syncing the repository")
	require.NoError(t, err)
	_, err = local.Git("push", "origin", branch)
	require.NoError(t, err)

	result := helper.AdminREST.Get().Namespace("default").Resource("repositories").Name(repoName).
		Suffix("files/"+path).Param("ref", branch).Do(t.Context())
	require.True(t, apierrors.IsForbidden(result.Error()), "expected forbidden even for an admin, got %v", result.Error())
	require.ErrorContains(t, result.Error(), "no existing folder for preview authorization")
	helper.RequireFoldersNotFound(t, repoName, resources.ParseFolder("new/", repoName).ID, resources.ParseFolder("new/deep/", repoName).ID)
	helper.RequireDashboardsNotFound(t, uid)
}
