package v2beta1

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGetRefIdFromNumber(t *testing.T) {
	testCases := []struct {
		num      int
		expected string
	}{
		{0, "A"},
		{1, "B"},
		{25, "Z"},
		{26, "AA"},
		{27, "AB"},
		{51, "AZ"},
		{52, "BA"},
		{701, "ZZ"},
		{702, "AAA"},
	}

	for _, tc := range testCases {
		t.Run(tc.expected, func(t *testing.T) {
			result := getRefIdFromNumber(tc.num)
			assert.Equal(t, tc.expected, result, "getRefIdFromNumber(%d) should return %s", tc.num, tc.expected)
		})
	}
}

func TestGetNextRefId(t *testing.T) {
	testCases := []struct {
		name     string
		existing map[string]bool
		expected string
	}{
		{
			name:     "empty map returns A",
			existing: map[string]bool{},
			expected: "A",
		},
		{
			name:     "A exists returns B",
			existing: map[string]bool{"A": true},
			expected: "B",
		},
		{
			name:     "A and B exist returns C",
			existing: map[string]bool{"A": true, "B": true},
			expected: "C",
		},
		{
			name:     "gap in sequence returns first available",
			existing: map[string]bool{"A": true, "C": true, "D": true},
			expected: "B",
		},
		{
			name: "A-Z exist returns AA",
			existing: func() map[string]bool {
				m := make(map[string]bool)
				for i := 0; i < 26; i++ {
					m[string(rune('A'+i))] = true
				}
				return m
			}(),
			expected: "AA",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			result := getNextRefId(tc.existing)
			assert.Equal(t, tc.expected, result)
		})
	}
}

func TestEnsureUniqueRefIds(t *testing.T) {
	t.Run("assigns unique refIds to queries without refIds", func(t *testing.T) {
		spec := &DashboardSpec{
			Elements: map[string]DashboardElement{
				"panel-1": {
					PanelKind: &DashboardPanelKind{
						Kind: "Panel",
						Spec: DashboardPanelSpec{
							Data: DashboardQueryGroupKind{
								Spec: DashboardQueryGroupSpec{
									Queries: []DashboardPanelQueryKind{
										{Spec: DashboardPanelQuerySpec{RefId: ""}},
										{Spec: DashboardPanelQuerySpec{RefId: ""}},
										{Spec: DashboardPanelQuerySpec{RefId: ""}},
									},
								},
							},
						},
					},
				},
			},
		}

		EnsureUniqueRefIds(spec)

		panel := spec.Elements["panel-1"].PanelKind
		require.NotNil(t, panel)
		require.Len(t, panel.Spec.Data.Spec.Queries, 3)
		assert.Equal(t, "A", panel.Spec.Data.Spec.Queries[0].Spec.RefId)
		assert.Equal(t, "B", panel.Spec.Data.Spec.Queries[1].Spec.RefId)
		assert.Equal(t, "C", panel.Spec.Data.Spec.Queries[2].Spec.RefId)
	})

	t.Run("preserves existing refIds and fills gaps", func(t *testing.T) {
		spec := &DashboardSpec{
			Elements: map[string]DashboardElement{
				"panel-1": {
					PanelKind: &DashboardPanelKind{
						Kind: "Panel",
						Spec: DashboardPanelSpec{
							Data: DashboardQueryGroupKind{
								Spec: DashboardQueryGroupSpec{
									Queries: []DashboardPanelQueryKind{
										{Spec: DashboardPanelQuerySpec{RefId: "A"}},
										{Spec: DashboardPanelQuerySpec{RefId: ""}},
										{Spec: DashboardPanelQuerySpec{RefId: "D"}},
										{Spec: DashboardPanelQuerySpec{RefId: ""}},
									},
								},
							},
						},
					},
				},
			},
		}

		EnsureUniqueRefIds(spec)

		panel := spec.Elements["panel-1"].PanelKind
		require.NotNil(t, panel)
		require.Len(t, panel.Spec.Data.Spec.Queries, 4)
		assert.Equal(t, "A", panel.Spec.Data.Spec.Queries[0].Spec.RefId)
		assert.Equal(t, "B", panel.Spec.Data.Spec.Queries[1].Spec.RefId)
		assert.Equal(t, "D", panel.Spec.Data.Spec.Queries[2].Spec.RefId)
		assert.Equal(t, "C", panel.Spec.Data.Spec.Queries[3].Spec.RefId)
	})

	t.Run("handles library panels (no modification)", func(t *testing.T) {
		spec := &DashboardSpec{
			Elements: map[string]DashboardElement{
				"panel-1": {
					LibraryPanelKind: &DashboardLibraryPanelKind{
						Kind: "LibraryPanel",
						Spec: DashboardLibraryPanelKindSpec{
							LibraryPanel: DashboardLibraryPanelRef{
								Uid:  "lib-uid",
								Name: "lib-name",
							},
						},
					},
				},
			},
		}

		// Should not panic
		EnsureUniqueRefIds(spec)
	})

	t.Run("handles multiple panels", func(t *testing.T) {
		spec := &DashboardSpec{
			Elements: map[string]DashboardElement{
				"panel-1": {
					PanelKind: &DashboardPanelKind{
						Kind: "Panel",
						Spec: DashboardPanelSpec{
							Data: DashboardQueryGroupKind{
								Spec: DashboardQueryGroupSpec{
									Queries: []DashboardPanelQueryKind{
										{Spec: DashboardPanelQuerySpec{RefId: ""}},
										{Spec: DashboardPanelQuerySpec{RefId: ""}},
									},
								},
							},
						},
					},
				},
				"panel-2": {
					PanelKind: &DashboardPanelKind{
						Kind: "Panel",
						Spec: DashboardPanelSpec{
							Data: DashboardQueryGroupKind{
								Spec: DashboardQueryGroupSpec{
									Queries: []DashboardPanelQueryKind{
										{Spec: DashboardPanelQuerySpec{RefId: ""}},
										{Spec: DashboardPanelQuerySpec{RefId: ""}},
									},
								},
							},
						},
					},
				},
			},
		}

		EnsureUniqueRefIds(spec)

		// Each panel should have unique refIds independently
		panel1 := spec.Elements["panel-1"].PanelKind
		panel2 := spec.Elements["panel-2"].PanelKind
		require.NotNil(t, panel1)
		require.NotNil(t, panel2)

		assert.Equal(t, "A", panel1.Spec.Data.Spec.Queries[0].Spec.RefId)
		assert.Equal(t, "B", panel1.Spec.Data.Spec.Queries[1].Spec.RefId)

		assert.Equal(t, "A", panel2.Spec.Data.Spec.Queries[0].Spec.RefId)
		assert.Equal(t, "B", panel2.Spec.Data.Spec.Queries[1].Spec.RefId)
	})
}
