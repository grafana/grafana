package rbac

import (
	"strings"
	"testing"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// Test-only wildcard pattern; not used in the real mapper.
const testWildcardPattern = "*.test.grafana.app"

// TestMapperRegistry_DatasourceWildcard verifies the real mapper's *.datasource.grafana.app entry.
// Generic wildcard behavior (match + deny cases) is covered by TestMapperRegistry_WildcardGroup.
func TestMapperRegistry_DatasourceWildcard(t *testing.T) {
	reg := NewMapperRegistry()

	// Real config: groups matching *.datasource.grafana.app get the datasources mapping
	for _, group := range []string{"loki.datasource.grafana.app", "mimir.datasource.grafana.app"} {
		mapping, ok := reg.Get(group, "datasources")
		require.True(t, ok, "Get(%q, \"datasources\") should find mapping", group)
		require.NotNil(t, mapping)
		assert.Equal(t, "datasources:uid:", mapping.Prefix())
		all := reg.GetAll(group)
		require.Len(t, all, 1)
	}

	// Security: wildcard-matched group must not resolve to resources from other groups
	_, ok := reg.Get("loki.datasource.grafana.app", "dashboards")
	assert.False(t, ok, "Get(datasource group, \"dashboards\") must not return a mapping")
}

// TestFindGroupKey_WildcardMatching exercises findGroupKey via a minimal mapper.
// It covers: exact match, wildcard match, group starts with *, key not wildcard (continue),
// suffix mismatch, empty group, and no match.
func TestFindGroupKey_WildcardMatching(t *testing.T) {
	tests := []struct {
		requestedGroup string
		keys           []string // keys in mapper (exact and/or wildcard)
		expectedKey    string
		matches        bool
	}{
		// Exact match: requested group is a key in the mapper
		{"exact.grafana.app", []string{"exact.grafana.app"}, "exact.grafana.app", true},
		// Wildcard match: group has suffix of wildcard key and is longer than suffix
		{"foo.test.grafana.app", []string{testWildcardPattern}, testWildcardPattern, true},
		{"bar.test.grafana.app", []string{testWildcardPattern}, testWildcardPattern, true},
		// group with nested dots does not match wildcard
		{"bar.baz.test.grafana.app", []string{testWildcardPattern}, "", false},
		// Group starts with *: never matches
		{"*.test.grafana.app", []string{testWildcardPattern}, "", false},
		// Key not a wildcard (no *.): iterate and continue, no match
		{"foo.test.grafana.app", []string{"dashboard.grafana.app"}, "", false},
		{"foo.test.grafana.app", []string{"*"}, "", false},
		// Suffix mismatch or group not longer than suffix
		{"dashboard.grafana.app", []string{testWildcardPattern}, "", false},
		{"test.grafana.app", []string{testWildcardPattern}, "", false},
		{"", []string{testWildcardPattern}, "", false},
		// Exact match preferred over wildcard when both exist
		{"foo.test.grafana.app", []string{"foo.test.grafana.app", testWildcardPattern}, "foo.test.grafana.app", true},
	}
	for _, tt := range tests {
		t.Run(tt.requestedGroup+"_"+strings.Join(tt.keys, ","), func(t *testing.T) {
			m := make(mapper)
			for _, k := range tt.keys {
				m[k] = map[string]translation{"r": newResourceTranslation("r", "uid", false, nil)}
			}
			key, ok := m.findGroupKey(tt.requestedGroup)
			assert.Equal(t, tt.matches, ok)
			assert.Equal(t, tt.expectedKey, key)
		})
	}
}

func TestMapperRegistry_WildcardGroup(t *testing.T) {
	// Test-only mapper with *.test.grafana.app; exercises full wildcard behavior (match + deny)
	tr := newResourceTranslation("testresources", "uid", false, nil)
	m := mapper{
		testWildcardPattern: {
			"testresources": tr,
		},
	}
	var reg MapperRegistry = m

	// Matching groups get the mapping
	for _, group := range []string{"foo.test.grafana.app", "bar.test.grafana.app", "baz.test.grafana.app"} {
		t.Run("matches_"+group, func(t *testing.T) {
			mapping, ok := reg.Get(group, "testresources")
			require.True(t, ok, "Get(%q, \"testresources\") should find mapping", group)
			require.NotNil(t, mapping)
			assert.Equal(t, "testresources:uid:", mapping.Prefix())
			all := reg.GetAll(group)
			require.Len(t, all, 1)
			assert.Equal(t, mapping.Prefix(), all[0].Prefix())
		})
	}

	// Wildcard as input, wrong suffix, no prefix, or unknown group must not resolve
	denyCases := []struct {
		name  string
		group string
	}{
		{"wildcard_input", testWildcardPattern},
		{"wrong_suffix", "foo.test.grafana.app.evil"},
		{"no_prefix", "test.grafana.app"},
		{"unknown_group", "unknown.grafana.app"},
	}
	for _, tc := range denyCases {
		t.Run("deny_"+tc.name, func(t *testing.T) {
			_, ok := reg.Get(tc.group, "testresources")
			assert.False(t, ok, "Get(%q) must not return a mapping", tc.group)
			all := reg.GetAll(tc.group)
			assert.Empty(t, all, "GetAll(%q) must not return any mappings", tc.group)
		})
	}
}

func TestMapperRegistry_ExactMatchPreferred(t *testing.T) {
	reg := NewMapperRegistry()

	// Exact group keys still work
	mapping, ok := reg.Get("dashboard.grafana.app", "dashboards")
	require.True(t, ok)
	require.NotNil(t, mapping)
	assert.Equal(t, "dashboards:uid:", mapping.Prefix())
}

// TestMapper_AnnotationSubresource_Scope tests that the annotations subresource uses dashboard scope format
func TestMapper_AnnotationSubresource_Scope(t *testing.T) {
	mapper := NewMapperRegistry()

	mapping, ok := mapper.Get("dashboard.grafana.app", "dashboards/annotations")
	require.True(t, ok, "annotations subresource should be registered")
	require.NotNil(t, mapping)

	tests := []struct {
		name          string
		identifier    string
		expectedScope string
	}{
		{
			name:          "scope for specific dashboard uses dashboard scope format",
			identifier:    "test-dashboard-123",
			expectedScope: "dashboards:uid:test-dashboard-123",
		},
		{
			name:          "scope with wildcard uses dashboard scope format",
			identifier:    "*",
			expectedScope: "dashboards:uid:*",
		},
		{
			name:          "scope with empty identifier",
			identifier:    "",
			expectedScope: "dashboards:uid:",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			scope := mapping.Scope(tt.identifier)
			assert.Equal(t, tt.expectedScope, scope)
		})
	}

	t.Run("prefix is dashboard scope prefix", func(t *testing.T) {
		prefix := mapping.Prefix()
		assert.Equal(t, "dashboards:uid:", prefix)
	})

	t.Run("resource name is dashboards for scoping", func(t *testing.T) {
		resource := mapping.Resource()
		assert.Equal(t, "dashboards", resource, "annotation subresource should use dashboard resource for scoping")
	})

	t.Run("has folder support", func(t *testing.T) {
		assert.True(t, mapping.HasFolderSupport(), "annotations should support folder inheritance")
	})

	t.Run("does not skip scope on create", func(t *testing.T) {
		assert.False(t, mapping.SkipScope(utils.VerbCreate), "annotations should not skip scope check on create")
	})
}

