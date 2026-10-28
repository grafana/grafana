package zanzana

import (
	"testing"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"
	"github.com/stretchr/testify/require"
)

func TestConvertSnapshotRolePermissionsToTuples(t *testing.T) {
	tuples, err := ConvertRolePermissionsToTuples("snapshot-role", []RolePermission{
		{Action: "snapshots:read"},
		{Action: "snapshots:create"},
		{Action: "snapshots:delete"},
	})
	require.NoError(t, err)
	require.ElementsMatch(t, tupleKeyStrings([]*openfgav1.TupleKey{
		{User: "role:snapshot-role#assignee", Relation: "get", Object: "group_resource:dashboard.grafana.app/snapshots"},
		{User: "role:snapshot-role#assignee", Relation: "create", Object: "group_resource:dashboard.grafana.app/snapshots"},
		{User: "role:snapshot-role#assignee", Relation: "delete", Object: "group_resource:dashboard.grafana.app/snapshots"},
	}), tupleKeyStrings(tuples))
}
