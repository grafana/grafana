package search

import (
	"testing"

	"github.com/stretchr/testify/require"
	"google.golang.org/protobuf/types/known/structpb"

	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func TestNeedsPostFilter(t *testing.T) {
	checker := func(name, folder string) bool { return name == "allowed" }

	require.False(t, needsPostFilter(nil, nil))
	require.False(t, needsPostFilter(checker, &resourcepb.AuthzFilter{All: true}))
	require.False(t, needsPostFilter(checker, &resourcepb.AuthzFilter{Folders: []string{"f1"}}))
	require.False(t, needsPostFilter(checker, &resourcepb.AuthzFilter{Names: []string{"n1"}}))
	require.True(t, needsPostFilter(checker, nil))
	require.True(t, needsPostFilter(checker, &resourcepb.AuthzFilter{}))
}

func TestOverFetchLimit(t *testing.T) {
	require.Equal(t, int64(0), overFetchLimit(0))
	require.Equal(t, int64(-1), overFetchLimit(-1))
	require.Equal(t, int64(40), overFetchLimit(10))
	require.Equal(t, int64(200), overFetchLimit(200))
}

func TestFilterSearchResponse(t *testing.T) {
	checker := func(name, folder string) bool {
		return name == "a" || (name == "b" && folder == "platform")
	}
	makeRsp := func() *resourcepb.SearchResponse {
		return &resourcepb.SearchResponse{
			Hits: []*resourcepb.Hit{
				{
					Key: &resourcepb.ResourceKey{Name: "a"},
					Fields: []*resourcepb.FieldValue{{
						Name:   "folder",
						Values: []*structpb.Value{structpb.NewStringValue("general")},
					}},
				},
				{
					Key: &resourcepb.ResourceKey{Name: "b"},
					Fields: []*resourcepb.FieldValue{{
						Name:   "folder",
						Values: []*structpb.Value{structpb.NewStringValue("platform")},
					}},
				},
				{
					Key: &resourcepb.ResourceKey{Name: "b"},
					Fields: []*resourcepb.FieldValue{{
						Name:   "folder",
						Values: []*structpb.Value{structpb.NewStringValue("other")},
					}},
				},
				{Key: &resourcepb.ResourceKey{Name: "c"}},
			},
			TotalHits: 4,
		}
	}

	filtered := filterSearchResponse(makeRsp(), checker, 1)
	require.Len(t, filtered.Hits, 1)
	require.Equal(t, "a", filtered.Hits[0].Key.Name)
	require.Equal(t, int64(1), filtered.TotalHits)

	filtered = filterSearchResponse(makeRsp(), checker, 0)
	require.Len(t, filtered.Hits, 2)
	require.Equal(t, int64(2), filtered.TotalHits)
}

func TestHitFolder(t *testing.T) {
	hit := &resourcepb.Hit{
		Fields: []*resourcepb.FieldValue{{
			Name:   "folder",
			Values: []*structpb.Value{structpb.NewStringValue("platform")},
		}},
	}
	require.Equal(t, "platform", hitFolder(hit))
	require.Equal(t, "", hitFolder(&resourcepb.Hit{}))
}
