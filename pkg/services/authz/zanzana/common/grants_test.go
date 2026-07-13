package common

import (
	"testing"

	"github.com/stretchr/testify/require"

	authzextv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
)

func TestNormalizeGrantTuples_MergesFourGrantSections(t *testing.T) {
	folderResource := NewFolderResourceTuple("user:u1", RelationGet, dashboardGroup, dashboardResource, "", "folder-1")
	secondFolderResource := NewFolderResourceTuple("team:t1#member", RelationUpdate, dashboardGroup, dashboardResource, "", "folder-1")

	result := NormalizeGrantTuples([]*authzextv1.TupleKey{
		ToAuthzExtTupleKey(NewGroupResourceTuple("user:u1", RelationSetView, dashboardGroup, dashboardResource, "")),
		ToAuthzExtTupleKey(NewGroupResourceTuple("role:r1#assignee", RelationGet, dashboardGroup, dashboardResource, "")),
		ToAuthzExtTupleKey(NewFolderTuple("user:u1", RelationSetEdit, "folder-1")),
		ToAuthzExtTupleKey(NewFolderTuple("team:t1#member", RelationGet, "folder-1")),
		ToAuthzExtTupleKey(folderResource),
		ToAuthzExtTupleKey(secondFolderResource),
		ToAuthzExtTupleKey(NewResourceTuple("user:u1", RelationGet, dashboardGroup, dashboardResource, "", "dashboard-1")),
		ToAuthzExtTupleKey(NewTypedTuple(TypeTeam, "user:u1", RelationGet, "team-1")),
	}, nil)

	require.Equal(t, &authzextv1.GetGrantsResult{
		GlobalGrants: []*authzextv1.GlobalGrant{{
			Type:       &authzextv1.ResourceType{Group: dashboardGroup, Resource: dashboardResource},
			Permission: &authzextv1.GrantPermission{Level: RelationSetView, AdditionalVerbs: []string{RelationGet}},
		}},
		FolderGrants: []*authzextv1.FolderGrant{{
			FolderUid:  "folder-1",
			Permission: &authzextv1.GrantPermission{Level: RelationSetEdit, AdditionalVerbs: []string{RelationGet}},
		}},
		FolderResourceGrants: []*authzextv1.FolderResourceGrant{{
			FolderUid:  "folder-1",
			Type:       &authzextv1.ResourceType{Group: dashboardGroup, Resource: dashboardResource},
			Permission: &authzextv1.GrantPermission{AdditionalVerbs: []string{RelationGet, RelationUpdate}},
		}},
		ResourceGrants: []*authzextv1.ResourceGrant{
			{
				Type:       &authzextv1.ResourceType{Group: dashboardGroup, Resource: dashboardResource},
				Name:       "dashboard-1",
				Permission: &authzextv1.GrantPermission{AdditionalVerbs: []string{RelationGet}},
			},
			{
				Type:       &authzextv1.ResourceType{Group: iamGroup, Resource: teamsResource},
				Name:       "team-1",
				Permission: &authzextv1.GrantPermission{AdditionalVerbs: []string{RelationGet}},
			},
		},
	}, result)
}

func TestNormalizeGrantTuples_FiltersResourceTypesAndKeepsGenericFolderGrants(t *testing.T) {
	result := NormalizeGrantTuples([]*authzextv1.TupleKey{
		ToAuthzExtTupleKey(NewFolderTuple("user:u1", RelationSubresourceSetView, "folder-1")),
		ToAuthzExtTupleKey(NewFolderResourceTuple("user:u1", RelationGet, dashboardGroup, dashboardResource, "", "folder-1")),
		ToAuthzExtTupleKey(NewResourceTuple("user:u1", RelationGet, dashboardGroup, dashboardResource, "", "dashboard-1")),
	}, []*authzextv1.ResourceType{{Group: iamGroup, Resource: teamsResource}})

	require.Empty(t, result.GetGlobalGrants())
	require.Empty(t, result.GetFolderGrants())
	require.Len(t, result.GetFolderResourceGrants(), 1)
	require.True(t, result.GetFolderResourceGrants()[0].GetAllResourceTypes())
	require.Empty(t, result.GetResourceGrants())
}

func TestNormalizeGrantTuples_TypedResourceObjects(t *testing.T) {
	result := NormalizeGrantTuples([]*authzextv1.TupleKey{
		ToAuthzExtTupleKey(NewTypedTuple(TypeUser, "user:u1", RelationGet, "user-1")),
		ToAuthzExtTupleKey(NewTypedTuple(TypeServiceAccount, "user:u1", RelationGet, "service-account-1")),
	}, nil)

	require.Equal(t, []*authzextv1.ResourceGrant{
		{
			Type:       &authzextv1.ResourceType{Group: iamGroup, Resource: KindServiceAccounts},
			Name:       "service-account-1",
			Permission: &authzextv1.GrantPermission{AdditionalVerbs: []string{RelationGet}},
		},
		{
			Type:       &authzextv1.ResourceType{Group: iamGroup, Resource: usersResource},
			Name:       "user-1",
			Permission: &authzextv1.GrantPermission{AdditionalVerbs: []string{RelationGet}},
		},
	}, result.GetResourceGrants())
}

func TestNormalizeGrantTuples_PreservesMultiResourceFolderConditions(t *testing.T) {
	dashboards := NewFolderResourceTuple("user:u1", RelationGet, dashboardGroup, dashboardResource, "", "folder-1")
	teams := NewFolderResourceTuple("user:u1", RelationGet, iamGroup, teamsResource, "", "folder-1")
	MergeFolderResourceTuples(dashboards, teams)

	result := NormalizeGrantTuples([]*authzextv1.TupleKey{ToAuthzExtTupleKey(dashboards)}, nil)

	require.Equal(t, []*authzextv1.FolderResourceGrant{
		{
			FolderUid:  "folder-1",
			Type:       &authzextv1.ResourceType{Group: dashboardGroup, Resource: dashboardResource},
			Permission: &authzextv1.GrantPermission{AdditionalVerbs: []string{RelationGet}},
		},
		{
			FolderUid:  "folder-1",
			Type:       &authzextv1.ResourceType{Group: iamGroup, Resource: teamsResource},
			Permission: &authzextv1.GrantPermission{AdditionalVerbs: []string{RelationGet}},
		},
	}, result.GetFolderResourceGrants())
}
