package common

import (
	"testing"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"
	"github.com/stretchr/testify/require"
	"google.golang.org/protobuf/types/known/structpb"
)

type translationTestCase struct {
	testName string
	subject  string
	action   string
	kind     string
	name     string
	expected *openfgav1.TupleKey
}

func TestTranslateToResourceTuple(t *testing.T) {
	tests := []translationTestCase{
		{
			testName: "dashboards:read in folders",
			subject:  "user:1",
			action:   "dashboards:read",
			kind:     "folders",
			name:     "*",
			expected: &openfgav1.TupleKey{
				User:     "user:1",
				Relation: "get",
				Object:   "group_resource:dashboard.grafana.app/dashboards",
			},
		},
		{
			testName: "dashboards:read for all dashboards",
			subject:  "user:1",
			action:   "dashboards:read",
			kind:     "dashboards",
			name:     "*",
			expected: &openfgav1.TupleKey{
				User:     "user:1",
				Relation: "get",
				Object:   "group_resource:dashboard.grafana.app/dashboards",
			},
		},
		{
			testName: "dashboards:read for general folder",
			subject:  "user:1",
			action:   "dashboards:read",
			kind:     "folders",
			name:     "general",
			expected: &openfgav1.TupleKey{
				User:     "user:1",
				Relation: "resource_get",
				Object:   "folder:general",
				Condition: &openfgav1.RelationshipCondition{
					Name: "subresource_filter",
					Context: &structpb.Struct{
						Fields: map[string]*structpb.Value{
							"subresources": structpb.NewListValue(&structpb.ListValue{
								Values: []*structpb.Value{structpb.NewStringValue("dashboard.grafana.app/dashboards")},
							}),
						},
					},
				},
			},
		},
		{
			testName: "folders:read",
			subject:  "user:1",
			action:   "folders:read",
			kind:     "folders",
			name:     "*",
			expected: &openfgav1.TupleKey{
				User:     "user:1",
				Relation: "get",
				Object:   "group_resource:folder.grafana.app/folders",
			},
		},
		{
			testName: "folders.permissions:write for all folders",
			subject:  "user:1",
			action:   "folders.permissions:write",
			kind:     "folders",
			name:     "*",
			expected: &openfgav1.TupleKey{
				User:     "user:1",
				Relation: "set_permissions",
				Object:   "group_resource:folder.grafana.app/folders",
			},
		},
		{
			testName: "folders.permissions:read for a specific folder",
			subject:  "user:1",
			action:   "folders.permissions:read",
			kind:     "folders",
			name:     "fold1",
			expected: &openfgav1.TupleKey{
				User:     "user:1",
				Relation: "get_permissions",
				Object:   "folder:fold1",
			},
		},
		{
			testName: "dashboards.permissions:write for all dashboards in a folder",
			subject:  "user:1",
			action:   "dashboards.permissions:write",
			kind:     "folders",
			name:     "fold1",
			expected: &openfgav1.TupleKey{
				User:     "user:1",
				Relation: "resource_set_permissions",
				Object:   "folder:fold1",
				Condition: &openfgav1.RelationshipCondition{
					Name: "subresource_filter",
					Context: &structpb.Struct{
						Fields: map[string]*structpb.Value{
							"subresources": structpb.NewListValue(&structpb.ListValue{
								Values: []*structpb.Value{structpb.NewStringValue("dashboard.grafana.app/dashboards")},
							}),
						},
					},
				},
			},
		},
		{
			testName: "dashboards.permissions:write for all dashboards in folders kind",
			subject:  "user:1",
			action:   "dashboards.permissions:write",
			kind:     "folders",
			name:     "*",
			expected: &openfgav1.TupleKey{
				User:     "user:1",
				Relation: "set_permissions",
				Object:   "group_resource:dashboard.grafana.app/dashboards",
			},
		},
		{
			testName: "dashboards.permissions:read for a specific dashboard",
			subject:  "user:1",
			action:   "dashboards.permissions:read",
			kind:     "dashboards",
			name:     "dash1",
			expected: &openfgav1.TupleKey{
				User:     "user:1",
				Relation: "get_permissions",
				Object:   "resource:dashboard.grafana.app/dashboards/dash1",
				Condition: &openfgav1.RelationshipCondition{
					Name: "group_filter",
					Context: &structpb.Struct{
						Fields: map[string]*structpb.Value{
							"group_resource": structpb.NewStringValue("dashboard.grafana.app/dashboards"),
						},
					},
				},
			},
		},
	}

	for _, test := range tests {
		t.Run(test.testName, func(t *testing.T) {
			tuple, ok := TranslateToResourceTuple(test.subject, test.action, test.kind, test.name)
			require.True(t, ok)
			require.EqualExportedValues(t, test.expected, tuple)
		})
	}
}

// TestTranslateToResourceTuple_FolderSelfReadWildcardScope is a spike test for
// identity-access-team#2285, open question #6 (wildcard-scope edge case). A wildcard scope
// (folders:*) routes through the group_resource branch of TranslateToResourceTuple, which emits a
// tuple with relation get_self on a group_resource:... object. This proves that translation step
// alone succeeds and produces a tuple -- it does NOT prove the tuple is usable, because get_self
// is deliberately not defined on the group_resource type (see schema_resource.fga): a
// self-only grant is only meaningful for one specific folder, so a group-wide "all folders"
// self-only grant is nonsensical by construction. Whether OpenFGA rejects writing this tuple is
// verified separately at the server/reconciler integration level
// (TestIntegrationReconciler_FolderSelfReadWildcardScopeRejected).
func TestTranslateToResourceTuple_FolderSelfReadWildcardScope(t *testing.T) {
	tuple, ok := TranslateToResourceTuple("user:1", "folders.self:read", "folders", "*")
	require.True(t, ok, "translation itself does not reject a wildcard scope for folders.self:read")
	require.EqualExportedValues(t, &openfgav1.TupleKey{
		User:     "user:1",
		Relation: RelationGetSelf,
		Object:   "group_resource:folder.grafana.app/folders",
	}, tuple)

	// get_self must NOT be a valid relation on group_resource: it's deliberately absent from
	// schema_resource.fga. If this assertion ever fails because someone added it, open question
	// #6 needs to be re-examined (a wildcard self-only grant would then silently become a full
	// tier grant across every folder).
	require.NotContains(t, RelationsGroupResource, RelationGetSelf)
}
