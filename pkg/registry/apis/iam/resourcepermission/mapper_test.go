package resourcepermission

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/authlib/types"

	v0alpha1 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
)

// --- NewMappersRegistry defaults ---

func TestNewMappersRegistry_Defaults(t *testing.T) {
	m := NewMappersRegistry()

	folderGR := schema.GroupResource{Group: "folder.grafana.app", Resource: "folders"}
	dashGR := schema.GroupResource{Group: "dashboard.grafana.app", Resource: "dashboards"}

	t.Run("folders mapper is registered and enabled", func(t *testing.T) {
		_, ok := m.Get(folderGR)
		assert.True(t, ok)
		assert.True(t, m.IsEnabled(folderGR))
	})

	t.Run("dashboards mapper is registered and enabled", func(t *testing.T) {
		_, ok := m.Get(dashGR)
		assert.True(t, ok)
		assert.True(t, m.IsEnabled(dashGR))
	})

	t.Run("unknown group/resource returns not found", func(t *testing.T) {
		_, ok := m.Get(schema.GroupResource{Group: "other.grafana.app", Resource: "other"})
		assert.False(t, ok)
		assert.False(t, m.IsEnabled(schema.GroupResource{Group: "other.grafana.app", Resource: "other"}))
	})
}

// --- RegisterMapper ---

func TestMappersRegistry_RegisterMapper(t *testing.T) {
	t.Run("nil enabled func is always enabled", func(t *testing.T) {
		m := NewMappersRegistry()
		gr := schema.GroupResource{Group: "datasource.grafana.app", Resource: "datasources"}
		m.RegisterMapper(gr, NewMapper("datasources", []string{"query"}), nil)

		_, ok := m.Get(gr)
		assert.True(t, ok)
		assert.True(t, m.IsEnabled(gr))
	})

	t.Run("disabled mapper is Get-able but not IsEnabled", func(t *testing.T) {
		m := NewMappersRegistry()
		gr := schema.GroupResource{Group: "loki.datasource.grafana.app", Resource: "datasources"}
		m.RegisterMapper(gr, NewMapper("datasources", []string{"query"}), func() bool { return false })

		_, ok := m.Get(gr)
		assert.True(t, ok, "Get should succeed regardless of enabled state")
		assert.False(t, m.IsEnabled(gr))
	})

	t.Run("disabled mapper is excluded from EnabledScopePatterns and EnabledActionSets", func(t *testing.T) {
		m := NewMappersRegistry()
		gr := schema.GroupResource{Group: "loki.datasource.grafana.app", Resource: "datasources"}
		m.RegisterMapper(gr, NewMapper("datasources", []string{"query"}), func() bool { return false })

		for _, p := range m.EnabledScopePatterns() {
			assert.NotEqual(t, "datasources:uid:%", p)
		}
		for _, a := range m.EnabledActionSets() {
			assert.NotEqual(t, "datasources:query", a)
		}
	})
}

// --- ParseScope ---

func TestMappersRegistry_ParseScope(t *testing.T) {
	m := NewMappersRegistry()

	t.Run("parses folder scope", func(t *testing.T) {
		grn, err := m.ParseScope("folders:uid:fold1", "")
		require.NoError(t, err)
		assert.Equal(t, "folder.grafana.app", grn.Group)
		assert.Equal(t, "folders", grn.Resource)
		assert.Equal(t, "fold1", grn.Name)
	})

	t.Run("parses dashboard scope", func(t *testing.T) {
		grn, err := m.ParseScope("dashboards:uid:dash1", "")
		require.NoError(t, err)
		assert.Equal(t, "dashboard.grafana.app", grn.Group)
		assert.Equal(t, "dashboards", grn.Resource)
		assert.Equal(t, "dash1", grn.Name)
	})

	t.Run("parses dynamically registered datasource scope", func(t *testing.T) {
		m2 := NewMappersRegistry()
		gr := schema.GroupResource{Group: "datasource.grafana.app", Resource: "datasources"}
		m2.RegisterMapper(gr, NewMapper("datasources", []string{"query", "edit", "admin"}), nil)

		grn, err := m2.ParseScope("datasources:uid:abc", "")
		require.NoError(t, err)
		assert.Equal(t, "datasource.grafana.app", grn.Group)
		assert.Equal(t, "datasources", grn.Resource)
		assert.Equal(t, "abc", grn.Name)
	})

	t.Run("unknown scope prefix returns error", func(t *testing.T) {
		_, err := m.ParseScope("unknown:uid:x", "")
		assert.ErrorIs(t, err, errUnknownGroupResource)
	})

	t.Run("malformed scope (no colons) returns error", func(t *testing.T) {
		_, err := m.ParseScope("nocolons", "")
		assert.ErrorIs(t, err, errInvalidScope)
	})

	t.Run("only two parts returns error", func(t *testing.T) {
		_, err := m.ParseScope("folders:uid", "")
		assert.ErrorIs(t, err, errInvalidScope)
	})
}

