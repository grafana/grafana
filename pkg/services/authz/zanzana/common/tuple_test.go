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
	}

	for _, test := range tests {
		t.Run(test.testName, func(t *testing.T) {
			tuple, ok := TranslateToResourceTuple(test.subject, test.action, test.kind, test.name)
			require.True(t, ok)
			require.EqualExportedValues(t, test.expected, tuple)
		})
	}
}