// TestService_AnnotationSubresource_ScopeHandling tests that annotation permissions use dashboard scope
func TestService_AnnotationSubresource_ScopeHandling(t *testing.T) {
	tests := []struct {
		name        string
		permissions []accesscontrol.Permission
		expected    map[string]bool
	}{
		{
			name: "annotations:create permission uses dashboard scope",
			permissions: []accesscontrol.Permission{
				{
					Action:     "annotations:create",
					Scope:      "dashboards:uid:test-dashboard",
					Kind:       "dashboards",
					Attribute:  "uid",
					Identifier: "test-dashboard",
				},
			},
			expected: map[string]bool{
				"dashboards:uid:test-dashboard": true,
			},
		},
		{
			name: "annotations permission on folder scope for dashboard inheritance",
			permissions: []accesscontrol.Permission{
				{
					Action:     "annotations:create",
					Scope:      "folders:uid:parent-folder",
					Kind:       "folders",
					Attribute:  "uid",
					Identifier: "parent-folder",
				},
			},
			expected: map[string]bool{
				"folders:uid:parent-folder": true,
			},
		},
		{
			name: "wildcard annotations permission is normalized to wildcard",
			permissions: []accesscontrol.Permission{
				{
					Action:     "annotations:write",
					Scope:      "dashboards:uid:*",
					Kind:       "dashboards",
					Attribute:  "uid",
					Identifier: "*",
				},
			},
			expected: map[string]bool{
				"*": true, // Wildcard is normalized to just "*"
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			s := setupAnnotationService()
			scopeMap := s.getScopeMap(tt.permissions)
			assert.Equal(t, tt.expected, scopeMap)
		})
	}
}

// TestMapper_AnnotationSubresource_Integration tests the mapper integration for resolving subresources
func TestMapper_AnnotationSubresource_Integration(t *testing.T) {
	mapper := NewMapperRegistry()

	tests := []struct {
		name           string
		group          string
		resource       string
		subresource    string
		verb           string
		expectedAction string
		shouldError    bool
	}{
		{
			name:           "annotations subresource resolves correctly",
			group:          "dashboard.grafana.app",
			resource:       "dashboards",
			subresource:    "annotations",
			verb:           utils.VerbCreate,
			expectedAction: "annotations:create",
			shouldError:    false,
		},
		{
			name:           "no subresource resolves to dashboard action",
			group:          "dashboard.grafana.app",
			resource:       "dashboards",
			subresource:    "",
			verb:           utils.VerbGet,
			expectedAction: "dashboards:read",
			shouldError:    false,
		},
		{
			name:        "invalid subresource returns no mapping",
			group:       "dashboard.grafana.app",
			resource:    "dashboards",
			subresource: "invalid",
			verb:        utils.VerbCreate,
			shouldError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var resourceKey string
			if tt.subresource != "" {
				resourceKey = tt.resource + "/" + tt.subresource
			} else {
				resourceKey = tt.resource
			}

			translation, ok := mapper.Get(tt.group, resourceKey)

			if tt.shouldError {
				assert.False(t, ok, "should not find mapping for invalid subresource")
				return
			}

			require.True(t, ok, "should find mapping")
			require.NotNil(t, translation)

			action, ok := translation.Action(tt.verb)
			require.True(t, ok, "verb should map to action")
			assert.Equal(t, tt.expectedAction, action)
		})
	}
}

// setupAnnotationService creates a service with just the mapper for simple tests
func setupAnnotationService() *Service {
	return &Service{
		mapper: NewMapperRegistry(),
		logger: log.NewNopLogger(),
		tracer: tracing.InitializeTracerForTest(),
	}
}
