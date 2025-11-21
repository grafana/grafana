package search_test

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/search"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/selection"
)

func TestExternalGroupMappingDocumentBuilder(t *testing.T) {
	info, err := search.GetExternalGroupMappingBuilder()
	require.NoError(t, err)
	doSnapshotTests(t, info.Builder, "external_group_mapping", &resourcepb.ResourceKey{
		Namespace: "default",
		Group:     "iam.grafana.app",
		Resource:  "externalgroupmappings",
	}, []string{
		"mapping-with-team-and-group",
	})
}

func TestExternalGroupMappingSearch(t *testing.T) {
	key := resource.NamespacedResource{
		Namespace: "default",
		Group:     iamv0.ExternalGroupMappingResourceInfo.GroupResource().Group,
		Resource:  iamv0.ExternalGroupMappingResourceInfo.GroupResource().Resource,
	}

	index := newTestExternalGroupMappingsIndex(t, 100, 3, func(index resource.ResourceIndex) (int64, error) {
		return 0, nil
	})
	mappings := []iamv0.ExternalGroupMapping{
		{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "mapping1",
				Namespace: "default",
			},
			Spec: iamv0.ExternalGroupMappingSpec{
				TeamRef: iamv0.ExternalGroupMappingTeamRef{
					Name: "team1",
				},
				ExternalGroupId: "group1",
			},
		},
		{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "mapping2",
				Namespace: "default",
			},
			Spec: iamv0.ExternalGroupMappingSpec{
				TeamRef: iamv0.ExternalGroupMappingTeamRef{
					Name: "team2",
				},
				ExternalGroupId: "group2",
			},
		},
		{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "mapping3",
				Namespace: "default",
			},
			Spec: iamv0.ExternalGroupMappingSpec{
				TeamRef: iamv0.ExternalGroupMappingTeamRef{
					Name: "team1",
				},
				ExternalGroupId: "group3",
			},
		},
	}
	indexExternalGroupMappingDocuments(t, index, key, mappings)

	// Sanity check - title search (name)
	checkExternalGroupMappingSearchQuery(t, index, newTestsExternalGroupMappingQueryWithTitle(key, "mapping2"), []string{"mapping2"})

	t.Run("can search mappings by team", func(t *testing.T) {
		checkExternalGroupMappingSearchQuery(t, index, newTestExternalGroupMappingQueryWithReqs(key, []*resourcepb.Requirement{
			{
				Key:      "fields.team",
				Operator: string(selection.Equals),
				Values:   []string{"team1"},
			},
		}), []string{"mapping1", "mapping3"})
		checkExternalGroupMappingSearchQuery(t, index, newTestExternalGroupMappingQueryWithReqs(key, []*resourcepb.Requirement{
			{
				Key:      "fields.team",
				Operator: string(selection.Equals),
				Values:   []string{"team2"},
			},
		}), []string{"mapping2"})
	})

	t.Run("can search mappings by external group", func(t *testing.T) {
		checkExternalGroupMappingSearchQuery(t, index, newTestExternalGroupMappingQueryWithReqs(key, []*resourcepb.Requirement{
			{
				Key:      "fields.external_group",
				Operator: string(selection.Equals),
				Values:   []string{"group1"},
			},
		}), []string{"mapping1"})

		checkExternalGroupMappingSearchQuery(t, index, newTestExternalGroupMappingQueryWithReqs(key, []*resourcepb.Requirement{
			{
				Key:      "fields.external_group",
				Operator: string(selection.Equals),
				Values:   []string{"group3"},
			},
		}), []string{"mapping3"})
	})

	t.Run("can sort mappings", func(t *testing.T) {
		// Sort by team ascending
		query := newTestExternalGroupMappingQueryWithReqs(key, nil)
		query.SortBy = []*resourcepb.ResourceSearchRequest_Sort{
			{Field: "fields.team"},
			{Field: "name"},
		}
		checkExternalGroupMappingSearchQueryOrdered(t, index, query, []string{"mapping1", "mapping3", "mapping2"})

		// Sort by external group descending
		query = newTestExternalGroupMappingQueryWithReqs(key, nil)
		query.SortBy = []*resourcepb.ResourceSearchRequest_Sort{
			{Field: "fields.external_group", Desc: true},
		}
		checkExternalGroupMappingSearchQueryOrdered(t, index, query, []string{"mapping3", "mapping2", "mapping1"})
	})
}

