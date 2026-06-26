package common

import (
	"testing"

	authzv1 "github.com/grafana/authlib/authz/proto/v1"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	folders "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
	iamv0alpha1 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
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

// TestResourceInfoIsValidRelation_TypedResources locks the per-type relation sets to the
// OpenFGA model. The List/Check/BatchCheck paths gate their per-object ListObjects/Check on
// IsValidRelation, so an inaccurate set makes the server issue a relation OpenFGA rejects
// (e.g. user#create). The `false` rows are the ones that matter.
func TestResourceInfoIsValidRelation_TypedResources(t *testing.T) {
	listReq := func(group, resource string) *authzv1.ListRequest {
		return &authzv1.ListRequest{Group: group, Resource: resource}
	}

	type relCase struct {
		relation string
		valid    bool
	}

	tests := []struct {
		name     string
		group    string
		resource string
		cases    []relCase
	}{
		{
			name:     "team",
			group:    iamv0alpha1.TeamResourceInfo.GroupResource().Group,
			resource: iamv0alpha1.TeamResourceInfo.GroupResource().Resource,
			cases: []relCase{
				{RelationGet, true},
				{RelationCreate, true},
				{RelationUpdate, true},
				{RelationDelete, true},
				{RelationGetPermissions, true},
				{RelationSetPermissions, true},
				{RelationSubresourceGet, true},
				{RelationSubresourceCreate, true},
				{RelationSubresourceGetPermissions, false},
				{RelationSubresourceSetPermissions, false},
			},
		},
		{
			name:     "user",
			group:    iamv0alpha1.UserResourceInfo.GroupResource().Group,
			resource: iamv0alpha1.UserResourceInfo.GroupResource().Resource,
			cases: []relCase{
				{RelationGet, true},
				{RelationCreate, false},
				{RelationUpdate, true},
				{RelationDelete, true},
				{RelationGetPermissions, true},
				{RelationSetPermissions, true},
				{RelationSubresourceGet, true},
				{RelationSubresourceGetPermissions, false},
			},
		},
		{
			name:     "service-account",
			group:    iamv0alpha1.ServiceAccountResourceInfo.GroupResource().Group,
			resource: iamv0alpha1.ServiceAccountResourceInfo.GroupResource().Resource,
			cases: []relCase{
				{RelationGet, true},
				{RelationCreate, false},
				{RelationUpdate, true},
				{RelationDelete, true},
				{RelationGetPermissions, false},
				{RelationSetPermissions, false},
				{RelationSubresourceGet, true},
				{RelationSubresourceGetPermissions, false},
			},
		},
		{
			name:     "folder",
			group:    folders.FolderResourceInfo.GroupResource().Group,
			resource: folders.FolderResourceInfo.GroupResource().Resource,
			cases: []relCase{
				{RelationGet, true},
				{RelationCreate, true},
				{RelationGetPermissions, true},
				{RelationSubresourceGetPermissions, true},
				{RelationSubresourceSetPermissions, true},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			info := NewResourceInfoFromList(listReq(tt.group, tt.resource))
			require.Equal(t, tt.name, info.Type())
			for _, c := range tt.cases {
				assert.Equalf(t, c.valid, info.IsValidRelation(c.relation),
					"%s: relation %q expected valid=%v", tt.name, c.relation, c.valid)
			}
		})
	}
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
