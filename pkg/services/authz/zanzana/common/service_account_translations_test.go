package common

import (
	"testing"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"
	"github.com/stretchr/testify/require"
)

func TestServiceAccountPermissionTranslations(t *testing.T) {
	for _, tc := range []struct{ action, relation string }{
		{"serviceaccounts:create", RelationCreate},
		{"serviceaccounts:read", RelationGet},
		{"serviceaccounts:write", RelationUpdate},
		{"serviceaccounts:delete", RelationDelete},
		{"serviceaccounts.permissions:read", RelationGetPermissions},
		{"serviceaccounts.permissions:write", RelationSetPermissions},
	} {
		t.Run(tc.action, func(t *testing.T) {
			kind, name := KindServiceAccounts, "*"
			if tc.relation == RelationCreate {
				kind, name = "", ""
			}
			expected := &openfgav1.TupleKey{
				User: "role:sa-manager#assignee", Relation: tc.relation,
				Object: "group_resource:iam.grafana.app/serviceaccounts",
			}
			tuple, ok := TranslateToResourceTuple(expected.User, tc.action, kind, name)
			require.True(t, ok)
			require.Equal(t, expected, tuple)
			tuples, ok := TranslateToResourceTuples(expected.User, tc.action, kind, name)
			require.True(t, ok)
			require.Equal(t, []*openfgav1.TupleKey{expected}, tuples)
			req, ok := TranslateToCheckRequest("org-1", tc.action, KindServiceAccounts, "sa1")
			require.True(t, ok)
			require.Equal(t, "iam.grafana.app", req.Group)
			require.Equal(t, "serviceaccounts", req.Resource)
			require.Equal(t, tc.relation, req.Verb)
			require.Equal(t, "sa1", req.Name)
		})
	}
}

func TestServiceAccountActionSetTranslations(t *testing.T) {
	for _, tc := range []struct{ action, relation string }{
		{"serviceaccounts:edit", RelationSetEdit},
		{"serviceaccounts:admin", RelationSetAdmin},
	} {
		t.Run(tc.action, func(t *testing.T) {
			for _, scope := range []struct{ kind, name string }{
				{KindServiceAccounts, "sa1"},
				{KindServiceAccounts, "*"},
			} {
				if tc.action == "serviceaccounts:edit" && scope.name == "*" {
					_, ok := TranslateToResourceTuple("role:sa-manager#assignee", tc.action, scope.kind, scope.name)
					require.False(t, ok)
					tuples, ok := TranslateToResourceTuples("role:sa-manager#assignee", tc.action, scope.kind, scope.name)
					require.True(t, ok)
					require.Equal(t, []*openfgav1.TupleKey{
						{User: "role:sa-manager#assignee", Relation: RelationGet, Object: "group_resource:iam.grafana.app/serviceaccounts"},
						{User: "role:sa-manager#assignee", Relation: RelationUpdate, Object: "group_resource:iam.grafana.app/serviceaccounts"},
					}, tuples)
					continue
				}
				tuple, ok := TranslateToResourceTuple("role:sa-manager#assignee", tc.action, scope.kind, scope.name)
				require.True(t, ok)
				require.Equal(t, tc.relation, tuple.Relation)
				expectedObject := "service-account:sa1"
				if scope.name == "*" {
					expectedObject = "group_resource:iam.grafana.app/serviceaccounts"
				}
				require.Equal(t, expectedObject, tuple.Object)
			}
		})
	}
}
