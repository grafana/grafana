package search

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// The two rules in validateTrashRequest apply to opposite kinds of request, so
// each is checked against both kinds: a guard that fires on the wrong one is as
// broken as a guard that never fires.
func TestValidateTrashRequest(t *testing.T) {
	trashField := func(q *resourcepb.ResourceSearchRequest) {
		q.Fields = []string{resource.SEARCH_FIELD_DELETED_BY}
	}
	federated := func(q *resourcepb.ResourceSearchRequest) {
		q.Federated = []*resourcepb.ResourceKey{{
			Namespace: "default",
			Group:     "folder.grafana.app",
			Resource:  "folders",
		}}
	}

	cases := []struct {
		name    string
		deleted bool
		mutate  func(*resourcepb.ResourceSearchRequest)
		wantMsg string // empty means the request is accepted
	}{
		{name: "plain live search", deleted: false},
		{name: "plain trash search", deleted: true},
		{
			name:    "live search naming a trash field",
			deleted: false,
			mutate:  trashField,
			wantMsg: `field "deleted_by" is only available when searching deleted resources`,
		},
		{
			name:    "trash search naming a trash field",
			deleted: true,
			mutate:  trashField,
		},
		{
			// Federation is refused for trash only: live search federates
			// dashboards and folders on the main search path.
			name:    "live search with federation",
			deleted: false,
			mutate:  federated,
		},
		{
			name:    "trash search with federation",
			deleted: true,
			mutate:  federated,
			wantMsg: "searching deleted resources does not support federated queries",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			q := &resourcepb.ResourceSearchRequest{
				Options:   &resourcepb.ListOptions{Key: &resourcepb.ResourceKey{Namespace: "default"}},
				IsDeleted: tc.deleted,
			}
			if tc.mutate != nil {
				tc.mutate(q)
			}

			got := validateTrashRequest(q)
			if tc.wantMsg == "" {
				require.Nil(t, got)
				return
			}
			require.NotNil(t, got)
			require.Equal(t, int32(400), got.Code)
			require.Equal(t, tc.wantMsg, got.Message)
		})
	}
}