// --- EnabledActionSets / EnabledScopePatterns ---

func TestMappersRegistry_EnabledFiltered(t *testing.T) {
	gr := schema.GroupResource{Group: "datasource.grafana.app", Resource: "datasources"}

	t.Run("enabled mapper contributes to both slices", func(t *testing.T) {
		m := NewMappersRegistry()
		m.RegisterMapper(gr, NewMapper("datasources", []string{"query", "edit"}), nil)

		assert.Contains(t, m.EnabledScopePatterns(), "datasources:uid:%")
		assert.Contains(t, m.EnabledActionSets(), "datasources:query")
		assert.Contains(t, m.EnabledActionSets(), "datasources:edit")
	})

	t.Run("disabled mapper is excluded from both slices", func(t *testing.T) {
		m := NewMappersRegistry()
		m.RegisterMapper(gr, NewMapper("datasources", []string{"query"}), func() bool { return false })

		assert.NotContains(t, m.EnabledScopePatterns(), "datasources:uid:%")
		assert.NotContains(t, m.EnabledActionSets(), "datasources:query")
	})

	t.Run("defaults always appear in both slices", func(t *testing.T) {
		m := NewMappersRegistry()
		patterns := m.EnabledScopePatterns()
		assert.Contains(t, patterns, "folders:uid:%")
		assert.Contains(t, patterns, "dashboards:uid:%")
		actions := m.EnabledActionSets()
		assert.Contains(t, actions, "folders:view")
		assert.Contains(t, actions, "dashboards:edit")
	})
}

// --- Wildcard group resolution ---

func TestMappersRegistry_WildcardResolution(t *testing.T) {
	t.Run("exact match takes precedence over wildcard", func(t *testing.T) {
		m := NewMappersRegistry()
		// Register wildcard first
		m.RegisterMapper(
			schema.GroupResource{Group: "*.datasource.grafana.app", Resource: "datasources"},
			NewMapper("datasources", []string{"query", "edit", "admin"}),
			nil,
		)
		// Register exact match
		exactGR := schema.GroupResource{Group: "loki.datasource.grafana.app", Resource: "datasources"}
		m.RegisterMapper(exactGR, NewMapper("lokidatasources", []string{"view"}), nil)

		// Should return the exact match
		mapper, ok := m.Get(exactGR)
		require.True(t, ok)
		assert.Equal(t, "lokidatasources:uid:%", mapper.ScopePattern())
	})

	t.Run("wildcard matches single-segment prefix", func(t *testing.T) {
		m := NewMappersRegistry()
		m.RegisterMapper(
			schema.GroupResource{Group: "*.datasource.grafana.app", Resource: "datasources"},
			NewMapper("datasources", []string{"query", "edit", "admin"}),
			nil,
		)

		testCases := []struct {
			group       string
			shouldMatch bool
		}{
			{"loki.datasource.grafana.app", true},
			{"tempo.datasource.grafana.app", true},
			{"prometheus.datasource.grafana.app", true},
			{"mysql.datasource.grafana.app", true},
		}

		for _, tc := range testCases {
			t.Run(tc.group, func(t *testing.T) {
				gr := schema.GroupResource{Group: tc.group, Resource: "datasources"}
				mapper, ok := m.Get(gr)
				if tc.shouldMatch {
					require.True(t, ok, "expected wildcard match for %s", tc.group)
					assert.NotNil(t, mapper)
					assert.Equal(t, "datasources:uid:%", mapper.ScopePattern())
					assert.True(t, m.IsEnabled(gr))
				} else {
					assert.False(t, ok, "expected no match for %s", tc.group)
				}
			})
		}
	})

	t.Run("wildcard does not match multi-segment prefix", func(t *testing.T) {
		m := NewMappersRegistry()
		m.RegisterMapper(
			schema.GroupResource{Group: "*.datasource.grafana.app", Resource: "datasources"},
			NewMapper("datasources", []string{"query", "edit", "admin"}),
			nil,
		)

		// Multi-segment prefix should not match
		gr := schema.GroupResource{Group: "foo.loki.datasource.grafana.app", Resource: "datasources"}
		_, ok := m.Get(gr)
		assert.False(t, ok, "multi-segment prefix should not match wildcard")
		assert.False(t, m.IsEnabled(gr))
	})

	t.Run("wildcard as input is rejected", func(t *testing.T) {
		m := NewMappersRegistry()
		m.RegisterMapper(
			schema.GroupResource{Group: "*.datasource.grafana.app", Resource: "datasources"},
			NewMapper("datasources", []string{"query", "edit", "admin"}),
			nil,
		)

		// Using the wildcard key directly as input should not work
		gr := schema.GroupResource{Group: "*.datasource.grafana.app", Resource: "datasources"}
		_, ok := m.Get(gr)
		assert.False(t, ok, "wildcard as input should be rejected")
		assert.False(t, m.IsEnabled(gr))
	})

	t.Run("wildcard with disabled mapper", func(t *testing.T) {
		m := NewMappersRegistry()
		enabled := false
		m.RegisterMapper(
			schema.GroupResource{Group: "*.datasource.grafana.app", Resource: "datasources"},
			NewMapper("datasources", []string{"query", "edit", "admin"}),
			func() bool { return enabled },
		)

		// Get should work (returns mapper regardless of enabled state)
		gr := schema.GroupResource{Group: "loki.datasource.grafana.app", Resource: "datasources"}
		mapper, ok := m.Get(gr)
		require.True(t, ok)
		assert.NotNil(t, mapper)

		// But IsEnabled should return false
		assert.False(t, m.IsEnabled(gr))

		// Should not appear in enabled lists
		assert.NotContains(t, m.EnabledScopePatterns(), "datasources:uid:%")
		assert.NotContains(t, m.EnabledActionSets(), "datasources:query")

		// Enable it
		enabled = true
		assert.True(t, m.IsEnabled(gr))
		assert.Contains(t, m.EnabledScopePatterns(), "datasources:uid:%")
		assert.Contains(t, m.EnabledActionSets(), "datasources:query")
	})
}

