package common

import (
	"testing"

	dashboards "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1"
	folders "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
	authzextv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
	"github.com/stretchr/testify/require"
	"google.golang.org/protobuf/types/known/structpb"
)

func TestPermissionsFromStoredTuple_FolderOwn(t *testing.T) {
	perms, ok := PermissionsFromStoredTuple(NewFolderIdent("top-folder"), RelationGet, nil)
	require.True(t, ok)
	require.Contains(t, perms, MappedTuplePermission{Action: "folders:read", Scope: "folders:uid:top-folder"})
}

func TestPermissionsFromStoredTuple_FolderScopedDashboard(t *testing.T) {
	gr := dashboards.DashboardResourceInfo.GroupResource()
	tuple := NewFolderResourceTuple("user:1", RelationGet, gr.Group, gr.Resource, "", "folder-a")
	cond := tuple.GetCondition()
	perms, ok := PermissionsFromStoredTuple(tuple.GetObject(), tuple.GetRelation(), ToAuthzExtTupleKey(tuple).GetCondition())
	require.True(t, ok)
	require.Contains(t, perms, MappedTuplePermission{Action: "dashboards:read", Scope: "folders:uid:folder-a"})
	_ = cond
}

func TestPermissionsFromStoredTuple_DirectDashboard(t *testing.T) {
	gr := dashboards.DashboardResourceInfo.GroupResource()
	tuple := NewResourceTuple("user:1", RelationGet, gr.Group, gr.Resource, "", "dash-1")
	key := ToAuthzExtTupleKey(tuple)
	perms, ok := PermissionsFromStoredTuple(key.GetObject(), key.GetRelation(), key.GetCondition())
	require.True(t, ok)
	require.Contains(t, perms, MappedTuplePermission{Action: "dashboards:read", Scope: "dashboards:uid:dash-1"})
}

func TestPermissionsFromStoredTuple_WildcardDashboard(t *testing.T) {
	gr := dashboards.DashboardResourceInfo.GroupResource()
	obj := NewGroupResourceIdent(gr.Group, gr.Resource, "")
	perms, ok := PermissionsFromStoredTuple(obj, RelationGet, nil)
	require.True(t, ok)
	require.Contains(t, perms, MappedTuplePermission{Action: "dashboards:read", Scope: "dashboards:*"})
	require.Contains(t, perms, MappedTuplePermission{Action: "dashboards:read", Scope: "folders:*"})
	require.Contains(t, perms, MappedTuplePermission{Action: "dashboards:read", Scope: "*"})
}

func TestPermissionsFromStoredTuple_WildcardFolder(t *testing.T) {
	gr := folders.FolderResourceInfo.GroupResource()
	obj := NewGroupResourceIdent(gr.Group, gr.Resource, "")
	perms, ok := PermissionsFromStoredTuple(obj, RelationGet, nil)
	require.True(t, ok)
	require.Contains(t, perms, MappedTuplePermission{Action: "folders:read", Scope: "folders:*"})
}

func TestPermissionsFromStoredTuple_SkipsFolderParentEdge(t *testing.T) {
	_, ok := PermissionsFromStoredTuple(NewFolderIdent("child"), RelationParent, nil)
	require.False(t, ok)
}

func TestPermissionsFromStoredTuple_ActionSetRelation(t *testing.T) {
	perms, ok := PermissionsFromStoredTuple(NewFolderIdent("f1"), RelationSetView, nil)
	require.True(t, ok)
	require.Contains(t, perms, MappedTuplePermission{Action: "folders:view", Scope: "folders:uid:f1"})
}

func TestPermissionsFromStoredTuple_ResourceConditionMismatch(t *testing.T) {
	gr := dashboards.DashboardResourceInfo.GroupResource()
	tuple := NewResourceTuple("user:1", RelationGet, gr.Group, gr.Resource, "", "dash-1")
	key := ToAuthzExtTupleKey(tuple)
	key.Condition = &authzextv1.RelationshipCondition{
		Name: "group_filter",
		Context: &structpb.Struct{
			Fields: map[string]*structpb.Value{
				"group_resource": structpb.NewStringValue("other.app/widgets"),
			},
		},
	}
	_, ok := PermissionsFromStoredTuple(key.GetObject(), key.GetRelation(), key.GetCondition())
	require.False(t, ok)
}
