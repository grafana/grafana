package server

import (
	"testing"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"
	"github.com/stretchr/testify/require"

	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
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

func TestGrantObjectPrefixesForTypes(t *testing.T) {
	dashboardType := &authzextv1.ResourceType{Group: dashboardGroup, Resource: dashboardResource}
	teamType := &authzextv1.ResourceType{
		Group:    iamv0.TeamResourceInfo.GroupResource().Group,
		Resource: iamv0.TeamResourceInfo.GroupResource().Resource,
	}

	t.Run("unfiltered retains all scans", func(t *testing.T) {
		require.Equal(t, grantObjectPrefixes, grantObjectPrefixesForTypes(nil))
	})

	t.Run("filters to requested resource scans and folders", func(t *testing.T) {
		dashboardGroupResource := common.FormatGroupResource(dashboardType.GetGroup(), dashboardType.GetResource(), "")
		require.Equal(t, []string{
			common.TypeFolderPrefix,
			common.TypeGroupResoucePrefix + dashboardGroupResource,
			common.TypeResourcePrefix + dashboardGroupResource + "/",
		}, grantObjectPrefixesForTypes([]*authzextv1.ResourceType{dashboardType}))
	})

	t.Run("includes typed object scan for IAM resources", func(t *testing.T) {
		teamGroupResource := common.FormatGroupResource(teamType.GetGroup(), teamType.GetResource(), "")
		require.Equal(t, []string{
			common.TypeFolderPrefix,
			common.TypeGroupResoucePrefix + teamGroupResource,
			common.TypeResourcePrefix + teamGroupResource + "/",
			common.TypeTeamPrefix,
		}, grantObjectPrefixesForTypes([]*authzextv1.ResourceType{teamType}))
	})

	t.Run("deduplicates and skips invalid types", func(t *testing.T) {
		require.Equal(t, []string{common.TypeFolderPrefix},
			grantObjectPrefixesForTypes([]*authzextv1.ResourceType{{}, nil}))
	})
}

func TestGetGrants_ReturnsDirectAndRoleGrants(t *testing.T) {
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
			Operation: &authzextv1.QueryOperation_GetGrants{
				GetGrants: &authzextv1.GetGrantsQuery{
					Subject: common.NewTupleEntry(common.TypeUser, userUID, ""),
					Teams:   []string{teamUID},
				},
			},
		},
	})
	require.NoError(t, err)

	result := resp.GetGrants()
	require.NotNil(t, result)
	require.Equal(t, common.NormalizeGrantTuples(common.ToAuthzExtTupleKeys(tuples), nil), result)
}

func TestGetGrants_EmptySubject(t *testing.T) {
	srv := setupOpenFGAServer(t)

	_, err := srv.Query(newContextWithNamespace(), &authzextv1.QueryRequest{
		Namespace: namespace,
		Operation: &authzextv1.QueryOperation{
			Operation: &authzextv1.QueryOperation_GetGrants{
				GetGrants: &authzextv1.GetGrantsQuery{},
			},
		},
	})
	require.Error(t, err)
}
