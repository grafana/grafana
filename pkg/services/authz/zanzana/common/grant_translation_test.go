package common

import (
	"testing"

	"github.com/stretchr/testify/require"
	"google.golang.org/protobuf/types/known/structpb"

	authzextv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
)

func TestTranslateGrantTuple_GroupResourceWildcard(t *testing.T) {
	tuple := ToAuthzExtTupleKey(NewGroupResourceTuple(
		"role:managed#assignee",
		RelationGet,
		dashboardGroup,
		dashboardResource,
		"",
	))

	perms := TranslateGrantTuple(tuple)
	require.NotEmpty(t, perms)
	require.Contains(t, perms, GrantPermission{
		Action: "dashboards:read",
		Scope:  GrantScope{Kind: dashboardResource, Identifier: "*"},
	})
}

func TestTranslateGrantTuple_ResourceInstance(t *testing.T) {
	tuple := ToAuthzExtTupleKey(NewResourceTuple(
		"user:1",
		RelationUpdate,
		dashboardGroup,
		dashboardResource,
		"",
		"dash-1",
	))

	perms := TranslateGrantTuple(tuple)
	require.Equal(t, []GrantPermission{{
		Action: "dashboards:write",
		Scope:  GrantScope{Kind: dashboardResource, Identifier: "dash-1"},
	}}, perms)
}

func TestTranslateGrantTuple_FolderInstance(t *testing.T) {
	tuple := ToAuthzExtTupleKey(NewFolderTuple("user:1", RelationGet, "fold-1"))

	perms := TranslateGrantTuple(tuple)
	require.Equal(t, []GrantPermission{{
		Action: "folders:read",
		Scope:  GrantScope{Kind: KindFolders, Identifier: "fold-1"},
	}}, perms)
}

func TestTranslateGrantTuple_FolderResourceSubresource(t *testing.T) {
	tuple := ToAuthzExtTupleKey(NewFolderResourceTuple(
		"role:managed#assignee",
		RelationGet,
		dashboardGroup,
		dashboardResource,
		"",
		"fold-1",
	))

	perms := TranslateGrantTuple(tuple)
	require.Contains(t, perms, GrantPermission{
		Action: "dashboards:read",
		Scope:  GrantScope{Kind: KindFolders, Identifier: "fold-1"},
	})
}

func TestTranslateGrantTuple_TeamInstance(t *testing.T) {
	tuple := ToAuthzExtTupleKey(NewTypedTuple(TypeTeam, "user:1", RelationGet, "team-1"))

	perms := TranslateGrantTuple(tuple)
	require.Equal(t, []GrantPermission{{
		Action: "teams:read",
		Scope:  GrantScope{Kind: KindTeams, Identifier: "team-1"},
	}}, perms)
}

func TestTranslateGrantTuple_AdminActionSet(t *testing.T) {
	// "admin" is RelationSetAdmin here (action-set grant), which shares the literal
	// "admin" with team membership. On group_resource/folder objects it must translate
	// to the dashboards:admin action set rather than being dropped as structural.
	t.Run("group_resource wildcard", func(t *testing.T) {
		tuple := ToAuthzExtTupleKey(NewGroupResourceTuple(
			"role:managed#assignee",
			RelationSetAdmin,
			dashboardGroup,
			dashboardResource,
			"",
		))

		perms := TranslateGrantTuple(tuple)
		require.Contains(t, perms, GrantPermission{
			Action: "dashboards:admin",
			Scope:  GrantScope{Kind: dashboardResource, Identifier: "*"},
		})
	})

	t.Run("folder direct admin", func(t *testing.T) {
		tuple := ToAuthzExtTupleKey(NewFolderTuple("user:1", RelationSetAdmin, "fold-1"))

		perms := TranslateGrantTuple(tuple)
		require.Contains(t, perms, GrantPermission{
			Action: "folders:admin",
			Scope:  GrantScope{Kind: KindFolders, Identifier: "fold-1"},
		})
	})
}

func TestTranslateGrantTuple_MultipleSubresources(t *testing.T) {
	// A folder-resource tuple whose subresource_filter lists several group_resources must
	// translate every entry, not only the first one.
	tuple := &authzextv1.TupleKey{
		User:     "role:managed#assignee",
		Relation: SubresourceRelation(RelationGet),
		Object:   NewFolderIdent("fold-multi"),
		Condition: &authzextv1.RelationshipCondition{
			Name: "subresource_filter",
			Context: &structpb.Struct{
				Fields: map[string]*structpb.Value{
					"subresources": structpb.NewListValue(&structpb.ListValue{
						Values: []*structpb.Value{
							// Unmapped entry first to ensure the loop does not stop early.
							structpb.NewStringValue("unknown.grafana.app/things"),
							structpb.NewStringValue(FormatGroupResource(dashboardGroup, dashboardResource, "")),
						},
					}),
				},
			},
		},
	}

	perms := TranslateGrantTuple(tuple)
	require.Contains(t, perms, GrantPermission{
		Action: "dashboards:read",
		Scope:  GrantScope{Kind: KindFolders, Identifier: "fold-multi"},
	})
}

func TestFormatGrantScope(t *testing.T) {
	require.Equal(t, "dashboards:*", FormatGrantScope(GrantScope{Kind: "dashboards", Identifier: "*"}))
	require.Equal(t, "folders:uid:abc", FormatGrantScope(GrantScope{Kind: KindFolders, Identifier: "abc"}))
}

func TestTranslateGrantTuple_ResourceWithGroupFilterCondition(t *testing.T) {
	tuple := &authzextv1.TupleKey{
		User:     "user:1",
		Relation: RelationGet,
		Object:   NewResourceIdent(dashboardGroup, dashboardResource, "", "dash-2"),
		Condition: &authzextv1.RelationshipCondition{
			Name: "group_filter",
			Context: &structpb.Struct{
				Fields: map[string]*structpb.Value{
					"group_resource": structpb.NewStringValue(FormatGroupResource(dashboardGroup, dashboardResource, "")),
				},
			},
		},
	}

	perms := TranslateGrantTuple(tuple)
	require.Equal(t, []GrantPermission{{
		Action: "dashboards:read",
		Scope:  GrantScope{Kind: dashboardResource, Identifier: "dash-2"},
	}}, perms)
}
