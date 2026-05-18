package folders

import (
	"context"
	"net/url"
	"sort"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"

	folders "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func TestConvertURLValuesToDescendantCountsOptions(t *testing.T) {
	// Pinned at the conversion layer (not the HTTP layer) because the apiserver
	// is what hands us a *url.Values — keeping the test at the same boundary
	// matches how the scheme exercises this code path in production.
	tests := []struct {
		name   string
		values url.Values
		want   bool
	}{
		{"absent", url.Values{}, false},
		{"bare presence", url.Values{"recursive": []string{""}}, true},
		{"true", url.Values{"recursive": []string{"true"}}, true},
		{"1", url.Values{"recursive": []string{"1"}}, true},
		{"false", url.Values{"recursive": []string{"false"}}, false},
		{"0", url.Values{"recursive": []string{"0"}}, false},
		{"garbage falls back to presence-truthy", url.Values{"recursive": []string{"yes"}}, true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			out := &folders.DescendantCountsOptions{}
			require.NoError(t, convertURLValuesToDescendantCountsOptions(&tt.values, out, nil))
			require.Equal(t, tt.want, out.Recursive)
		})
	}
}

func TestCollectDescendantFolders(t *testing.T) {
	// Tree under test (parent → children):
	//   root → a, b
	//   a    → a1
	//   a1   → a11
	//   b    → b1, b2
	//   c    → c1            (sibling subtree; must be excluded)
	tree := map[string][]string{
		"":     {"root", "c"},
		"root": {"a", "b"},
		"a":    {"a1"},
		"a1":   {"a11"},
		"b":    {"b1", "b2"},
		"c":    {"c1"},
	}

	tests := []struct {
		name     string
		root     string
		expected []string
	}{
		{
			name:     "deep subtree",
			root:     "root",
			expected: []string{"a", "a1", "a11", "b", "b1", "b2"},
		},
		{
			name:     "leaf folder",
			root:     "a11",
			expected: nil,
		},
		{
			name:     "single level",
			root:     "c",
			expected: []string{"c1"},
		},
		{
			name:     "unknown folder",
			root:     "missing",
			expected: nil,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			searcher := newTreeSearcher(t, tree)
			r := &subCountREST{searcher: searcher}
			got, err := r.collectDescendantFolders(context.Background(), "stacks-1", tt.root)
			require.NoError(t, err)
			sort.Strings(got)
			require.Equal(t, tt.expected, got)
		})
	}
}

func TestCollectDescendantFolders_Pagination(t *testing.T) {
	// A single level with descendantsPageSize+1 children forces a second
	// Search page via NextPageToken before traversal can continue.
	n := descendantsPageSize + 1
	children := make([]string, n)
	for i := range children {
		children[i] = childUID(i)
	}

	sm := resource.NewMockResourceClient(t)

	// First page: full pageSize hits, NextPageToken signals more.
	sm.On("Search", mock.Anything, matchSearchOffset("stacks-1", []string{"root"}, 0)).
		Return(buildSearchResp(children[:descendantsPageSize], "more"), nil).Once()
	// Second page: remaining 1 child, no NextPageToken.
	sm.On("Search", mock.Anything, matchSearchOffset("stacks-1", []string{"root"}, descendantsPageSize)).
		Return(buildSearchResp(children[descendantsPageSize:], ""), nil).Once()
	// Each child is a leaf — searchChildren is called once per chunked level
	// of the BFS. With descendantsBatchSize=100 and n=1001, that's 11 chunks.
	for chunk := 0; chunk*descendantsBatchSize < n; chunk++ {
		start := chunk * descendantsBatchSize
		end := start + descendantsBatchSize
		if end > n {
			end = n
		}
		sm.On("Search", mock.Anything, matchSearchOffset("stacks-1", children[start:end], 0)).
			Return(buildSearchResp(nil, ""), nil).Once()
	}

	r := &subCountREST{searcher: sm}
	got, err := r.collectDescendantFolders(context.Background(), "stacks-1", "root")
	require.NoError(t, err)
	require.Len(t, got, n)
}

// newTreeSearcher returns a mocked ResourceClient that resolves Search by
// `In` filter on SEARCH_FIELD_FOLDER against the supplied parent→children
// map. Calls outside that map are unexpected and fail the test.
func newTreeSearcher(t *testing.T, tree map[string][]string) *resource.MockResourceClient {
	sm := resource.NewMockResourceClient(t)
	sm.On("Search", mock.Anything, mock.MatchedBy(func(req *resourcepb.ResourceSearchRequest) bool {
		return req != nil && req.Options != nil && len(req.Options.Fields) > 0
	})).Return(func(_ context.Context, req *resourcepb.ResourceSearchRequest, _ ...grpc.CallOption) *resourcepb.ResourceSearchResponse {
		var hits []string
		for _, parent := range req.Options.Fields[0].Values {
			hits = append(hits, tree[parent]...)
		}
		return buildSearchResp(hits, "")
	}, nil).Maybe()
	return sm
}

func matchSearchOffset(namespace string, parents []string, offset int64) interface{} {
	parentSet := map[string]struct{}{}
	for _, p := range parents {
		parentSet[p] = struct{}{}
	}
	return mock.MatchedBy(func(req *resourcepb.ResourceSearchRequest) bool {
		if req == nil || req.Options == nil || req.Options.Key == nil {
			return false
		}
		if req.Options.Key.Namespace != namespace {
			return false
		}
		if req.Offset != offset {
			return false
		}
		if len(req.Options.Fields) != 1 {
			return false
		}
		got := req.Options.Fields[0].Values
		if len(got) != len(parentSet) {
			return false
		}
		for _, v := range got {
			if _, ok := parentSet[v]; !ok {
				return false
			}
		}
		return true
	})
}

func buildSearchResp(uids []string, nextPage string) *resourcepb.ResourceSearchResponse {
	rows := make([]*resourcepb.ResourceTableRow, len(uids))
	for i, uid := range uids {
		rows[i] = &resourcepb.ResourceTableRow{Key: &resourcepb.ResourceKey{Name: uid}}
	}
	return &resourcepb.ResourceSearchResponse{
		Results: &resourcepb.ResourceTable{
			Rows:          rows,
			NextPageToken: nextPage,
		},
	}
}

func childUID(i int) string {
	const alphabet = "abcdefghijklmnopqrstuvwxyz"
	out := ""
	i++
	for i > 0 {
		i--
		out = string(alphabet[i%26]) + out
		i /= 26
	}
	return out
}