func TestMappersRegistry_Wildcard_EnabledPatterns(t *testing.T) {
	m := NewMappersRegistry()

	// Register wildcard datasources
	m.RegisterMapper(
		schema.GroupResource{Group: "*.datasource.grafana.app", Resource: "datasources"},
		NewMapper("datasources", []string{"query", "edit", "admin"}),
		nil,
	)

	t.Run("EnabledScopePatterns emits wildcard scope pattern once", func(t *testing.T) {
		patterns := m.EnabledScopePatterns()

		// Count occurrences of datasources:uid:%
		count := 0
		for _, p := range patterns {
			if p == "datasources:uid:%" {
				count++
			}
		}
		assert.Equal(t, 1, count, "wildcard entry should emit scope pattern exactly once")

		// Should also include folders and dashboards from default registry
		assert.Contains(t, patterns, "folders:uid:%")
		assert.Contains(t, patterns, "dashboards:uid:%")
	})

	t.Run("EnabledActionSets includes datasource action sets", func(t *testing.T) {
		actionSets := m.EnabledActionSets()

		// Datasource action sets should appear
		assert.Contains(t, actionSets, "datasources:query")
		assert.Contains(t, actionSets, "datasources:edit")
		assert.Contains(t, actionSets, "datasources:admin")

		// Default action sets should still appear
		assert.Contains(t, actionSets, "folders:view")
		assert.Contains(t, actionSets, "dashboards:view")
	})
}

func TestMappersRegistry_Wildcard_ParseScope(t *testing.T) {
	m := NewMappersRegistry()

	// Register datasource mapper under wildcard key (like enterprise does)
	m.RegisterMapper(
		schema.GroupResource{Group: "*.datasource.grafana.app", Resource: "datasources"},
		NewMapper("datasources", []string{"query", "edit", "admin"}),
		nil,
	)

	grn, err := m.ParseScope("datasources:uid:ds1", "loki")
	require.NoError(t, err)
	assert.Equal(t, "loki.datasource.grafana.app", grn.Group)
	assert.Equal(t, "datasources", grn.Resource)
	assert.Equal(t, "ds1", grn.Name)
}

