package resource

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func TestSearchFieldsFromTableColumns(t *testing.T) {
	t.Run("filterable string produces filter+retrieve", func(t *testing.T) {
		got := searchFieldsFromTableColumns([]*resourcepb.ResourceTableColumnDefinition{
			{
				Name:        "email",
				Type:        resourcepb.ResourceTableColumnDefinition_STRING,
				Description: "user email",
				Properties: &resourcepb.ResourceTableColumnDefinition_Properties{
					Filterable: true,
				},
			},
		})
		require.Len(t, got, 1)
		assert.Equal(t, "email", got[0].Name)
		assert.Equal(t, SearchFieldTypeString, got[0].Type)
		assert.False(t, got[0].Array)
		assert.Equal(t, "user email", got[0].Description)
		assert.ElementsMatch(t,
			[]SearchCapability{SearchCapabilityFilter, SearchCapabilityRetrieve},
			got[0].Capabilities,
		)
	})

	t.Run("non-filterable string is retrieve-only", func(t *testing.T) {
		got := searchFieldsFromTableColumns([]*resourcepb.ResourceTableColumnDefinition{
			{
				Name: "title",
				Type: resourcepb.ResourceTableColumnDefinition_STRING,
			},
		})
		require.Len(t, got, 1)
		assert.Equal(t, []SearchCapability{SearchCapabilityRetrieve}, got[0].Capabilities)
	})

	t.Run("filterable non-string is retrieve-only", func(t *testing.T) {
		// Filterable is only honored on STRING fields in the current mapper;
		// non-string types must not gain a keyword variant via translation.
		got := searchFieldsFromTableColumns([]*resourcepb.ResourceTableColumnDefinition{
			{
				Name: "lastSeenAt",
				Type: resourcepb.ResourceTableColumnDefinition_INT64,
				Properties: &resourcepb.ResourceTableColumnDefinition_Properties{
					Filterable: true,
				},
			},
		})
		require.Len(t, got, 1)
		assert.Equal(t, SearchFieldTypeInt64, got[0].Type)
		assert.Equal(t, []SearchCapability{SearchCapabilityRetrieve}, got[0].Capabilities)
	})

	t.Run("array flag is propagated", func(t *testing.T) {
		got := searchFieldsFromTableColumns([]*resourcepb.ResourceTableColumnDefinition{
			{
				Name:    "tags",
				Type:    resourcepb.ResourceTableColumnDefinition_STRING,
				IsArray: true,
				Properties: &resourcepb.ResourceTableColumnDefinition_Properties{
					Filterable: true,
				},
			},
		})
		require.Len(t, got, 1)
		assert.True(t, got[0].Array)
		assert.ElementsMatch(t,
			[]SearchCapability{SearchCapabilityFilter, SearchCapabilityRetrieve},
			got[0].Capabilities,
		)
	})

	t.Run("date_time collapses to date", func(t *testing.T) {
		got := searchFieldsFromTableColumns([]*resourcepb.ResourceTableColumnDefinition{
			{Name: "ts", Type: resourcepb.ResourceTableColumnDefinition_DATE_TIME},
		})
		require.Len(t, got, 1)
		assert.Equal(t, SearchFieldTypeDate, got[0].Type)
	})

	t.Run("object and binary types are not represented", func(t *testing.T) {
		// OBJECT and BINARY have no corresponding SearchFieldType because the
		// new design omits them; they map to the empty type.
		got := searchFieldsFromTableColumns([]*resourcepb.ResourceTableColumnDefinition{
			{Name: "obj", Type: resourcepb.ResourceTableColumnDefinition_OBJECT},
			{Name: "bin", Type: resourcepb.ResourceTableColumnDefinition_BINARY},
		})
		require.Len(t, got, 2)
		assert.Equal(t, SearchFieldType(""), got[0].Type)
		assert.Equal(t, SearchFieldType(""), got[1].Type)
	})

	t.Run("nil entries are dropped", func(t *testing.T) {
		got := searchFieldsFromTableColumns([]*resourcepb.ResourceTableColumnDefinition{
			nil,
			{Name: "x", Type: resourcepb.ResourceTableColumnDefinition_STRING},
			nil,
		})
		require.Len(t, got, 1)
		assert.Equal(t, "x", got[0].Name)
	})
}

func TestSearchFieldDefinition_HasCapability(t *testing.T) {
	f := SearchFieldDefinition{
		Capabilities: []SearchCapability{SearchCapabilityFilter, SearchCapabilityRetrieve},
	}
	assert.True(t, f.HasCapability(SearchCapabilityFilter))
	assert.True(t, f.HasCapability(SearchCapabilityRetrieve))
	assert.False(t, f.HasCapability(SearchCapabilityText))
}

func TestMapProvider_FieldsLookup(t *testing.T) {
	grv := GroupResourceVersion{Group: "iam.grafana.app", Resource: "users", Version: "v0alpha1"}
	fields := []SearchFieldDefinition{
		{Name: "email", Type: SearchFieldTypeString, Capabilities: []SearchCapability{SearchCapabilityFilter, SearchCapabilityRetrieve}},
	}
	p := NewMapProvider(
		map[GroupResourceVersion][]SearchFieldDefinition{grv: fields},
		nil,
	)

	assert.Equal(t, fields, p.Fields(grv))

	// Unknown version returns nil; caller is expected to fall back via PreferredVersion.
	assert.Nil(t, p.Fields(GroupResourceVersion{Group: "iam.grafana.app", Resource: "users", Version: "v99"}))
	// Unknown group/resource returns nil.
	assert.Nil(t, p.Fields(GroupResourceVersion{Group: "nope", Resource: "nope", Version: "v0alpha1"}))
}

func TestMapProvider_PreferredVersionFallback(t *testing.T) {
	gr := schema.GroupResource{Group: "iam.grafana.app", Resource: "users"}
	v1 := GroupResourceVersion{Group: gr.Group, Resource: gr.Resource, Version: "v0alpha1"}

	p := NewMapProvider(
		map[GroupResourceVersion][]SearchFieldDefinition{
			v1: {{Name: "email", Type: SearchFieldTypeString}},
		},
		map[schema.GroupResource]string{gr: "v0alpha1"},
	)

	// Direct lookup with the preferred version works.
	assert.Equal(t, "v0alpha1", p.PreferredVersion(gr.Group, gr.Resource))
	assert.Len(t, p.Fields(v1), 1)

	// Caller-side fallback pattern: when the requested version is unknown,
	// re-look-up using PreferredVersion.
	requested := GroupResourceVersion{Group: gr.Group, Resource: gr.Resource, Version: "vUnknown"}
	if fs := p.Fields(requested); fs == nil {
		preferred := p.PreferredVersion(requested.Group, requested.Resource)
		require.NotEmpty(t, preferred)
		fs = p.Fields(GroupResourceVersion{Group: requested.Group, Resource: requested.Resource, Version: preferred})
		assert.Len(t, fs, 1)
	}

	// Resources without a registered preferred version return "".
	assert.Equal(t, "", p.PreferredVersion("other.grafana.app", "things"))
}
