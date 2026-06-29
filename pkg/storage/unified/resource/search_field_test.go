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
		got := SearchFieldsFromTableColumns([]*resourcepb.ResourceTableColumnDefinition{
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
		got := SearchFieldsFromTableColumns([]*resourcepb.ResourceTableColumnDefinition{
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
		got := SearchFieldsFromTableColumns([]*resourcepb.ResourceTableColumnDefinition{
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
		got := SearchFieldsFromTableColumns([]*resourcepb.ResourceTableColumnDefinition{
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
		got := SearchFieldsFromTableColumns([]*resourcepb.ResourceTableColumnDefinition{
			{Name: "ts", Type: resourcepb.ResourceTableColumnDefinition_DATE_TIME},
		})
		require.Len(t, got, 1)
		assert.Equal(t, SearchFieldTypeDate, got[0].Type)
	})

	t.Run("object and binary types map to unknown", func(t *testing.T) {
		// OBJECT and BINARY have no corresponding SearchFieldType because the
		// new design omits them; they map to SearchFieldTypeUnknown.
		got := SearchFieldsFromTableColumns([]*resourcepb.ResourceTableColumnDefinition{
			{Name: "obj", Type: resourcepb.ResourceTableColumnDefinition_OBJECT},
			{Name: "bin", Type: resourcepb.ResourceTableColumnDefinition_BINARY},
		})
		require.Len(t, got, 2)
		assert.Equal(t, SearchFieldTypeUnknown, got[0].Type)
		assert.Equal(t, SearchFieldTypeUnknown, got[1].Type)
	})

	t.Run("nil entries are dropped", func(t *testing.T) {
		got := SearchFieldsFromTableColumns([]*resourcepb.ResourceTableColumnDefinition{
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
	gvr := schema.GroupVersionResource{Group: "iam.grafana.app", Version: "v0alpha1", Resource: "users"}
	fields := []SearchFieldDefinition{
		{Name: "email", Type: SearchFieldTypeString, Capabilities: []SearchCapability{SearchCapabilityFilter, SearchCapabilityRetrieve}},
	}
	p := NewMapProvider(
		map[schema.GroupVersionResource][]SearchFieldDefinition{gvr: fields},
		nil,
	)

	assert.Equal(t, fields, p.Fields(gvr))

	// Unknown version returns nil; caller is expected to fall back via PreferredVersion.
	assert.Nil(t, p.Fields(schema.GroupVersionResource{Group: "iam.grafana.app", Version: "v99", Resource: "users"}))
	// Unknown group/resource returns nil.
	assert.Nil(t, p.Fields(schema.GroupVersionResource{Group: "nope", Version: "v0alpha1", Resource: "nope"}))
}

func TestMapProvider_PreferredVersionFallback(t *testing.T) {
	gr := schema.GroupResource{Group: "iam.grafana.app", Resource: "users"}
	v1 := schema.GroupVersionResource{Group: gr.Group, Version: "v0alpha1", Resource: gr.Resource}

	p := NewMapProvider(
		map[schema.GroupVersionResource][]SearchFieldDefinition{
			v1: {{Name: "email", Type: SearchFieldTypeString}},
		},
		map[schema.GroupResource]string{gr: "v0alpha1"},
	)

	// Direct lookup with the preferred version works.
	assert.Equal(t, "v0alpha1", p.PreferredVersion(gr.Group, gr.Resource))
	assert.Len(t, p.Fields(v1), 1)

	// Caller-side fallback pattern: when the requested version is unknown,
	// re-look-up using PreferredVersion.
	requested := schema.GroupVersionResource{Group: gr.Group, Version: "vUnknown", Resource: gr.Resource}
	if fs := p.Fields(requested); fs == nil {
		preferred := p.PreferredVersion(requested.Group, requested.Resource)
		require.NotEmpty(t, preferred)
		fs = p.Fields(schema.GroupVersionResource{Group: requested.Group, Version: preferred, Resource: requested.Resource})
		assert.Len(t, fs, 1)
	}

	// Resources without a registered preferred version return "".
	assert.Equal(t, "", p.PreferredVersion("other.grafana.app", "things"))
}

func TestMapProvider_FieldsUnionAcrossVersions(t *testing.T) {
	gr := schema.GroupResource{Group: "example.test", Resource: "widgets"}
	v1 := schema.GroupVersionResource{Group: gr.Group, Version: "v1", Resource: gr.Resource}
	v2 := schema.GroupVersionResource{Group: gr.Group, Version: "v2", Resource: gr.Resource}

	p := NewMapProvider(
		map[schema.GroupVersionResource][]SearchFieldDefinition{
			v1: {
				{Name: "shared", Type: SearchFieldTypeString, Capabilities: []SearchCapability{SearchCapabilityFilter, SearchCapabilityRetrieve}},
				{Name: "only_v1", Type: SearchFieldTypeString, Capabilities: []SearchCapability{SearchCapabilityFilter}},
			},
			v2: {
				{Name: "shared", Type: SearchFieldTypeString, Capabilities: []SearchCapability{SearchCapabilityText}},
				{Name: "only_v2", Type: SearchFieldTypeString, Capabilities: []SearchCapability{SearchCapabilityFilter}},
			},
		},
		map[schema.GroupResource]string{gr: "v1"},
	)

	// Per-version lookup is unchanged.
	assert.Len(t, p.Fields(v1), 2)
	assert.Len(t, p.Fields(v2), 2)

	// Empty-version lookup returns the union deduped by Name.
	union := p.Fields(schema.GroupVersionResource{Group: gr.Group, Resource: gr.Resource})
	names := make([]string, 0, len(union))
	for _, sfd := range union {
		names = append(names, sfd.Name)
	}
	assert.ElementsMatch(t, []string{"shared", "only_v1", "only_v2"}, names)

	// Preferred version (v1) wins on Name collisions: the shape of `shared`
	// comes from v1, not v2.
	for _, sfd := range union {
		if sfd.Name == "shared" {
			assert.Equal(t, []SearchCapability{SearchCapabilityFilter, SearchCapabilityRetrieve}, sfd.Capabilities)
		}
	}
}

func TestMapProvider_IndexAffectingHash(t *testing.T) {
	const (
		group    = "iam.grafana.app"
		resource = "users"
	)
	v0 := schema.GroupVersionResource{Group: group, Version: "v0alpha1", Resource: resource}
	v1 := schema.GroupVersionResource{Group: group, Version: "v1", Resource: resource}

	base := []SearchFieldDefinition{
		{Name: "email", Path: "spec.email", Type: SearchFieldTypeString, Capabilities: []SearchCapability{SearchCapabilityFilter, SearchCapabilityRetrieve}},
		{Name: "login", Path: "spec.login", Type: SearchFieldTypeString, Capabilities: []SearchCapability{SearchCapabilityFilter, SearchCapabilityRetrieve}},
	}

	p := NewMapProvider(map[schema.GroupVersionResource][]SearchFieldDefinition{v0: base}, nil)
	h := p.IndexAffectingHash(group, resource)
	assert.Len(t, h, 64) // sha256 hex

	t.Run("empty registration returns empty", func(t *testing.T) {
		empty := NewMapProvider(nil, nil)
		assert.Equal(t, "", empty.IndexAffectingHash(group, resource))
	})

	t.Run("unknown (group, resource) returns empty", func(t *testing.T) {
		assert.Equal(t, "", p.IndexAffectingHash("other.grafana.app", "things"))
	})

	t.Run("stable under field reordering", func(t *testing.T) {
		reordered := []SearchFieldDefinition{base[1], base[0]}
		p2 := NewMapProvider(map[schema.GroupVersionResource][]SearchFieldDefinition{v0: reordered}, nil)
		assert.Equal(t, h, p2.IndexAffectingHash(group, resource))
	})

	t.Run("stable under capability reordering", func(t *testing.T) {
		flipped := []SearchFieldDefinition{
			{Name: "email", Path: "spec.email", Type: SearchFieldTypeString, Capabilities: []SearchCapability{SearchCapabilityRetrieve, SearchCapabilityFilter}},
			base[1],
		}
		p2 := NewMapProvider(map[schema.GroupVersionResource][]SearchFieldDefinition{v0: flipped}, nil)
		assert.Equal(t, h, p2.IndexAffectingHash(group, resource))
	})

	t.Run("insensitive to Description", func(t *testing.T) {
		withDesc := make([]SearchFieldDefinition, len(base))
		copy(withDesc, base)
		withDesc[0].Description = "the email address of the user"
		p2 := NewMapProvider(map[schema.GroupVersionResource][]SearchFieldDefinition{v0: withDesc}, nil)
		assert.Equal(t, h, p2.IndexAffectingHash(group, resource))
	})

	t.Run("sensitive to each indexed field", func(t *testing.T) {
		cases := map[string]func(*SearchFieldDefinition){
			"Name":             func(s *SearchFieldDefinition) { s.Name = "emailX" },
			"Path":             func(s *SearchFieldDefinition) { s.Path = "spec.emailX" },
			"Type":             func(s *SearchFieldDefinition) { s.Type = SearchFieldTypeBoolean },
			"Array":            func(s *SearchFieldDefinition) { s.Array = true },
			"Capabilities":     func(s *SearchFieldDefinition) { s.Capabilities = []SearchCapability{SearchCapabilityRetrieve} },
			"EmitZeroIfAbsent": func(s *SearchFieldDefinition) { s.EmitZeroIfAbsent = true },
			"CopyFromStandard": func(s *SearchFieldDefinition) { s.CopyFromStandard = StandardFieldCreated },
		}
		for name, mutate := range cases {
			t.Run(name, func(t *testing.T) {
				mutated := make([]SearchFieldDefinition, len(base))
				copy(mutated, base)
				mutate(&mutated[0])
				p2 := NewMapProvider(map[schema.GroupVersionResource][]SearchFieldDefinition{v0: mutated}, nil)
				assert.NotEqual(t, h, p2.IndexAffectingHash(group, resource), "mutating %s must change the hash", name)
			})
		}
	})

	t.Run("covers every registered version", func(t *testing.T) {
		v1Fields := []SearchFieldDefinition{
			{Name: "email", Path: "spec.email", Type: SearchFieldTypeString, Capabilities: []SearchCapability{SearchCapabilityFilter, SearchCapabilityRetrieve}},
		}
		pMulti := NewMapProvider(map[schema.GroupVersionResource][]SearchFieldDefinition{
			v0: base,
			v1: v1Fields,
		}, nil)
		hMulti := pMulti.IndexAffectingHash(group, resource)
		assert.NotEqual(t, h, hMulti, "adding a new version must change the hash")

		// Changing only the non-preferred version must still change the hash.
		drifted := []SearchFieldDefinition{
			{Name: "email", Path: "spec.emailAddress", Type: SearchFieldTypeString, Capabilities: []SearchCapability{SearchCapabilityFilter, SearchCapabilityRetrieve}},
		}
		pDrifted := NewMapProvider(map[schema.GroupVersionResource][]SearchFieldDefinition{
			v0: base,
			v1: drifted,
		}, nil)
		assert.NotEqual(t, hMulti, pDrifted.IndexAffectingHash(group, resource))
	})

	t.Run("unaffected by sibling (group, resource)", func(t *testing.T) {
		other := schema.GroupVersionResource{Group: group, Version: "v0alpha1", Resource: "teams"}
		pSibling := NewMapProvider(map[schema.GroupVersionResource][]SearchFieldDefinition{
			v0:    base,
			other: {{Name: "email", Type: SearchFieldTypeString}},
		}, nil)
		assert.Equal(t, h, pSibling.IndexAffectingHash(group, resource))
	})
}

// TestMapProvider_IndexAffectingHash_GoldenHash pins the hash output for a
// fixed reference input. The hash is computed from json.Marshal of a
// canonical struct payload that includes both StandardSearchFieldDefinitions
// and the per-(group, resource) declarations; Go's encoding/json output
// for plain string, bool, and []string fields is stable in practice but
// not explicitly pinned by the language spec.
//
// If a Go release ever shifts the canonical form (struct field encoding
// order, HTML-escape default, string escape rules, etc.), or if the
// standard set changes intentionally, this test fails immediately in CI
// rather than silently reindexing every kind that registers a
// SearchFieldsProvider. When that happens, update the literal and
// document the cause (Go upgrade vs deliberate standard-set change).
func TestMapProvider_IndexAffectingHash_GoldenHash(t *testing.T) {
	const (
		group    = "example.test"
		resource = "widgets"
	)
	v0 := schema.GroupVersionResource{Group: group, Version: "v0alpha1", Resource: resource}
	v1 := schema.GroupVersionResource{Group: group, Version: "v1", Resource: resource}

	p := NewMapProvider(map[schema.GroupVersionResource][]SearchFieldDefinition{
		v0: {
			{Name: "email", Path: "spec.email", Type: SearchFieldTypeString, Capabilities: []SearchCapability{SearchCapabilityFilter, SearchCapabilityRetrieve}},
			{Name: "disabled", Path: "spec.disabled", Type: SearchFieldTypeBoolean, Capabilities: []SearchCapability{SearchCapabilityRetrieve}, EmitZeroIfAbsent: true},
			{Name: "createdAt", Type: SearchFieldTypeInt64, Capabilities: []SearchCapability{SearchCapabilityFilter, SearchCapabilityRetrieve}, CopyFromStandard: StandardFieldCreated},
			{Name: "members", Path: "spec.members[*].name", Type: SearchFieldTypeString, Array: true, Capabilities: []SearchCapability{SearchCapabilityFilter, SearchCapabilityRetrieve}},
		},
		v1: {
			{Name: "email", Path: "spec.email", Type: SearchFieldTypeString, Capabilities: []SearchCapability{SearchCapabilityFilter, SearchCapabilityRetrieve}},
		},
	}, nil)

	const expected = "4cbe51ac08dd6cbc987b353d503f253a9aa0b478b4c7ef09ee0c5e5f29644a20"
	assert.Equal(t, expected, p.IndexAffectingHash(group, resource),
		"canonical hash drifted. If json.Marshal output changed (Go release), update the literal; otherwise a code change shifted the canonical form.")
}

func TestValidateSearchFieldDefinitions(t *testing.T) {
	t.Run("string with sort is valid", func(t *testing.T) {
		err := validateSearchFieldDefinitions([]SearchFieldDefinition{
			{Name: "title", Type: SearchFieldTypeString, Capabilities: []SearchCapability{SearchCapabilityFilter, SearchCapabilitySort}},
		})
		require.NoError(t, err)
	})
	t.Run("date with sort is rejected (allowlist is minimal)", func(t *testing.T) {
		err := validateSearchFieldDefinitions([]SearchFieldDefinition{
			{Name: "when", Type: SearchFieldTypeDate, Capabilities: []SearchCapability{SearchCapabilitySort}},
		})
		require.Error(t, err)
	})
	t.Run("unknown with sort is rejected (forces explicit Type)", func(t *testing.T) {
		err := validateSearchFieldDefinitions([]SearchFieldDefinition{
			{Name: "x", Type: SearchFieldTypeUnknown, Capabilities: []SearchCapability{SearchCapabilitySort}},
		})
		require.Error(t, err)
	})
	t.Run("int64 with sort is rejected", func(t *testing.T) {
		err := validateSearchFieldDefinitions([]SearchFieldDefinition{
			{Name: "created", Type: SearchFieldTypeInt64, Capabilities: []SearchCapability{SearchCapabilityFilter, SearchCapabilitySort}},
		})
		require.Error(t, err)
		assert.Contains(t, err.Error(), "created")
		assert.Contains(t, err.Error(), "int64")
	})
	t.Run("boolean with sort is rejected", func(t *testing.T) {
		err := validateSearchFieldDefinitions([]SearchFieldDefinition{
			{Name: "disabled", Type: SearchFieldTypeBoolean, Capabilities: []SearchCapability{SearchCapabilitySort}},
		})
		require.Error(t, err)
		assert.Contains(t, err.Error(), "boolean")
	})
	t.Run("double with sort is rejected", func(t *testing.T) {
		err := validateSearchFieldDefinitions([]SearchFieldDefinition{
			{Name: "score", Type: SearchFieldTypeDouble, Capabilities: []SearchCapability{SearchCapabilitySort}},
		})
		require.Error(t, err)
		assert.Contains(t, err.Error(), "double")
	})
	t.Run("numeric without sort is valid", func(t *testing.T) {
		err := validateSearchFieldDefinitions([]SearchFieldDefinition{
			{Name: "created", Type: SearchFieldTypeInt64, Capabilities: []SearchCapability{SearchCapabilityFilter, SearchCapabilityRetrieve}},
		})
		require.NoError(t, err)
	})
	t.Run("multiple violations reported together", func(t *testing.T) {
		err := validateSearchFieldDefinitions([]SearchFieldDefinition{
			{Name: "a", Type: SearchFieldTypeInt64, Capabilities: []SearchCapability{SearchCapabilitySort}},
			{Name: "b", Type: SearchFieldTypeBoolean, Capabilities: []SearchCapability{SearchCapabilitySort}},
		})
		require.Error(t, err)
		assert.Contains(t, err.Error(), "a")
		assert.Contains(t, err.Error(), "b")
	})
	t.Run("NewMapProvider panics on invalid declarations", func(t *testing.T) {
		gvr := schema.GroupVersionResource{Group: "example.test", Version: "v0", Resource: "widgets"}
		assert.Panics(t, func() {
			NewMapProvider(map[schema.GroupVersionResource][]SearchFieldDefinition{
				gvr: {{Name: "bad", Type: SearchFieldTypeInt64, Capabilities: []SearchCapability{SearchCapabilitySort}}},
			}, nil)
		})
	})
	t.Run("StandardSearchFieldDefinitions passes validation", func(t *testing.T) {
		err := validateSearchFieldDefinitions(StandardSearchFieldDefinitions())
		require.NoError(t, err)
	})
	t.Run("text on int64 is rejected", func(t *testing.T) {
		err := validateSearchFieldDefinitions([]SearchFieldDefinition{
			{Name: "created", Type: SearchFieldTypeInt64, Capabilities: []SearchCapability{SearchCapabilityText}},
		})
		require.Error(t, err)
		assert.Contains(t, err.Error(), "text")
		assert.Contains(t, err.Error(), "int64")
	})
	t.Run("partial on boolean is rejected", func(t *testing.T) {
		err := validateSearchFieldDefinitions([]SearchFieldDefinition{
			{Name: "disabled", Type: SearchFieldTypeBoolean, Capabilities: []SearchCapability{SearchCapabilityPartial}},
		})
		require.Error(t, err)
		assert.Contains(t, err.Error(), "partial")
	})
	t.Run("facet on double is rejected", func(t *testing.T) {
		err := validateSearchFieldDefinitions([]SearchFieldDefinition{
			{Name: "score", Type: SearchFieldTypeDouble, Capabilities: []SearchCapability{SearchCapabilityFacet}},
		})
		require.Error(t, err)
		assert.Contains(t, err.Error(), "facet")
	})
	t.Run("text on string is valid", func(t *testing.T) {
		err := validateSearchFieldDefinitions([]SearchFieldDefinition{
			{Name: "title", Type: SearchFieldTypeString, Capabilities: []SearchCapability{SearchCapabilityText}},
		})
		require.NoError(t, err)
	})
	t.Run("facet on string is valid", func(t *testing.T) {
		err := validateSearchFieldDefinitions([]SearchFieldDefinition{
			{Name: "tag", Type: SearchFieldTypeString, Capabilities: []SearchCapability{SearchCapabilityFacet}},
		})
		require.NoError(t, err)
	})
}
