package server

import (
	"fmt"
	"strings"
	"testing"
	"time"

	authzv1 "github.com/grafana/authlib/authz/proto/v1"
	openfgav1 "github.com/openfga/api/proto/openfga/v1"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/structpb"

	"github.com/grafana/grafana/pkg/services/authz/zanzana/common"
	"github.com/grafana/grafana/pkg/services/authz/zanzana/schema"
)

func TestUserPermissionsRejectsRequestConditionBindings(t *testing.T) {
	grant := common.NewResourceTuple("user:alice", common.RelationGet, dashboardGroup, dashboardResource, "", "dashboard")
	// Only group_resource is a stored binding in the supported schema contract.
	grant.Condition.Context.Fields["requested_group"] = structpb.NewStringValue(common.FormatGroupResource(dashboardGroup, dashboardResource, ""))
	srv, _, _ := newPermissionTestServer(t, []*openfgav1.TupleKey{grant})
	stream := &permissionResponseStream{ctx: newContextWithNamespace()}
	err := srv.GetUserPermissions(&authzv1.GetUserPermissionsRequest{Namespace: namespace, Subject: "user:alice"}, stream)
	require.Equal(t, codes.FailedPrecondition, status.Code(err))
	require.Empty(t, stream.permissions)
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
			stream := &permissionResponseStream{ctx: newContextWithNamespace()}
			err := srv.GetUserPermissions(&authzv1.GetUserPermissionsRequest{Namespace: namespace, Subject: "user:alice"}, stream)
			require.Equal(t, codes.FailedPrecondition, status.Code(err))
			require.Empty(t, stream.permissions)
		})
	}
}

// Flat teams and non-nested roles are required by the three discovery stages.
func TestUserPermissionsGrantsSchemaAssumptions(t *testing.T) {
	model, err := schema.TransformModulesToModel(schema.SchemaModules)
	require.NoError(t, err)
	types := make(map[string]*openfgav1.TypeDefinition)
	for _, definition := range model.GetTypeDefinitions() {
		types[definition.GetType()] = definition
	}

	for _, expected := range []struct {
		typ, relation string
		principals    []string
	}{
		{"role", "assignee", []string{"user", "service-account", "anonymous", "team#member"}},
		{"team", "admin", []string{"user", "service-account"}},
		{"team", "member", []string{"user", "service-account"}},
		{"folder", "parent", []string{"folder"}},
	} {
		definition := types[expected.typ]
		require.NotNil(t, definition)
		references := definition.GetMetadata().GetRelations()[expected.relation].GetDirectlyRelatedUserTypes()
		principals := make([]string, 0, len(references))
		for _, reference := range references {
			require.Nil(t, reference.GetWildcard(), "%s#%s cannot use wildcard grants", expected.typ, expected.relation)
			require.Empty(t, reference.GetCondition(), "%s#%s membership must remain unconditional", expected.typ, expected.relation)
			principal := reference.GetType()
			if reference.GetRelation() != "" {
				principal += "#" + reference.GetRelation()
			}
			principals = append(principals, principal)
		}
		require.ElementsMatch(t, expected.principals, principals, "%s#%s changed; review permission principal discovery", expected.typ, expected.relation)
		rewrite := definition.GetRelations()[expected.relation]
		if expected.typ == "team" && expected.relation == "member" {
			children := rewrite.GetUnion().GetChild()
			require.Len(t, children, 2)
			var forms []string
			for _, child := range children {
				switch node := child.GetUserset().(type) {
				case *openfgav1.Userset_This:
					forms = append(forms, "direct")
				case *openfgav1.Userset_ComputedUserset:
					require.Empty(t, node.ComputedUserset.GetObject())
					forms = append(forms, node.ComputedUserset.GetRelation())
				default:
					t.Fatalf("team membership requires additional graph discovery: %T", node)
				}
			}
			require.ElementsMatch(t, []string{"direct", "admin"}, forms)
		} else {
			require.IsType(t, &openfgav1.Userset_This{}, rewrite.GetUserset(), "%s#%s must remain direct", expected.typ, expected.relation)
		}
	}

	for _, definition := range model.GetTypeDefinitions() {
		for relation, metadata := range definition.GetMetadata().GetRelations() {
			for _, reference := range metadata.GetDirectlyRelatedUserTypes() {
				require.Nil(t, reference.GetWildcard(), "%s#%s requires wildcard-principal discovery", definition.GetType(), relation)
				if definition.GetType() == "folder" && relation == "parent" {
					continue
				}
				principal := reference.GetType()
				if reference.GetRelation() != "" {
					principal += "#" + reference.GetRelation()
				}
				require.Contains(t, []string{"user", "service-account", "anonymous", "render", "team#member", "role#assignee"}, principal,
					"%s#%s requires additional principal discovery", definition.GetType(), relation)
			}
		}
		var visit func(*openfgav1.Userset)
		visit = func(rewrite *openfgav1.Userset) {
			switch node := rewrite.GetUserset().(type) {
			case *openfgav1.Userset_This:
			case *openfgav1.Userset_ComputedUserset:
				require.Empty(t, node.ComputedUserset.GetObject())
				require.Contains(t, definition.GetRelations(), node.ComputedUserset.GetRelation())
			case *openfgav1.Userset_Union:
				for _, child := range node.Union.GetChild() {
					visit(child)
				}
			case *openfgav1.Userset_TupleToUserset:
				require.Equal(t, "folder", definition.GetType(), "only folder inheritance is omitted from grant enumeration")
				require.Empty(t, node.TupleToUserset.GetTupleset().GetObject())
				require.Equal(t, "parent", node.TupleToUserset.GetTupleset().GetRelation())
				require.Empty(t, node.TupleToUserset.GetComputedUserset().GetObject())
				require.Contains(t, definition.GetRelations(), node.TupleToUserset.GetComputedUserset().GetRelation())
			default:
				t.Fatalf("%s introduces an unsupported rewrite %T; review permission translation", definition.GetType(), node)
			}
		}
		for _, rewrite := range definition.GetRelations() {
			visit(rewrite)
		}
	}
}

