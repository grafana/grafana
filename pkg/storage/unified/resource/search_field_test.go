package resource

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

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

	shared := SearchFieldDefinition{Name: "shared", Type: SearchFieldTypeString, Capabilities: []SearchCapability{SearchCapabilityFilter, SearchCapabilityRetrieve}}
	p := NewMapProvider(
		map[schema.GroupVersionResource][]SearchFieldDefinition{
			v1: {
				shared,
				{Name: "only_v1", Type: SearchFieldTypeString, Capabilities: []SearchCapability{SearchCapabilityFilter}},
			},
			v2: {
				shared,
				{Name: "only_v2", Type: SearchFieldTypeString, Capabilities: []SearchCapability{SearchCapabilityFilter}},
			},
		},
		map[schema.GroupResource]string{gr: "v1"},
	)

	// Per-version lookup is unchanged.
	assert.Len(t, p.Fields(v1), 2)
	assert.Len(t, p.Fields(v2), 2)

	// Empty-version lookup returns the union deduped by Name. A field
	// declared identically in both versions appears once.
	union := p.Fields(schema.GroupVersionResource{Group: gr.Group, Resource: gr.Resource})
	names := make([]string, 0, len(union))
	for _, sfd := range union {
		names = append(names, sfd.Name)
	}
	assert.ElementsMatch(t, []string{"shared", "only_v1", "only_v2"}, names)
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
			{Name: "createdAt", Path: "spec.createdAt", Type: SearchFieldTypeInt64, Capabilities: []SearchCapability{SearchCapabilityFilter, SearchCapabilityRetrieve}},
			{Name: "members", Path: "spec.members[*].name", Type: SearchFieldTypeString, Array: true, Capabilities: []SearchCapability{SearchCapabilityFilter, SearchCapabilityRetrieve}},
		},
		v1: {
			{Name: "email", Path: "spec.email", Type: SearchFieldTypeString, Capabilities: []SearchCapability{SearchCapabilityFilter, SearchCapabilityRetrieve}},
		},
	}, nil)

	// Standard tags declare facet capability so Bleve facets use their keyword-analyzed mapping.
	const expected = "0f114ef8fa64163466eb9d3477163cfe964b5a626c37279d5e60a2586c18a064"
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
	t.Run("int64 with sort is valid", func(t *testing.T) {
		err := validateSearchFieldDefinitions([]SearchFieldDefinition{
			{Name: "created", Type: SearchFieldTypeInt64, Capabilities: []SearchCapability{SearchCapabilityFilter, SearchCapabilitySort}},
		})
		require.NoError(t, err)
	})
	t.Run("boolean with sort is valid", func(t *testing.T) {
		err := validateSearchFieldDefinitions([]SearchFieldDefinition{
			{Name: "disabled", Type: SearchFieldTypeBoolean, Capabilities: []SearchCapability{SearchCapabilitySort}},
		})
		require.NoError(t, err)
	})
	t.Run("double with sort is valid", func(t *testing.T) {
		err := validateSearchFieldDefinitions([]SearchFieldDefinition{
			{Name: "score", Type: SearchFieldTypeDouble, Capabilities: []SearchCapability{SearchCapabilitySort}},
		})
		require.NoError(t, err)
	})
	t.Run("numeric without sort is valid", func(t *testing.T) {
		err := validateSearchFieldDefinitions([]SearchFieldDefinition{
			{Name: "created", Type: SearchFieldTypeInt64, Capabilities: []SearchCapability{SearchCapabilityFilter, SearchCapabilityRetrieve}},
		})
		require.NoError(t, err)
	})
	t.Run("multiple violations reported together", func(t *testing.T) {
		err := validateSearchFieldDefinitions([]SearchFieldDefinition{
			{Name: "a", Type: SearchFieldTypeInt64, Capabilities: []SearchCapability{SearchCapabilityText}},
			{Name: "b", Type: SearchFieldTypeBoolean, Capabilities: []SearchCapability{SearchCapabilityFacet}},
		})
		require.Error(t, err)
		assert.Contains(t, err.Error(), "a")
		assert.Contains(t, err.Error(), "b")
	})
	t.Run("NewMapProvider panics on invalid declarations", func(t *testing.T) {
		gvr := schema.GroupVersionResource{Group: "example.test", Version: "v0", Resource: "widgets"}
		assert.Panics(t, func() {
			NewMapProvider(map[schema.GroupVersionResource][]SearchFieldDefinition{
				gvr: {{Name: "bad", Type: SearchFieldTypeInt64, Capabilities: []SearchCapability{SearchCapabilityText}}},
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

func TestValidateCrossVersionConsistency(t *testing.T) {
	gr := schema.GroupResource{Group: "example.test", Resource: "widgets"}
	v1 := schema.GroupVersionResource{Group: gr.Group, Version: "v1", Resource: gr.Resource}
	v2 := schema.GroupVersionResource{Group: gr.Group, Version: "v2", Resource: gr.Resource}

	t.Run("identical declaration across versions is allowed", func(t *testing.T) {
		shared := SearchFieldDefinition{Name: "label", Path: "spec.label", Type: SearchFieldTypeString, Capabilities: []SearchCapability{SearchCapabilityFilter, SearchCapabilityRetrieve}}
		err := validateCrossVersionConsistency(map[schema.GroupVersionResource][]SearchFieldDefinition{
			v1: {shared},
			v2: {shared},
		})
		require.NoError(t, err)
	})

	t.Run("capability order does not count as divergence", func(t *testing.T) {
		err := validateCrossVersionConsistency(map[schema.GroupVersionResource][]SearchFieldDefinition{
			v1: {{Name: "label", Type: SearchFieldTypeString, Capabilities: []SearchCapability{SearchCapabilityFilter, SearchCapabilityRetrieve}}},
			v2: {{Name: "label", Type: SearchFieldTypeString, Capabilities: []SearchCapability{SearchCapabilityRetrieve, SearchCapabilityFilter}}},
		})
		require.NoError(t, err)
	})

	t.Run("description differing across versions is allowed", func(t *testing.T) {
		err := validateCrossVersionConsistency(map[schema.GroupVersionResource][]SearchFieldDefinition{
			v1: {{Name: "label", Type: SearchFieldTypeString, Capabilities: []SearchCapability{SearchCapabilityFilter}, Description: "old"}},
			v2: {{Name: "label", Type: SearchFieldTypeString, Capabilities: []SearchCapability{SearchCapabilityFilter}, Description: "renamed for clarity"}},
		})
		require.NoError(t, err)
	})

	t.Run("path differing across versions is allowed", func(t *testing.T) {
		// Path is an extractor-side concern: each version's document is
		// extracted with that version's declaration, so v1 can read from
		// spec.foo while v2 reads from spec.bar without conflicting on the
		// shared bleve mapping.
		err := validateCrossVersionConsistency(map[schema.GroupVersionResource][]SearchFieldDefinition{
			v1: {{Name: "label", Path: "spec.foo", Type: SearchFieldTypeString, Capabilities: []SearchCapability{SearchCapabilityFilter}}},
			v2: {{Name: "label", Path: "spec.bar", Type: SearchFieldTypeString, Capabilities: []SearchCapability{SearchCapabilityFilter}}},
		})
		require.NoError(t, err)
	})

	t.Run("path real vs computed across versions is allowed", func(t *testing.T) {
		// One version backs the field with a JSON path, the other leaves
		// Path empty so a custom builder fills it in. The bleve mapping is
		// the same either way.
		err := validateCrossVersionConsistency(map[schema.GroupVersionResource][]SearchFieldDefinition{
			v1: {{Name: "label", Path: "spec.foo", Type: SearchFieldTypeString, Capabilities: []SearchCapability{SearchCapabilityFilter}}},
			v2: {{Name: "label", Type: SearchFieldTypeString, Capabilities: []SearchCapability{SearchCapabilityFilter}}},
		})
		require.NoError(t, err)
	})

	t.Run("emitZeroIfAbsent differing across versions is allowed", func(t *testing.T) {
		err := validateCrossVersionConsistency(map[schema.GroupVersionResource][]SearchFieldDefinition{
			v1: {{Name: "count", Type: SearchFieldTypeInt64, Capabilities: []SearchCapability{SearchCapabilityFilter}, EmitZeroIfAbsent: true}},
			v2: {{Name: "count", Type: SearchFieldTypeInt64, Capabilities: []SearchCapability{SearchCapabilityFilter}}},
		})
		require.NoError(t, err)
	})

	t.Run("duplicate capability within one declaration does not count as divergence", func(t *testing.T) {
		err := validateCrossVersionConsistency(map[schema.GroupVersionResource][]SearchFieldDefinition{
			v1: {{Name: "label", Type: SearchFieldTypeString, Capabilities: []SearchCapability{SearchCapabilityFilter, SearchCapabilityFilter, SearchCapabilityRetrieve}}},
			v2: {{Name: "label", Type: SearchFieldTypeString, Capabilities: []SearchCapability{SearchCapabilityFilter, SearchCapabilityRetrieve}}},
		})
		require.NoError(t, err)
	})

	t.Run("field declared in only one version is allowed", func(t *testing.T) {
		err := validateCrossVersionConsistency(map[schema.GroupVersionResource][]SearchFieldDefinition{
			v1: {{Name: "only_v1", Type: SearchFieldTypeString, Capabilities: []SearchCapability{SearchCapabilityFilter}}},
			v2: {{Name: "only_v2", Type: SearchFieldTypeString, Capabilities: []SearchCapability{SearchCapabilityFilter}}},
		})
		require.NoError(t, err)
	})

	t.Run("diverging capabilities are rejected", func(t *testing.T) {
		err := validateCrossVersionConsistency(map[schema.GroupVersionResource][]SearchFieldDefinition{
			v1: {{Name: "label", Type: SearchFieldTypeString, Capabilities: []SearchCapability{SearchCapabilityFilter, SearchCapabilityRetrieve}}},
			v2: {{Name: "label", Type: SearchFieldTypeString, Capabilities: []SearchCapability{SearchCapabilityText}}},
		})
		require.Error(t, err)
		assert.Contains(t, err.Error(), `field "label"`)
		assert.Contains(t, err.Error(), gr.String())
		assert.Contains(t, err.Error(), "v1")
		assert.Contains(t, err.Error(), "v2")
		assert.Contains(t, err.Error(), "capabilities")
	})

	t.Run("diverging type is rejected", func(t *testing.T) {
		err := validateCrossVersionConsistency(map[schema.GroupVersionResource][]SearchFieldDefinition{
			v1: {{Name: "count", Type: SearchFieldTypeInt64, Capabilities: []SearchCapability{SearchCapabilityFilter}}},
			v2: {{Name: "count", Type: SearchFieldTypeString, Capabilities: []SearchCapability{SearchCapabilityFilter}}},
		})
		require.Error(t, err)
		assert.Contains(t, err.Error(), "type")
	})

	t.Run("diverging array flag is rejected", func(t *testing.T) {
		err := validateCrossVersionConsistency(map[schema.GroupVersionResource][]SearchFieldDefinition{
			v1: {{Name: "tags", Type: SearchFieldTypeString, Array: true, Capabilities: []SearchCapability{SearchCapabilityFilter}}},
			v2: {{Name: "tags", Type: SearchFieldTypeString, Array: false, Capabilities: []SearchCapability{SearchCapabilityFilter}}},
		})
		require.Error(t, err)
		assert.Contains(t, err.Error(), "array")
	})

	t.Run("unrelated (group, resource) does not interfere", func(t *testing.T) {
		other := schema.GroupVersionResource{Group: "other.test", Version: "v1", Resource: "things"}
		err := validateCrossVersionConsistency(map[schema.GroupVersionResource][]SearchFieldDefinition{
			v1:    {{Name: "label", Type: SearchFieldTypeString, Capabilities: []SearchCapability{SearchCapabilityFilter}}},
			other: {{Name: "label", Type: SearchFieldTypeInt64, Capabilities: []SearchCapability{SearchCapabilityFilter}}},
		})
		require.NoError(t, err)
	})

	t.Run("NewMapProvider panics on cross-version divergence", func(t *testing.T) {
		assert.PanicsWithValue(t,
			`inconsistent SearchFieldDefinitions across versions: field "label" on widgets.example.test diverges across versions [v1, v2] on capabilities`,
			func() {
				NewMapProvider(map[schema.GroupVersionResource][]SearchFieldDefinition{
					v1: {{Name: "label", Type: SearchFieldTypeString, Capabilities: []SearchCapability{SearchCapabilityFilter}}},
					v2: {{Name: "label", Type: SearchFieldTypeString, Capabilities: []SearchCapability{SearchCapabilityText}}},
				}, nil)
			})
	})
}

func TestSearchFieldsRegistry(t *testing.T) {
	dash := NewLowerGroupResource("dashboard.grafana.app", "dashboards")
	provider := NewMapProvider(
		map[schema.GroupVersionResource][]SearchFieldDefinition{
			{Group: "dashboard.grafana.app", Version: "v1", Resource: "dashboards"}: {
				{Name: "title", Path: "spec.title", Type: SearchFieldTypeString, Capabilities: []SearchCapability{SearchCapabilityFilter}},
			},
		},
		nil,
	)

	r := NewSearchFieldsRegistry(
		map[LowerGroupResource][]string{dash: {"spec.a", "spec.b"}},
		map[LowerGroupResource]string{dash: "hash-1"},
		map[LowerGroupResource]SearchFieldsProvider{dash: provider},
	)

	t.Run("reads the seeded values", func(t *testing.T) {
		selectable, hash, p := r.For(dash)
		require.Equal(t, []string{"spec.a", "spec.b"}, selectable)
		require.Equal(t, "hash-1", hash)
		require.Same(t, provider, p)
	})

	t.Run("returns zero values for an unknown kind", func(t *testing.T) {
		other := NewLowerGroupResource("iam.grafana.app", "users")
		selectable, hash, p := r.For(other)
		require.Nil(t, selectable)
		require.Empty(t, hash)
		require.Nil(t, p)
	})

	t.Run("Replace swaps all three maps", func(t *testing.T) {
		r.Replace(
			map[LowerGroupResource][]string{dash: {"spec.c"}},
			map[LowerGroupResource]string{dash: "hash-2"},
			nil,
		)
		selectable, hash, p := r.For(dash)
		require.Equal(t, []string{"spec.c"}, selectable)
		require.Equal(t, "hash-2", hash)
		require.Nil(t, p)
	})
}
