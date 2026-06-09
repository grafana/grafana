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

func TestTranslateToResourceTuple_K8sNativeFallback(t *testing.T) {
	t.Run("wildcard scope produces group_resource tuple", func(t *testing.T) {
		tuple, ok := TranslateToResourceTuple(
			"role:fixed_tKsnflM69PHBFvDKdlsuXVvdwG0#assignee",
			"notifications.alerting.grafana.app/alertmanagerimports:create",
			"notifications.alerting.grafana.app/alertmanagerimports",
			"*",
		)
		require.True(t, ok)
		require.Equal(t, "role:fixed_tKsnflM69PHBFvDKdlsuXVvdwG0#assignee", tuple.User)
		require.Equal(t, "create", tuple.Relation)
		require.Equal(t, "group_resource:notifications.alerting.grafana.app/alertmanagerimports", tuple.Object)
	})

	t.Run("specific name produces resource tuple", func(t *testing.T) {
		tuple, ok := TranslateToResourceTuple(
			"user:u001",
			"notifications.alerting.grafana.app/alertmanagerimports:get",
			"notifications.alerting.grafana.app/alertmanagerimports",
			"import-abc",
		)
		require.True(t, ok)
		require.Equal(t, "user:u001", tuple.User)
		require.Equal(t, "get", tuple.Relation)
		require.Equal(t, "resource:notifications.alerting.grafana.app/alertmanagerimports/import-abc", tuple.Object)
	})

	t.Run("all verbs map correctly", func(t *testing.T) {
		cases := []struct {
			verb     string
			relation string
		}{
			{"get", "get"},
			{"create", "create"},
			{"update", "update"},
			{"delete", "delete"},
			{"get_permissions", "get_permissions"},
			{"set_permissions", "set_permissions"},
		}
		for _, c := range cases {
			action := "myapp.ext.grafana.com/widgets:" + c.verb
			kind := "myapp.ext.grafana.com/widgets"
			tuple, ok := TranslateToResourceTuple("user:u001", action, kind, "*")
			require.True(t, ok, "verb %s", c.verb)
			require.Equal(t, c.relation, tuple.Relation, "verb %s", c.verb)
		}
	})

	t.Run("unknown verb returns false", func(t *testing.T) {
		_, ok := TranslateToResourceTuple(
			"user:u001",
			"notifications.alerting.grafana.app/alertmanagerimports:watch",
			"notifications.alerting.grafana.app/alertmanagerimports",
			"*",
		)
		require.False(t, ok)
	})

	t.Run("non-k8s kind without slash returns false", func(t *testing.T) {
		_, ok := TranslateToResourceTuple("user:u001", "unknown:read", "unknown", "*")
		require.False(t, ok)
	})

	t.Run("action not matching kind prefix returns false", func(t *testing.T) {
		_, ok := TranslateToResourceTuple(
			"user:u001",
			"other.group/other:get",
			"notifications.alerting.grafana.app/alertmanagerimports",
			"*",
		)
		require.False(t, ok)
	})
}
