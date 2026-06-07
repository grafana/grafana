package common

import (
	"testing"

	authzv1 "github.com/grafana/authlib/authz/proto/v1"
	"github.com/stretchr/testify/require"

	folders "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
)

func TestNewResourceInfoFromCheck_FolderCreateUnderParentUsesParentForPermissionTarget(t *testing.T) {
	parentUID := "dfjngc949fr40e"
	r := &authzv1.CheckRequest{
		Verb:      utils.VerbCreate,
		Group:     folders.FolderResourceInfo.GroupResource().Group,
		Resource:  folders.FolderResourceInfo.GroupResource().Resource,
		Namespace: "default",
		Name:      "",
		Folder:    parentUID,
	}
	info := NewResourceInfoFromCheck(r)
	require.Equal(t, parentUID, info.name)
	require.Empty(t, info.folder)
	require.Equal(t, NewTypedIdent(TypeFolder, parentUID), info.ResourceIdent())
}

func TestNewResourceInfoFromCheck_FolderCreateAtRootUsesGeneral(t *testing.T) {
	r := &authzv1.CheckRequest{
		Verb:      utils.VerbCreate,
		Group:     folders.FolderResourceInfo.GroupResource().Group,
		Resource:  folders.FolderResourceInfo.GroupResource().Resource,
		Namespace: "default",
		Name:      "",
		Folder:    "",
	}
	info := NewResourceInfoFromCheck(r)
	require.Equal(t, accesscontrol.GeneralFolderUID, info.name)
	require.Equal(t, NewTypedIdent(TypeFolder, accesscontrol.GeneralFolderUID), info.ResourceIdent())
}