func TestUserPermissionsRejectsUnexpectedPrincipalDependencies(t *testing.T) {
	for _, tc := range []struct {
		name, principal, dependency string
	}{
		{"unknown principal", "user:alice", "unknown:one#member"},
		{"unsupported team relation", "user:alice", "team:one#admin"},
		{"missing role relation", "user:alice", "role:one"},
		{"nested teams", "team:one#member", "team:two#member"},
		{"nested roles", "role:one#assignee", "role:two#assignee"},
		{"role team membership", "role:one#assignee", "team:two#member"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			srv, ds, store := newPermissionTestServer(t, nil)
			enablePrincipalCache(srv)
			cache := srv.principalCache()
			cache.mu.Lock()
			if tc.principal != "user:alice" {
				cache.entries.Add(permissionPrincipalKey{store.ID, store.ModelID, "user:alice"}, permissionPrincipalEntry{grants: &principalGrants{dependencies: []string{tc.principal}}, expires: cache.clock.Now().Add(time.Minute)})
			}
			cache.entries.Add(permissionPrincipalKey{store.ID, store.ModelID, tc.principal}, permissionPrincipalEntry{grants: &principalGrants{dependencies: []string{tc.dependency}}, expires: cache.clock.Now().Add(time.Minute)})
			cache.mu.Unlock()
			stream := &permissionResponseStream{ctx: newContextWithNamespace()}
			err := srv.GetUserPermissions(&authzv1.GetUserPermissionsRequest{Namespace: namespace, Subject: "user:alice"}, stream)
			require.Equal(t, codes.FailedPrecondition, status.Code(err))
			require.Empty(t, stream.permissions)
			_, reads := ds.counts()
			require.Zero(t, reads, "unexpected dependencies must not trigger speculative reads")
		})
	}
}
