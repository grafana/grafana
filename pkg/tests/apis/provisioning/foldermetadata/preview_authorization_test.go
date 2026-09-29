package foldermetadata

import (
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/accesscontrol/resourcepermissions"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

// Preview reads must resolve unsynced destinations against configured-branch
// metadata without bypassing permissions on an existing resource's source.
func TestIntegrationGitFiles_PreviewAuthorizationWithFolderMetadata(t *testing.T) {
	helper := sharedGitHelper(t)
	const (
		repoName      = "metadata-preview-auth"
		branch        = "preview-authorization"
		teamUID       = "preview-team"
		sourceUID     = "preview-source"
		restrictedUID = "preview-restricted"
		newUID        = "preview-new-folder"
		deepUID       = "preview-deep-folder"
		movedDash     = "preview-moved-dashboard"
		existingDash  = "preview-existing-dashboard"
		newDash       = "preview-new-dashboard"
		spoofedDash   = "preview-spoofed-dashboard"
	)

	_, local := helper.CreateFolderTargetGitRepo(t, repoName, map[string][]byte{
		"team/_folder.json":       folderMetadataJSON(teamUID, "Team"),
		"source/_folder.json":     folderMetadataJSON(sourceUID, "Source"),
		"restricted/_folder.json": folderMetadataJSON(restrictedUID, "Restricted"),
		"source/moved.json":       common.DashboardJSON(movedDash, "Moved dashboard", 1),
		"source/existing.json":    common.DashboardJSON(existingDash, "Existing dashboard", 1),
	}, "write", "branch")
	helper.ProvisioningTestHelper.SyncAndWait(t, repoName, nil)
	helper.RequireFolders(t, repoName, teamUID, sourceUID, restrictedUID)
	helper.RequireDashboards(t, movedDash, existingDash)

	// RoleNone avoids the session checker's Viewer fallback, so these reads
	// exercise the actual folder grants rather than a built-in role grant.
	newReader := func(name string, folderUIDs ...string) apis.User {
		permissions := make([]resourcepermissions.SetResourcePermissionCommand, 0, len(folderUIDs))
		for _, uid := range folderUIDs {
			permissions = append(permissions, resourcepermissions.SetResourcePermissionCommand{
				Actions:           []string{"folders:read", "dashboards:read"},
				Resource:          "folders",
				ResourceAttribute: "uid",
				ResourceID:        uid,
			})
		}
		return helper.CreateUser(name, apis.Org1, org.RoleNone, permissions)
	}
	teamReader := newReader("MetadataPreviewTeamReader", teamUID)
	sourceReader := newReader("MetadataPreviewSourceReader", sourceUID)
	bothReader := newReader("MetadataPreviewBothReader", teamUID, sourceUID)
	configuredReader := newReader("MetadataPreviewConfiguredReader", restrictedUID)

	_, err := local.Git("checkout", "-b", branch)
	require.NoError(t, err)
	for path, data := range map[string][]byte{
		"team/new/_folder.json":      folderMetadataJSON(newUID, "New folder"),
		"team/new/deep/_folder.json": folderMetadataJSON(deepUID, "Deep folder"),
		"team/new/deep/new.json":     common.DashboardJSON(newDash, "New preview", 1),
		"restricted/spoofed.json":    common.DashboardJSON(spoofedDash, "Spoofed preview", 1),
	} {
		require.NoError(t, local.CreateFile(path, string(data)))
	}
	_, err = local.Git("mv", "source/moved.json", "team/new/deep/moved.json")
	require.NoError(t, err)
	// A readable UID supplied by the feature branch must not replace the
	// restricted UID recorded for this directory on the configured branch.
	require.NoError(t, local.UpdateFile("restricted/_folder.json", string(folderMetadataJSON(teamUID, "Spoofed team"))))
	_, err = local.Git("add", ".")
	require.NoError(t, err)
	_, err = local.Git("commit", "-m", "Add unsynced preview resources and moves")
	require.NoError(t, err)
	_, err = local.Git("push", "-u", "origin", branch)
	require.NoError(t, err)

	for _, tt := range []struct {
		name      string
		path      string
		user      apis.User
		uid       string
		kind      string
		existing  bool
		forbidden bool
	}{
		{
			name: "new dashboard inherits from existing configured ancestor",
			path: "team/new/deep/new.json", user: teamReader, uid: newDash, kind: "Dashboard",
		},
		{
			name: "new dashboard denied without ancestor access",
			path: "team/new/deep/new.json", user: sourceReader, forbidden: true,
		},
		{
			name: "new folder inherits from existing configured ancestor",
			path: "team/new/deep/_folder.json", user: teamReader, uid: deepUID, kind: "Folder",
		},
		{
			name: "new folder denied without ancestor access",
			path: "team/new/deep/_folder.json", user: sourceReader, forbidden: true,
		},
		{
			name: "moved dashboard requires source and destination ancestor access",
			path: "team/new/deep/moved.json", user: bothReader, uid: movedDash, kind: "Dashboard", existing: true,
		},
		{
			name: "readable ancestor cannot bypass dashboard source permissions",
			path: "team/new/deep/moved.json", user: teamReader, forbidden: true,
		},
		{
			name: "readable dashboard source cannot bypass ancestor permissions",
			path: "team/new/deep/moved.json", user: sourceReader, forbidden: true,
		},
		{
			name: "same folder dashboard preview keeps existing permissions",
			path: "source/existing.json", user: sourceReader, uid: existingDash, kind: "Dashboard", existing: true,
		},
		{
			name: "same folder dashboard preview denied without access",
			path: "source/existing.json", user: teamReader, forbidden: true,
		},
		{
			name: "existing folder uses its own UID rather than requiring parent access",
			path: "team/_folder.json", user: teamReader, uid: teamUID, kind: "Folder", existing: true,
		},
		{
			name: "existing folder denied without its own read permission",
			path: "team/_folder.json", user: sourceReader, forbidden: true,
		},
		{
			name: "allowed feature branch UID cannot bypass configured folder denial",
			path: "restricted/spoofed.json", user: teamReader, forbidden: true,
		},
		{
			name: "different feature and configured UIDs allow a reader of both",
			path: "restricted/spoofed.json", user: helper.Org1.Admin, uid: spoofedDash, kind: "Dashboard",
		},
		{
			name: "new resource read checks the configured folder instead of the PR supplied UID",
			path: "restricted/spoofed.json", user: configuredReader, uid: spoofedDash, kind: "Dashboard",
		},
	} {
		t.Run(tt.name, func(t *testing.T) {
			gv := provisioning.RepositoryResourceInfo.GroupVersion()
			client := tt.user.RESTClient(t, &gv)
			result := client.Get().Namespace("default").Resource("repositories").Name(repoName).
				Suffix("files/"+tt.path).Param("ref", branch).Do(t.Context())
			if tt.forbidden {
				require.True(t, apierrors.IsForbidden(result.Error()), "expected forbidden, got %v", result.Error())
				return
			}
			require.NoError(t, result.Error())
			var preview provisioning.ResourceWrapper
			require.NoError(t, result.Into(&preview))
			require.Empty(t, preview.Errors)
			require.Equal(t, branch, preview.Ref)
			require.Equal(t, tt.path, preview.Path)
			require.Equal(t, tt.kind, preview.Resource.Type.Kind)
			uid, _, err := unstructured.NestedString(preview.Resource.File.Object, "metadata", "name")
			require.NoError(t, err)
			require.Equal(t, tt.uid, uid)
			require.NotEmpty(t, preview.Resource.DryRun.Object)
			if tt.existing {
				require.Equal(t, provisioning.ResourceActionUpdate, preview.Resource.Action)
				require.NotEmpty(t, preview.Resource.Existing.Object)
			} else {
				require.Equal(t, provisioning.ResourceActionCreate, preview.Resource.Action)
				require.Empty(t, preview.Resource.Existing.Object)
			}
		})
	}

	// GET previews must not create destinations or persist the proposed moves.
	for _, uid := range []string{newUID, deepUID} {
		_, err := helper.Folders.Resource.Get(t.Context(), uid, metav1.GetOptions{})
		require.True(t, apierrors.IsNotFound(err), "preview folder %q must remain unsynced: %v", uid, err)
	}
	for _, uid := range []string{newDash, spoofedDash} {
		_, err := helper.DashboardsV1.Resource.Get(t.Context(), uid, metav1.GetOptions{})
		require.True(t, apierrors.IsNotFound(err), "preview dashboard %q must not be persisted: %v", uid, err)
	}
	for _, uid := range []string{movedDash, existingDash} {
		dashboard, err := helper.DashboardsV1.Resource.Get(t.Context(), uid, metav1.GetOptions{})
		require.NoError(t, err)
		require.Equal(t, sourceUID, dashboard.GetAnnotations()[utils.AnnoKeyFolder])
	}
}
