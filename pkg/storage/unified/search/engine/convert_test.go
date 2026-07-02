package engine_test

import (
	"testing"

	"github.com/stretchr/testify/require"
	"google.golang.org/protobuf/types/known/structpb"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/search/engine"
)

func TestDocumentRoundTrip(t *testing.T) {
	doc := &resourcepb.Document{
		Key: &resourcepb.ResourceKey{
			Namespace: "ns",
			Group:     "g",
			Resource:  "r",
			Name:      "n",
		},
		Title:  "hello",
		Folder: "f1",
		Fields: []*resourcepb.FieldValue{{
			Name:   "email",
			Values: []*structpb.Value{structpb.NewStringValue("a@b.com")},
		}},
	}
	idx, err := engine.DocumentToIndexable(doc)
	require.NoError(t, err)
	require.Equal(t, "hello", idx.Title)
	require.Equal(t, "a@b.com", idx.Fields["email"])

	back, err := engine.IndexableToDocument(idx)
	require.NoError(t, err)
	require.Equal(t, doc.Title, back.Title)
}

func TestFieldDescriptorToSearchField(t *testing.T) {
	def := engine.FieldDescriptorToSearchField(&resourcepb.FieldDescriptor{
		Name:         "tags",
		Type:         resourcepb.FieldType_FIELD_TYPE_STRING,
		Array:        true,
		Capabilities: []resourcepb.Capability{resourcepb.Capability_CAPABILITY_FILTER, resourcepb.Capability_CAPABILITY_FACET},
	})
	require.True(t, def.Array)
	require.True(t, def.HasCapability(resource.SearchCapabilityFilter))
	require.True(t, def.HasCapability(resource.SearchCapabilityFacet))
}

func TestToResourceSearchRequestAuthzFilter(t *testing.T) {
	req := &resourcepb.SearchRequest{
		Index: &resourcepb.ResourceIndexKey{Namespace: "ns", Group: "g", Resource: "r"},
		Authz: &resourcepb.AuthzFilter{Folders: []string{"f1"}},
	}
	legacy, err := engine.ToResourceSearchRequest(req)
	require.NoError(t, err)
	require.Len(t, legacy.Options.Fields, 1)
	require.Equal(t, resource.SEARCH_FIELD_FOLDER, legacy.Options.Fields[0].Key)
}
