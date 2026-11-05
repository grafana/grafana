package common

import (
	"testing"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"
	"github.com/stretchr/testify/require"
)

func TestSnapshotPermissionTranslations(t *testing.T) {
	for _, tc := range []struct{ action, relation, verb string }{
		{"snapshots:read", RelationGet, "get"},
		{"snapshots:create", RelationCreate, "create"},
		{"snapshots:delete", RelationDelete, "delete"},
	} {
		t.Run(tc.action, func(t *testing.T) {
			for _, subject := range []string{"role:fixed_snapshots", "user:1", "service-account:1"} {
				for _, scope := range []struct{ kind, name string }{{"", ""}, {KindSnapshots, "*"}} {
					tuple, ok := TranslateToResourceTuple(subject, tc.action, scope.kind, scope.name)
					require.True(t, ok)
					require.Equal(t, &openfgav1.TupleKey{
						User: subject, Relation: tc.relation, Object: "group_resource:dashboard.grafana.app/snapshots",
					}, tuple)
				}
			}
			req, ok := TranslateToCheckRequest("default", tc.action, KindSnapshots, "snapshot-key")
			require.True(t, ok)
			require.Equal(t, "dashboard.grafana.app", req.Group)
			require.Equal(t, "snapshots", req.Resource)
			require.Equal(t, tc.verb, req.Verb)
			require.Equal(t, "snapshot-key", req.Name)

			_, ok = TranslateToResourceTuple("user:1", tc.action, KindFolders, "folder-a")
			require.False(t, ok, "snapshot permissions do not inherit folder access")
		})
	}
	_, ok := TranslateToResourceTuple("user:1", "snapshots:write", "", "")
	require.False(t, ok)
}