func newTestExternalGroupMappingsIndex(t testing.TB, threshold int64, size int64, writer resource.BuildFn) resource.ResourceIndex {
	t.Helper()
	gr := iamv0.ExternalGroupMappingResourceInfo.GroupResource()
	key := &resourcepb.ResourceKey{
		Namespace: "default",
		Group:     gr.Group,
		Resource:  gr.Resource,
	}
	backend, err := search.NewBleveBackend(search.BleveOptions{
		Root:          t.TempDir(),
		FileThreshold: threshold, // use in-memory for tests
	}, tracing.NewNoopTracerService(), nil)
	require.NoError(t, err)

	t.Cleanup(backend.Stop)

	ctx := identity.WithRequester(context.Background(), &user.SignedInUser{Namespace: "default"})

	info, err := search.GetExternalGroupMappingBuilder()
	require.NoError(t, err)

	index, err := backend.BuildIndex(ctx, resource.NamespacedResource{
		Namespace: key.Namespace,
		Group:     key.Group,
		Resource:  key.Resource,
	}, size, info.Fields, "test", writer, nil, false)
	require.NoError(t, err)

	return index
}

func indexExternalGroupMappingDocuments(t *testing.T, index resource.ResourceIndex, key resource.NamespacedResource, mappings []iamv0.ExternalGroupMapping) {
	t.Helper()
	items := make([]*resource.BulkIndexItem, 0, len(mappings))
	for _, mapping := range mappings {
		items = append(items, &resource.BulkIndexItem{
			Action: resource.ActionIndex,
			Doc: &resource.IndexableDocument{
				RV:   1,
				Name: mapping.Name,
				Key: &resourcepb.ResourceKey{
					Name:      mapping.Name,
					Namespace: key.Namespace,
					Group:     key.Group,
					Resource:  key.Resource,
				},
				Title: mapping.Name,
				Fields: map[string]any{
					search.EXTERNAL_GROUP_MAPPING_TEAM_NAME:      mapping.Spec.TeamRef.Name,
					search.EXTERNAL_GROUP_MAPPING_EXTERNAL_GROUP: mapping.Spec.ExternalGroupId,
				},
			},
		})
	}
	req := &resource.BulkIndexRequest{Items: items}
	require.NoError(t, index.BulkIndex(req))
}

func checkExternalGroupMappingSearchQuery(t *testing.T, index resource.ResourceIndex, query *resourcepb.ResourceSearchRequest, expectedNames []string) {
	t.Helper()
	res, err := index.Search(context.Background(), nil, query, nil)
	require.NoError(t, err)
	require.Equal(t, int64(len(expectedNames)), res.TotalHits)
	names := make([]string, len(res.Results.Rows))
	for ix, row := range res.Results.Rows {
		names[ix] = row.Key.Name
	}
	assert.ElementsMatch(t, expectedNames, names)
}

func checkExternalGroupMappingSearchQueryOrdered(t *testing.T, index resource.ResourceIndex, query *resourcepb.ResourceSearchRequest, orderedExpectedNames []string) {
	t.Helper()
	res, err := index.Search(context.Background(), nil, query, nil)
	require.NoError(t, err)
	require.Equal(t, int64(len(orderedExpectedNames)), res.TotalHits)
	names := make([]string, len(res.Results.Rows))
	for ix, row := range res.Results.Rows {
		names[ix] = row.Key.Name
	}
	assert.Equal(t, orderedExpectedNames, names)
}

func newTestExternalGroupMappingQueryWithReqs(key resource.NamespacedResource, filterReqs []*resourcepb.Requirement) *resourcepb.ResourceSearchRequest {
	return &resourcepb.ResourceSearchRequest{
		Options: &resourcepb.ListOptions{
			Key: &resourcepb.ResourceKey{
				Namespace: key.Namespace,
				Group:     key.Group,
				Resource:  key.Resource,
			},
			Fields: filterReqs,
		},
		Limit: 100,
	}
}

func newTestsExternalGroupMappingQueryWithTitle(key resource.NamespacedResource, title string) *resourcepb.ResourceSearchRequest {
	return &resourcepb.ResourceSearchRequest{
		Options: &resourcepb.ListOptions{
			Key: &resourcepb.ResourceKey{
				Namespace: key.Namespace,
				Group:     key.Group,
				Resource:  key.Resource,
			},
		},
		Query: title,
		Limit: 100,
	}
}
