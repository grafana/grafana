package resource

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func fieldByName(t *testing.T, defs []SearchFieldDefinition, name string) SearchFieldDefinition {
	t.Helper()
	for _, def := range defs {
		if def.Name == name {
			return def
		}
	}
	require.Failf(t, "field not found", "no field named %q", name)
	return SearchFieldDefinition{}
}

func TestGlobalSearchFieldDefinitions(t *testing.T) {
	global := GlobalSearchFieldDefinitions()

	gr := fieldByName(t, global, SEARCH_FIELD_GROUP_RESOURCE)
	assert.True(t, gr.HasCapability(SearchCapabilityFilter))
	assert.True(t, gr.HasCapability(SearchCapabilityFacet))

	// Timestamps are filterable and sortable here, so hits of different resource
	// types can be ordered by time.
	for _, name := range []string{SEARCH_FIELD_CREATED, SEARCH_FIELD_UPDATED} {
		def := fieldByName(t, global, name)
		assert.True(t, def.HasCapability(SearchCapabilityFilter), name)
		assert.True(t, def.HasCapability(SearchCapabilitySort), name)
	}
}

func TestGlobalSearchFieldDefinitionsLeaveStandardAlone(t *testing.T) {
	// Indexing created and updated for every kind would change the
	// index-affecting hash and rebuild every index in the deployment, so the
	// standard set must not pick up the global capabilities.
	_ = GlobalSearchFieldDefinitions()

	standard := StandardSearchFieldDefinitions()
	for _, name := range []string{SEARCH_FIELD_CREATED, SEARCH_FIELD_UPDATED} {
		def := fieldByName(t, standard, name)
		assert.False(t, def.HasCapability(SearchCapabilityFilter), name)
		assert.False(t, def.HasCapability(SearchCapabilitySort), name)
	}

	for _, def := range standard {
		assert.NotEqual(t, SEARCH_FIELD_GROUP_RESOURCE, def.Name)
	}
}

func TestIndexFieldDefinitions(t *testing.T) {
	standard, deleted := IndexFieldDefinitions("dashboard.grafana.app", "dashboards")
	assert.Equal(t, StandardSearchFieldDefinitions(), standard)
	assert.Equal(t, TrashSearchFieldDefinitions(), deleted)

	// A namespace-wide index holds only live documents, so it declares nothing a
	// deleted document would need.
	standard, deleted = IndexFieldDefinitions(GlobalSearchGroup, GlobalSearchResource)
	assert.Equal(t, GlobalSearchFieldDefinitions(), standard)
	assert.Empty(t, deleted)
}

func TestUpdateCopyFieldsSetsGroupResource(t *testing.T) {
	doc := (&IndexableDocument{Key: &resourcepb.ResourceKey{
		Namespace: "ns",
		Group:     "dashboard.grafana.app",
		Resource:  "dashboards",
		Name:      "abc",
	}}).UpdateCopyFields()

	assert.Equal(t, "dashboard.grafana.app/dashboards", doc.GroupResource)
}
