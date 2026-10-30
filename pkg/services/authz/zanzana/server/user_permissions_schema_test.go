package server

import (
	"testing"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/authz/zanzana/schema"
)

// Schema changes can require additional principal discovery or grant translation.
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
		var principals []string
		for _, reference := range definition.GetMetadata().GetRelations()[expected.relation].GetDirectlyRelatedUserTypes() {
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
