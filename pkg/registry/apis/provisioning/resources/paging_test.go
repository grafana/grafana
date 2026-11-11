package resources

import (
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
)

func TestPageResourceList(t *testing.T) {
	items := func(names ...string) []provisioning.ResourceListItem {
		out := make([]provisioning.ResourceListItem, 0, len(names))
		for _, name := range names {
			out = append(out, provisioning.ResourceListItem{
				Group: "dashboard.grafana.app", Resource: "dashboards", Name: name,
			})
		}
		return out
	}

	tests := []struct {
		name      string
		items     []provisioning.ResourceListItem
		opts      ListOptions
		want      []provisioning.ResourceListItem
		wantToken bool
	}{
		{
			name:  "no limit returns everything sorted",
			items: items("c", "a", "b"),
			want:  items("a", "b", "c"),
		},
		{
			name:      "limit shorter than the list pages",
			items:     items("c", "a", "b"),
			opts:      ListOptions{Limit: 2},
			want:      items("a", "b"),
			wantToken: true,
		},
		{
			name:  "limit at least the list length does not page",
			items: items("a", "b"),
			opts:  ListOptions{Limit: 2},
			want:  items("a", "b"),
		},
		{
			name:  "token of the last item ends the list",
			items: items("a", "b"),
			opts:  ListOptions{Continue: keyOf(items("b")[0]).encode()},
			want:  []provisioning.ResourceListItem{},
		},
		{
			name:  "token naming an item that is gone resumes after it",
			items: items("a", "c"),
			opts:  ListOptions{Continue: keyOf(items("b")[0]).encode()},
			want:  items("c"),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := pageResourceList(tt.items, tt.opts)
			require.NoError(t, err)
			require.Equal(t, tt.want, got.Items)
			if tt.wantToken {
				require.Equal(t, keyOf(tt.want[len(tt.want)-1]).encode(), got.Continue)
			} else {
				require.Empty(t, got.Continue)
			}
		})
	}
}

func TestPageResourceListRoundTripsWithoutDuplicatesOrGaps(t *testing.T) {
	const total = 25
	all := make([]provisioning.ResourceListItem, 0, total)
	for i := range total {
		all = append(all, provisioning.ResourceListItem{
			// Names that do not sort in insertion order, so a page resuming by key is exercised.
			Group: "dashboard.grafana.app", Resource: "dashboards", Name: fmt.Sprintf("dash-%d", i),
		})
	}

	for _, limit := range []int64{1, 4, 7, total - 1, total} {
		t.Run(fmt.Sprintf("limit %d", limit), func(t *testing.T) {
			var seen []provisioning.ResourceListItem
			opts := ListOptions{Limit: limit}
			for pages := 0; ; pages++ {
				require.Less(t, pages, total+1, "paging did not terminate")
				page, err := pageResourceList(append([]provisioning.ResourceListItem{}, all...), opts)
				require.NoError(t, err)
				require.LessOrEqual(t, int64(len(page.Items)), limit)
				seen = append(seen, page.Items...)
				if page.Continue == "" {
					break
				}
				opts.Continue = page.Continue
			}

			want, err := pageResourceList(append([]provisioning.ResourceListItem{}, all...), ListOptions{})
			require.NoError(t, err)
			require.Equal(t, want.Items, seen)
		})
	}
}

func TestPageResourceListRejectsAnUndecodableToken(t *testing.T) {
	_, err := pageResourceList(nil, ListOptions{Continue: "not-a-token!"})
	require.True(t, apierrors.IsBadRequest(err), "got %v", err)
}
