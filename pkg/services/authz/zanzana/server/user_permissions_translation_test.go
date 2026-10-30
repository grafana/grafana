package server

import (
	"fmt"
	"strings"
	"testing"

	authzv1 "github.com/grafana/authlib/authz/proto/v1"
	openfgav1 "github.com/openfga/api/proto/openfga/v1"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/structpb"

	"github.com/grafana/grafana/pkg/services/authz/zanzana"
	"github.com/grafana/grafana/pkg/services/authz/zanzana/common"
	"github.com/grafana/grafana/pkg/services/authz/zanzana/schema"
)

func TestUserPermissionsRejectsRequestConditionBindings(t *testing.T) {
	grant := common.NewResourceTuple("user:alice", common.RelationGet, dashboardGroup, dashboardResource, "", "dashboard")
	// Only group_resource is a stored binding in the supported schema contract.
	grant.Condition.Context.Fields["requested_group"] = structpb.NewStringValue(common.FormatGroupResource(dashboardGroup, dashboardResource, ""))
	srv, _, _ := newPermissionTestServer(t, []*openfgav1.TupleKey{grant})
	stream := &permissionResponseStream{ctx: newContextWithNamespaceAndPermissions(zanzana.TokenPermissionUserPermissions)}
	err := srv.GetUserPermissions(&authzv1.GetUserPermissionsRequest{Namespace: namespace, Subject: "user:alice"}, stream)
	require.Equal(t, codes.FailedPrecondition, status.Code(err))
	require.Empty(t, stream.permissions)
}

func TestUserPermissionsReusesSharedPrincipalContributions(t *testing.T) {
	srv, ds, _ := newPermissionTestServer(t, []*openfgav1.TupleKey{
		common.NewTypedTuple(common.TypeRole, "team:shared#member", common.RelationAssignee, "reader"),
		common.NewResourceTuple("role:reader#assignee", common.RelationGet, dashboardGroup, dashboardResource, "", "dashboard"),
	})
	enablePrincipalCache(srv)
	request := func(subject string) {
		stream := &permissionResponseStream{ctx: newContextWithNamespaceAndPermissions(zanzana.TokenPermissionUserPermissions)}
		require.NoError(t, srv.GetUserPermissions(&authzv1.GetUserPermissionsRequest{Namespace: namespace, Subject: subject, Teams: []string{"shared"}}, stream))
		require.Contains(t, stream.permissions, &authzv1.UserPermission{Action: "dashboards:read", Scope: "dashboards:uid:dashboard"})
	}
	request("user:alice")
	counts, total := ds.counts()
	require.Equal(t, map[string]int{"read": 3}, counts)
	require.Equal(t, 3, total)
	ds.reset()
	request("user:bob")
	counts, _ = ds.counts()
	require.Equal(t, 1, counts["read"], "Bob should read only his own contribution; the team and role are shared")
	ds.reset()
	request("user:bob")
	counts, _ = ds.counts()
	require.Zero(t, counts["read"], "cache empty user contributions too")
}

func TestUserPermissionsEvictsSharedRoleAfterWrite(t *testing.T) {
	grant := common.NewResourceTuple("role:reader#assignee", common.RelationGet, dashboardGroup, dashboardResource, "", "dashboard")
	srv, ds, store := newPermissionTestServer(t, []*openfgav1.TupleKey{
		common.NewTypedTuple(common.TypeRole, "team:shared#member", common.RelationAssignee, "reader"), grant,
	})
	enablePrincipalCache(srv)
	request := func(subject string) map[[2]string]bool {
		stream := &permissionResponseStream{ctx: newContextWithNamespaceAndPermissions(zanzana.TokenPermissionUserPermissions)}
		require.NoError(t, srv.GetUserPermissions(&authzv1.GetUserPermissionsRequest{Namespace: namespace, Subject: subject, Teams: []string{"shared"}}, stream))
		got := map[[2]string]bool{}
		for _, p := range stream.permissions {
			got[[2]string{p.Action, p.Scope}] = true
		}
		return got
	}
	key := [2]string{"dashboards:read", "dashboards:uid:dashboard"}
	require.True(t, request("user:alice")[key])
	require.True(t, request("user:bob")[key])
	require.NoError(t, srv.WriteTuples(t.Context(), store, nil, []*openfgav1.TupleKeyWithoutCondition{{User: grant.User, Relation: grant.Relation, Object: grant.Object}}))
	ds.reset()
	require.False(t, request("user:alice")[key])
	require.False(t, request("user:bob")[key])
	counts, _ := ds.counts()
	require.Equal(t, 1, counts["read"], "only the changed role is reloaded; both users and the team remain reusable")
}