func TestMappersRegistry_MultipleWildcards(t *testing.T) {
	m := NewMappersRegistry()

	// Register multiple wildcard entries
	m.RegisterMapper(
		schema.GroupResource{Group: "*.datasource.grafana.app", Resource: "datasources"},
		NewMapper("datasources", []string{"query", "edit", "admin"}),
		nil,
	)
	m.RegisterMapper(
		schema.GroupResource{Group: "*.alerting.grafana.app", Resource: "alertrules"},
		NewMapper("alertrules", []string{"view", "edit"}),
		nil,
	)

	// Each concrete group should resolve to its respective wildcard
	dsGR := schema.GroupResource{Group: "loki.datasource.grafana.app", Resource: "datasources"}
	dsMapper, ok := m.Get(dsGR)
	require.True(t, ok)
	assert.Equal(t, "datasources:uid:%", dsMapper.ScopePattern())

	alertGR := schema.GroupResource{Group: "prometheus.alerting.grafana.app", Resource: "alertrules"}
	alertMapper, ok := m.Get(alertGR)
	require.True(t, ok)
	assert.Equal(t, "alertrules:uid:%", alertMapper.ScopePattern())

	dsGrn, err := m.ParseScope("datasources:uid:ds1", "loki")
	require.NoError(t, err)
	assert.Equal(t, "loki.datasource.grafana.app", dsGrn.Group)

	// For wildcard entries, returns "unknown.<suffix>" since we can't determine the concrete group.
	alertGrn, err := m.ParseScope("alertrules:uid:rule1", "")
	require.NoError(t, err)
	assert.Equal(t, "unknown.alerting.grafana.app", alertGrn.Group)
}

// --- NewMapper / NewIDScopedMapper / NewMapperWithAttribute ---

func TestNewMapper_UIDScoped(t *testing.T) {
	m := NewMapper("folders", []string{"view", "edit", "admin"})

	assert.Equal(t, "folders:uid:abc", m.Scope("abc"))
	assert.Equal(t, "folders:uid:%", m.ScopePattern())
	assert.Equal(t, []string{"folders:view", "folders:edit", "folders:admin"}, m.ActionSets())
}

func TestNewIDScopedMapper_IDScoped(t *testing.T) {
	m := NewIDScopedMapper("serviceaccounts", []string{"edit", "admin"})

	assert.Equal(t, "serviceaccounts:id:123", m.Scope("123"))
	assert.Equal(t, "serviceaccounts:id:%", m.ScopePattern())
}

func TestNewMapperWithAttribute_ExplicitAttribute(t *testing.T) {
	uid := NewMapperWithAttribute("folders", []string{"view"}, ScopeAttributeUID, nil)
	assert.Equal(t, "folders:uid:abc", uid.Scope("abc"))
	assert.Equal(t, "folders:uid:%", uid.ScopePattern())

	id := NewMapperWithAttribute("serviceaccounts", []string{"edit"}, ScopeAttributeID, nil)
	assert.Equal(t, "serviceaccounts:id:123", id.Scope("123"))
	assert.Equal(t, "serviceaccounts:id:%", id.ScopePattern())
}

// --- AllowsKind ---

func TestMapper_AllowsKind_NilAllowedKinds(t *testing.T) {
	m := NewMapper("folders", defaultLevels)

	// nil allowedKinds means all kinds are permitted
	assert.True(t, m.AllowsKind(v0alpha1.ResourcePermissionSpecPermissionKindUser))
	assert.True(t, m.AllowsKind(v0alpha1.ResourcePermissionSpecPermissionKindTeam))
	assert.True(t, m.AllowsKind(v0alpha1.ResourcePermissionSpecPermissionKindServiceAccount))
	assert.True(t, m.AllowsKind(v0alpha1.ResourcePermissionSpecPermissionKindBasicRole))
}

func TestMapper_AllowsKind_RestrictedList(t *testing.T) {
	allowedKinds := []v0alpha1.ResourcePermissionSpecPermissionKind{
		v0alpha1.ResourcePermissionSpecPermissionKindUser,
		v0alpha1.ResourcePermissionSpecPermissionKindServiceAccount,
		v0alpha1.ResourcePermissionSpecPermissionKindTeam,
	}
	m := NewMapperWithAttribute("serviceaccounts", []string{"edit", "admin"}, ScopeAttributeID, allowedKinds)

	assert.True(t, m.AllowsKind(v0alpha1.ResourcePermissionSpecPermissionKindUser))
	assert.True(t, m.AllowsKind(v0alpha1.ResourcePermissionSpecPermissionKindServiceAccount))
	assert.True(t, m.AllowsKind(v0alpha1.ResourcePermissionSpecPermissionKindTeam))
	assert.False(t, m.AllowsKind(v0alpha1.ResourcePermissionSpecPermissionKindBasicRole))
}

