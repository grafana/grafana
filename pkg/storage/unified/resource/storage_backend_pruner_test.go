package resource

import (
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func TestKvStorageBackend_PruneEventsPerIncarnation(t *testing.T) {
	for _, limit := range []int{1, 3} {
		for _, namespace := range []string{"default", ""} {
			for _, tc := range []struct {
				name    string
				deleted []bool
			}{
				{name: "live", deleted: []bool{false}},
				{name: "deleted", deleted: []bool{true}},
				{name: "recreated", deleted: []bool{true, false}},
				{name: "multiple deleted incarnations", deleted: []bool{true, true, true}},
				{name: "multiple incarnations with live updates", deleted: []bool{true, true, false}},
			} {
				t.Run(fmt.Sprintf("limit=%d/namespace=%q/%s", limit, namespace, tc.name), func(t *testing.T) {
					backend := setupTestStorageBackend(t, func(opts *KVBackendOptions) {
						opts.DashboardVersionsToKeep = limit
					})
					ctx := t.Context()
					key := &resourcepb.ResourceKey{
						Namespace: namespace, Group: "dashboard.grafana.app", Resource: "dashboards", Name: "reused-name",
					}
					obj, err := createTestObjectWithName(key.Name, NamespacedResource{
						Namespace: namespace, Group: key.Group, Resource: key.Resource,
					}, "test-data")
					require.NoError(t, err)
					meta, err := utils.MetaAccessor(obj)
					require.NoError(t, err)
					write := func(kind resourcepb.WatchEvent_Type, previousRV int64) DataKey {
						rv, err := backend.WriteEvent(ctx, WriteEvent{
							Type: kind, Key: key, Value: objectToJSONBytes(t, obj),
							Object: meta, ObjectOld: meta, PreviousRV: previousRV,
						})
						require.NoError(t, err)
						action := DataActionUpdated
						if kind == resourcepb.WatchEvent_ADDED {
							action = DataActionCreated
						} else if kind == resourcepb.WatchEvent_DELETED {
							action = DataActionDeleted
						}
						return DataKey{
							Namespace: namespace, Group: key.Group, Resource: key.Resource, Name: key.Name,
							ResourceVersion: rv, Action: action,
						}
					}

					var retained, pruned []DataKey
					var deletionPredecessors []int64
					for _, deleted := range tc.deleted {
						revisions := []DataKey{write(resourcepb.WatchEvent_ADDED, 0)}
						for range limit + 1 {
							revisions = append(revisions, write(resourcepb.WatchEvent_MODIFIED, revisions[len(revisions)-1].ResourceVersion))
						}
						pruned = append(pruned, revisions[:len(revisions)-limit]...)
						retained = append(retained, revisions[len(revisions)-limit:]...)
						if deleted {
							previousRV := revisions[len(revisions)-1].ResourceVersion
							retained = append(retained, write(resourcepb.WatchEvent_DELETED, previousRV))
							deletionPredecessors = append(deletionPredecessors, previousRV)
						}
					}

					pruningKey := PruningKey{Namespace: namespace, Group: key.Group, Resource: key.Resource, Name: key.Name}
					for range 2 {
						require.NoError(t, backend.pruneEvents(ctx, pruningKey))
						var actual []DataKey
						for dataKey, err := range backend.dataStore.Keys(ctx, ListRequestKey{
							Namespace: namespace, Group: key.Group, Resource: key.Resource, Name: key.Name,
						}, SortOrderAsc) {
							require.NoError(t, err)
							actual = append(actual, dataKey)
						}
						require.Equal(t, retained, actual)
						for _, rv := range deletionPredecessors {
							previous := backend.ReadResource(ctx, &resourcepb.ReadRequest{Key: key, ResourceVersion: rv})
							require.Nil(t, previous.Error, "deleted incarnation's predecessor must remain readable")
							require.Equal(t, rv, previous.ResourceVersion)
							require.NotEmpty(t, previous.Value)
						}
					}
					for _, dataKey := range pruned {
						_, err := backend.dataStore.Get(ctx, dataKey)
						require.ErrorIs(t, err, ErrNotFound)
					}
				})
			}
		}
	}
}