func TestUserPermissionsTranslatesEverySupportedRelation(t *testing.T) {
	model, err := schema.TransformModulesToModel(schema.SchemaModules)
	require.NoError(t, err)
	var grants []*openfgav1.TupleKey
	seen := map[string]bool{}
	for _, entry := range common.SupportedActions() {
		info := common.NewResourceInfoFromList(&authzv1.ListRequest{Group: entry.Group, Resource: entry.Resource, Subresource: entry.Subresource})
		for _, definition := range model.TypeDefinitions {
			if definition.Type != info.Type() && definition.Type != common.TypeFolder {
				continue
			}
			for relation, metadata := range definition.GetMetadata().GetRelations() {
				for _, reference := range metadata.GetDirectlyRelatedUserTypes() {
					if reference.Type != common.TypeUser || reference.GetRelation() != "" {
						continue
					}
					name := fmt.Sprintf("grant-%s-%d", relation, len(grants))
					grant := common.NewTypedTuple(definition.Type, "user:matrix", relation, name)
					switch reference.GetCondition() {
					case "group_filter":
						grant = common.NewResourceTuple("user:matrix", relation, entry.Group, entry.Resource, entry.Subresource, name)
					case "subresource_filter":
						grant = common.NewTypedResourceTuple("user:matrix", strings.TrimPrefix(relation, "resource_"), definition.Type, entry.Group, entry.Resource, entry.Subresource, name)
						grant.Condition.Context.Fields["subresources"].GetListValue().Values = append(grant.Condition.Context.Fields["subresources"].GetListValue().Values, structpb.NewStringValue("unrelated.grafana.app/objects"))
					case "":
					default:
						t.Fatalf("unsupported condition %q", reference.GetCondition())
					}
					key := definition.Type + "/" + relation + "/" + info.GroupResource()
					if !seen[key] {
						grants = append(grants, grant)
						seen[key] = true
					}
					break
				}
			}
		}
	}
	srv, _, _ := newPermissionTestServer(t, grants)
	requirePermissionParity(t, srv, &authzv1.GetUserPermissionsRequest{Namespace: namespace, Subject: "user:matrix"})
	t.Logf("checked %d grant forms across %d actions", len(grants), len(common.SupportedActions()))
}

func TestUserPermissionsRejectsUnsupportedGrantShapes(t *testing.T) {
	for _, grant := range []*openfgav1.TupleKey{
		common.NewFolderTuple("user:alice", common.RelationGet, "*"),
		common.NewResourceTuple("user:alice", common.RelationGet, dashboardGroup, dashboardResource, "", "*"),
		common.NewResourceTuple("user:alice", common.RelationGet, dashboardGroup, dashboardResource, "", "dashboard*"),
		common.NewFolderTuple("user:alice", common.RelationGet, "bad#folder"),
		common.NewFolderTuple("user:alice", "can_get", "folder"),
		common.NewTypedTuple(common.TypeRole, "user:alice", common.RelationAssignee, "role#assignee"),
		{User: "user:alice", Relation: "get", Object: "resource:dashboard.grafana.app/dashboards/dashboard", Condition: &openfgav1.RelationshipCondition{Name: "unknown"}},
	} {
		t.Run(grant.Object+"/"+grant.Relation, func(t *testing.T) {
			srv, _, _ := newPermissionTestServer(t, []*openfgav1.TupleKey{grant})
			stream := &permissionResponseStream{ctx: newContextWithNamespaceAndPermissions(zanzana.TokenPermissionUserPermissions)}
			err := srv.GetUserPermissions(&authzv1.GetUserPermissionsRequest{Namespace: namespace, Subject: "user:alice"}, stream)
			require.Equal(t, codes.FailedPrecondition, status.Code(err))
			require.Empty(t, stream.permissions)
		})
	}
}