// --- RegisterResolver / GetResolver ---

func TestMappersRegistry_RegisterResolver(t *testing.T) {
	saGR := schema.GroupResource{Group: "iam.grafana.app", Resource: "serviceaccounts"}

	t.Run("registered resolver is returned by GetResolver", func(t *testing.T) {
		m := NewMappersRegistry()
		m.RegisterMapper(saGR, NewIDScopedMapper("serviceaccounts", defaultLevels), nil)

		r := &mockNameResolver{}
		m.RegisterResolver(saGR, r)

		got, ok := m.GetResolver(saGR)
		require.True(t, ok)
		assert.Equal(t, r, got)
	})

	t.Run("GetResolver returns false for unregistered resource", func(t *testing.T) {
		m := NewMappersRegistry()
		_, ok := m.GetResolver(schema.GroupResource{Group: "unknown.app", Resource: "things"})
		assert.False(t, ok)
	})

	t.Run("GetResolver uses wildcard group resolution", func(t *testing.T) {
		m := NewMappersRegistry()
		wildcardGR := schema.GroupResource{Group: "*.datasource.grafana.app", Resource: "datasources"}
		m.RegisterMapper(wildcardGR, NewMapper("datasources", defaultLevels), nil)

		r := &mockNameResolver{}
		m.RegisterResolver(wildcardGR, r)

		// A concrete group that matches the wildcard should find the resolver
		concreteGR := schema.GroupResource{Group: "loki.datasource.grafana.app", Resource: "datasources"}
		got, ok := m.GetResolver(concreteGR)
		require.True(t, ok)
		assert.Equal(t, r, got)
	})
}

// --- ParseScopeCtx with resolver ---

func TestMappersRegistry_ParseScopeCtx_WithResolver(t *testing.T) {
	ctx := context.Background()
	ns := types.NamespaceInfo{Value: "org-1"}
	saGR := schema.GroupResource{Group: "iam.grafana.app", Resource: "serviceaccounts"}

	t.Run("resolver translates id to uid", func(t *testing.T) {
		m := NewMappersRegistry()
		m.RegisterMapper(saGR, NewIDScopedMapper("serviceaccounts", defaultLevels), nil)
		m.RegisterResolver(saGR, &mockNameResolver{idToUID: map[string]string{"42": "sa-uid-abc"}})

		grn, err := m.ParseScopeCtx(ctx, ns, nil, "serviceaccounts:id:42", "")
		require.NoError(t, err)
		assert.Equal(t, "sa-uid-abc", grn.Name)
		assert.Equal(t, "serviceaccounts", grn.Resource)
		assert.Equal(t, "iam.grafana.app", grn.Group)
	})

	t.Run("resolver error is propagated", func(t *testing.T) {
		m := NewMappersRegistry()
		m.RegisterMapper(saGR, NewIDScopedMapper("serviceaccounts", defaultLevels), nil)
		m.RegisterResolver(saGR, &mockNameResolver{idToUIDErr: errors.New("k8s unavailable")})

		_, err := m.ParseScopeCtx(ctx, ns, nil, "serviceaccounts:id:42", "")
		require.Error(t, err)
		assert.Contains(t, err.Error(), "k8s unavailable")
	})

	t.Run("uid-scoped resource passes name through unchanged", func(t *testing.T) {
		m := NewMappersRegistry()

		grn, err := m.ParseScopeCtx(ctx, ns, nil, "folders:uid:fold1", "")
		require.NoError(t, err)
		assert.Equal(t, "fold1", grn.Name)
		assert.Equal(t, "folder.grafana.app", grn.Group)
	})

	t.Run("id-scoped resource without resolver and nil store passes name through", func(t *testing.T) {
		m := NewMappersRegistry()
		m.RegisterMapper(saGR, NewIDScopedMapper("serviceaccounts", defaultLevels), nil)

		// No resolver registered, nil store — name is returned as-is (numeric ID)
		grn, err := m.ParseScopeCtx(ctx, ns, nil, "serviceaccounts:id:42", "")
		require.NoError(t, err)
		assert.Equal(t, "42", grn.Name)
	})
}
