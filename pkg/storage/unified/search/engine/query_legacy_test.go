package engine_test

import (
	"testing"

	"github.com/stretchr/testify/require"
	"google.golang.org/protobuf/types/known/structpb"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/search/engine"
)

func TestFromResourceSearchRequestRoundTrip(t *testing.T) {
	legacy := &resourcepb.ResourceSearchRequest{
		Query:  "cpu",
		Limit:  25,
		Offset: 5,
		Fields: []string{"tags"},
		Options: &resourcepb.ListOptions{
			Key: &resourcepb.ResourceKey{
				Namespace: "default",
				Group:     "dashboard.grafana.app",
				Resource:  "dashboards",
			},
			Fields: []*resourcepb.Requirement{{
				Key:      "folder",
				Operator: "=",
				Values:   []string{"platform"},
			}},
		},
		SortBy: []*resourcepb.ResourceSearchRequest_Sort{{
			Field: resource.SEARCH_FIELD_PREFIX + "title",
			Desc:  true,
		}},
		Facet: map[string]*resourcepb.ResourceSearchRequest_Facet{
			"tags": {Field: "tags", Limit: 10},
		},
		Federated: []*resourcepb.ResourceKey{{
			Namespace: "default",
			Group:     "folder.grafana.app",
			Resource:  "folders",
		}},
	}

	engineReq, err := engine.FromResourceSearchRequest(legacy)
	require.NoError(t, err)
	require.NotNil(t, engineReq.Query)
	require.Equal(t, "cpu", engineReq.Query.Text[0].Value)
	require.Equal(t, "platform", engineReq.Query.Filters[0].Values[0])

	back, err := engine.ToResourceSearchRequest(engineReq)
	require.NoError(t, err)
	require.Equal(t, legacy.Query, back.Query)
	require.Equal(t, legacy.Limit, back.Limit)
	require.Equal(t, legacy.Options.Key.Resource, back.Options.Key.Resource)
	require.Equal(t, "folder", back.Options.Fields[0].Key)

	engineRsp := &resourcepb.SearchResponse{
		TotalHits: 1,
		Hits: []*resourcepb.Hit{{
			Key:   legacy.Options.Key,
			Score: 1.5,
			Fields: []*resourcepb.FieldValue{{
				Name:   "title",
				Values: []*structpb.Value{structpb.NewStringValue("CPU")},
			}},
		}},
	}
	legacyRsp, err := engine.ToResourceSearchResponse(legacy, engineRsp)
	require.NoError(t, err)
	require.Equal(t, int64(1), legacyRsp.TotalHits)
	require.Len(t, legacyRsp.Results.Rows, 1)
}
