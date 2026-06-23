package server

import (
	"testing"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"
	"github.com/stretchr/testify/require"

	authzextv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
	"github.com/grafana/grafana/pkg/services/authz/zanzana/common"
)

func TestIsGrantTuple(t *testing.T) {
	tests := []struct {
		name     string
		object   string
		relation string
		want     bool
	}{
		{
			name:     "team membership admin is not a grant",
			object:   common.NewTupleEntry(common.TypeTeam, "team-1", ""),
			relation: common.RelationTeamAdmin,
			want:     false,
		},
		{
			name:     "team membership member is not a grant",
			object:   common.NewTupleEntry(common.TypeTeam, "team-1", ""),
			relation: common.RelationTeamMember,
			want:     false,
		},
		{
			name:     "folder admin action set is a grant",
			object:   common.NewTupleEntry(common.TypeFolder, "fold-1", ""),
			relation: common.RelationSetAdmin,
			want:     true,
		},
		{
			name:     "group_resource admin action set is a grant",
			object:   common.NewTupleEntry(common.TypeGroupResouce, dashboardGroup+"/"+dashboardResource, ""),
			relation: common.RelationSetAdmin,
			want:     true,
		},
		{
			name:     "folder parent is not a grant",
			object:   common.NewTupleEntry(common.TypeFolder, "fold-1", ""),
			relation: common.RelationParent,
			want:     false,
		},
		{
			name:     "role assignment is not a grant",
			object:   common.NewTupleEntry(common.TypeRole, "role-1", ""),
			relation: common.RelationAssignee,
			want:     false,
		},
		{
			name:     "resource get is a grant",
			object:   common.NewTupleEntry(common.TypeResource, dashboardGroup+"/"+dashboardResource+"/dash-1", ""),
			relation: common.RelationGet,
			want:     true,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := isGrantTuple(&openfgav1.TupleKey{Object: tc.object, Relation: tc.relation})
			require.Equal(t, tc.want, got)
		})
	}
}

func TestListUserPermissions_ReturnsDirectAndRoleGrants(t *testing.T) {
	srv := setupOpenFGAServer(t)

	const (
		userUID   = "user-perm-test"
		teamUID   = "team-perm-test"
		roleUID   = "role-perm-test"
		dashUID   = "dash-perm-test"
		folderUID = "folder-perm-test"
	)

	tuples := []*openfgav1.TupleKey{
		common.NewResourceTuple(
			common.NewTupleEntry(common.TypeUser, userUID, ""),
			common.RelationGet,
			dashboardGroup,
			dashboardResource,
			"",
			dashUID,
		),
		common.NewFolderTuple(
			common.NewTupleEntry(common.TypeUser, userUID, ""),
			common.RelationGet,
			folderUID,
		),
		{
			User:     common.NewTupleEntry(common.TypeUser, userUID, ""),
			Relation: common.RelationAssignee,
			Object:   common.NewTupleEntry(common.TypeRole, roleUID, ""),
		},
		common.NewGroupResourceTuple(
			common.NewTupleEntry(common.TypeRole, roleUID, common.RelationAssignee),
			common.RelationGet,
			dashboardGroup,
			dashboardResource,
			"",
		),
		common.NewResourceTuple(
			common.NewTupleEntry(common.TypeTeam, teamUID, common.RelationTeamMember),
			common.RelationGet,
			dashboardGroup,
			dashboardResource,
			"",
			"team-dash",
		),
		{
			User:     common.NewTupleEntry(common.TypeTeam, teamUID, common.RelationTeamMember),
			Relation: common.RelationAssignee,
			Object:   common.NewTupleEntry(common.TypeRole, roleUID, ""),
		},
	}

	setupOpenFGADatabase(t, srv, tuples)

	resp, err := srv.Query(newContextWithNamespace(), &authzextv1.QueryRequest{
		Namespace: namespace,
		Operation: &authzextv1.QueryOperation{
			Operation: &authzextv1.QueryOperation_ListUserPermissions{
				ListUserPermissions: &authzextv1.ListUserPermissionsQuery{
					Subject: common.NewTupleEntry(common.TypeUser, userUID, ""),
					Teams:   []string{teamUID},
				},
			},
		},
	})
	require.NoError(t, err)

	result := resp.GetUserPermissions()
	require.NotNil(t, result)
	require.NotEmpty(t, result.GetGrants())

	grantKeys := make(map[string]struct{})
	for _, grant := range result.GetGrants() {
		grantKeys[grant.GetUser()+"|"+grant.GetRelation()+"|"+grant.GetObject()] = struct{}{}
	}

	require.Contains(t, grantKeys, common.NewTupleEntry(common.TypeUser, userUID, "")+"|"+common.RelationGet+"|"+common.NewResourceIdent(dashboardGroup, dashboardResource, "", dashUID))
	require.Contains(t, grantKeys, common.NewTupleEntry(common.TypeUser, userUID, "")+"|"+common.RelationGet+"|"+common.NewFolderIdent(folderUID))
	require.Contains(t, grantKeys, common.NewTupleEntry(common.TypeRole, roleUID, common.RelationAssignee)+"|"+common.RelationGet+"|"+common.NewGroupResourceIdent(dashboardGroup, dashboardResource, ""))
	require.Contains(t, grantKeys, common.NewTupleEntry(common.TypeTeam, teamUID, common.RelationTeamMember)+"|"+common.RelationGet+"|"+common.NewResourceIdent(dashboardGroup, dashboardResource, "", "team-dash"))

	// Role binding tuples themselves are not permission grants.
	require.NotContains(t, grantKeys, common.NewTupleEntry(common.TypeUser, userUID, "")+"|"+common.RelationAssignee+"|"+common.NewTupleEntry(common.TypeRole, roleUID, ""))
}

func TestListUserPermissions_EmptySubject(t *testing.T) {
	srv := setupOpenFGAServer(t)

	_, err := srv.Query(newContextWithNamespace(), &authzextv1.QueryRequest{
		Namespace: namespace,
		Operation: &authzextv1.QueryOperation{
			Operation: &authzextv1.QueryOperation_ListUserPermissions{
				ListUserPermissions: &authzextv1.ListUserPermissionsQuery{},
			},
		},
	})
	require.Error(t, err)
}
