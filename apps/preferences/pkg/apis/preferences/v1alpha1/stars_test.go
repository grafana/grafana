package v1alpha1

import (
	"testing"

	"github.com/stretchr/testify/require"
)

type starItem struct {
	group string
	kind  string
	name  string
}

func TestStarsWrite(t *testing.T) {
	t.Run("apply", func(t *testing.T) {
		tests := []struct {
			name   string
			spec   *StarsSpec
			item   starItem
			remove bool
			expect *StarsSpec
		}{{
			name: "add to an existing array",
			spec: &StarsSpec{
				Resource: []StarsResource{{
					Group: "g",
					Kind:  "k",
					Names: []string{"a", "b", "x"},
				}},
			},
			item: starItem{
				group: "g",
				kind:  "k",
				name:  "c",
			},
			remove: false,
			expect: &StarsSpec{
				Resource: []StarsResource{{
					Group: "g",
					Kind:  "k",
					Names: []string{"a", "b", "c", "x"}, // added "b" (and sorted)
				}},
			},
		}, {
			name: "remove from an existing array",
			spec: &StarsSpec{
				Resource: []StarsResource{{
					Group: "g",
					Kind:  "k",
					Names: []string{"a", "b", "c"},
				}},
			},
			item: starItem{
				group: "g",
				kind:  "k",
				name:  "b",
			},
			remove: true,
			expect: &StarsSpec{
				Resource: []StarsResource{{
					Group: "g",
					Kind:  "k",
					Names: []string{"a", "c"}, // removed "b"
				}},
			},
		}, {
			name: "add to empty spec",
			spec: &StarsSpec{},
			item: starItem{
				group: "g",
				kind:  "k",
				name:  "a",
			},
			remove: false,
			expect: &StarsSpec{
				Resource: []StarsResource{{
					Group: "g",
					Kind:  "k",
					Names: []string{"a"},
				}},
			},
		}, {
			name: "remove item that does not exist",
			spec: &StarsSpec{
				Resource: []StarsResource{{
					Group: "g",
					Kind:  "k",
					Names: []string{"x"},
				}},
			},
			item: starItem{
				group: "g",
				kind:  "k",
				name:  "a",
			},
			remove: true,
		}, {
			name: "add item that already exist",
			spec: &StarsSpec{
				Resource: []StarsResource{{
					Group: "g",
					Kind:  "k",
					Names: []string{"x"},
				}},
			},
			item: starItem{
				group: "g",
				kind:  "k",
				name:  "x",
			},
			remove: false,
		}, {
			name: "remove from empty",
			spec: &StarsSpec{},
			item: starItem{
				group: "g",
				kind:  "k",
				name:  "a",
			},
			remove: true,
		}, {
			name: "remove item that does not exist",
			spec: &StarsSpec{
				Resource: []StarsResource{{
					Group: "g",
					Kind:  "k",
					Names: []string{"a", "b", "c"},
				}},
			},
			item: starItem{
				group: "g",
				kind:  "k",
				name:  "X",
			},
			remove: true,
		}, {
			name: "remove last item",
			spec: &StarsSpec{
				Resource: []StarsResource{{
					Group: "g",
					Kind:  "k",
					Names: []string{"a"},
				}},
			},
			item: starItem{
				group: "g",
				kind:  "k",
				name:  "a",
			},
			remove: true,
			expect: &StarsSpec{}, // empty object
		}, {
			name: "remove last item (with others)",
			spec: &StarsSpec{
				Resource: []StarsResource{{
					Group: "g",
					Kind:  "k",
					Names: []string{"a"},
				}, {
					Group: "g2",
					Kind:  "k2",
					Names: []string{"a"},
				}}},
			item: starItem{
				group: "g",
				kind:  "k",
				name:  "a",
			},
			remove: true,
			expect: &StarsSpec{
				Resource: []StarsResource{{
					Group: "g2",
					Kind:  "k2",
					Names: []string{"a"},
				}}},
		}}
		for _, tt := range tests {
			t.Run(tt.name, func(t *testing.T) {
				if tt.expect == nil {
					tt.expect = tt.spec.DeepCopy()
				}

				if tt.remove {
					tt.spec.Remove(tt.item.group, tt.item.kind, tt.item.name)
				} else {
					tt.spec.Add(tt.item.group, tt.item.kind, tt.item.name)
				}

				require.Equal(t, tt.expect, tt.spec)
			})
		}
	})

	t.Run("changes", func(t *testing.T) {
		tests := []struct {
			name    string
			current []string
			target  []string
			added   []string
			removed []string
			same    []string
		}{{
			name:    "same",
			current: []string{"a"},
			target:  []string{"a"},
			same:    []string{"a"},
		}, {
			name:    "adding one",
			current: []string{"a"},
			target:  []string{"a", "b"},
			same:    []string{"a"},
			added:   []string{"b"},
		}, {
			name:    "removing one",
			current: []string{"a", "b"},
			target:  []string{"a"},
			same:    []string{"a"},
			removed: []string{"b"},
		}, {
			name:    "removed to empty",
			current: []string{"a"},
			target:  []string{},
			removed: []string{"a"},
		}}
		for _, tt := range tests {
			t.Run(tt.name, func(t *testing.T) {
				a, r, s := Changes(tt.current, tt.target)
				require.Equal(t, tt.added, a, "added")
				require.Equal(t, tt.removed, r, "removed")
				require.Equal(t, tt.same, s, "same")
			})
		}
	})
}
