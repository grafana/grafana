package preferences

import (
	"testing"

	"github.com/stretchr/testify/require"

	preferences "github.com/grafana/grafana/apps/preferences/pkg/apis/preferences/v1alpha1"
)

func TestStarsWrite(t *testing.T) {
	t.Run("apply", func(t *testing.T) {
		tests := []struct {
			name    string
			spec    preferences.StarsSpec
			item    starItem
			remove  bool
			changed bool
			expect  preferences.StarsSpec
		}{{
			name: "add to an existing array",
			spec: preferences.StarsSpec{
				Resource: []preferences.StarsResource{{
					Group: "g",
					Kind:  "k",
					Names: []string{"a", "b", "c"},
				}},
			},
			item: starItem{
				group: "g",
				kind:  "k",
				id:    "x",
			},
			remove:  false,
			changed: true,
			expect: preferences.StarsSpec{
				Resource: []preferences.StarsResource{{
					Group: "g",
					Kind:  "k",
					Names: []string{"a", "b", "c", "x"}, // added "x"
				}},
			},
		}, {
			name: "remove from an existing array",
			spec: preferences.StarsSpec{
				Resource: []preferences.StarsResource{{
					Group: "g",
					Kind:  "k",
					Names: []string{"a", "b", "c"},
				}},
			},
			item: starItem{
				group: "g",
				kind:  "k",
				id:    "b",
			},
			remove:  true,
			changed: true,
			expect: preferences.StarsSpec{
				Resource: []preferences.StarsResource{{
					Group: "g",
					Kind:  "k",
					Names: []string{"a", "c"}, // removed "b"
				}},
			},
		}, {
			name: "add to empty spec",
			spec: preferences.StarsSpec{},
			item: starItem{
				group: "g",
				kind:  "k",
				id:    "a",
			},
			remove:  false,
			changed: true,
			expect: preferences.StarsSpec{
				Resource: []preferences.StarsResource{{
					Group: "g",
					Kind:  "k",
					Names: []string{"a"},
				}},
			},
		}, {
			name: "remove item that does not exist",
			spec: preferences.StarsSpec{
				Resource: []preferences.StarsResource{{
					Group: "g",
					Kind:  "k",
					Names: []string{"x"},
				}},
			},
			item: starItem{
				group: "g",
				kind:  "k",
				id:    "a",
			},
			remove:  true,
			changed: false,
		}, {
			name: "add item that already exist",
			spec: preferences.StarsSpec{
				Resource: []preferences.StarsResource{{
					Group: "g",
					Kind:  "k",
					Names: []string{"x"},
				}},
			},
			item: starItem{
				group: "g",
				kind:  "k",
				id:    "x",
			},
			remove:  false,
			changed: false,
		}, {
			name: "remove from empty",
			spec: preferences.StarsSpec{},
			item: starItem{
				group: "g",
				kind:  "k",
				id:    "a",
			},
			remove:  true,
			changed: false,
		}, {
			name: "remove item that does not exist",
			spec: preferences.StarsSpec{
				Resource: []preferences.StarsResource{{
					Group: "g",
					Kind:  "k",
					Names: []string{"a", "b", "c"},
				}},
			},
			item: starItem{
				group: "g",
				kind:  "k",
				id:    "X",
			},
			remove:  true,
			changed: false,
		}, {
			name: "remove last item",
			spec: preferences.StarsSpec{
				Resource: []preferences.StarsResource{{
					Group: "g",
					Kind:  "k",
					Names: []string{"a"},
				}},
			},
			item: starItem{
				group: "g",
				kind:  "k",
				id:    "a",
			},
			remove:  true,
			changed: true,
			expect:  preferences.StarsSpec{},
		}, {
			name: "remove last item (with others)",
			spec: preferences.StarsSpec{
				Resource: []preferences.StarsResource{{
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
				id:    "a",
			},
			remove:  true,
			changed: true,
			expect: preferences.StarsSpec{
				Resource: []preferences.StarsResource{{
					Group: "g2",
					Kind:  "k2",
					Names: []string{"a"},
				}}},
		}}
		for _, tt := range tests {
			t.Run(tt.name, func(t *testing.T) {
				changed := apply(&tt.spec, tt.item, tt.remove)
				require.Equal(t, tt.changed, changed)
				if changed {
					require.Equal(t, tt.expect, tt.spec)
				}
			})
		}
	})

	t.Run("path", func(t *testing.T) {
		tests := []struct {
			name   string
			url    string
			prefix string
			item   starItem
			err    string
		}{{
			name:   "normal",
			url:    "http://localhost:3000/apis/preferences.grafana.app/v1alpha1/namespaces/default/stars/user-abc/write/dashboard.grafana.app/Dashboard/000000127",
			prefix: "/user-abc/write",
			item: starItem{
				group: "dashboard.grafana.app",
				kind:  "Dashboard",
				id:    "000000127",
			},
		}, {
			name:   "prefix not found",
			url:    "http://localhost:3000/apis/preferences.grafana.app/v1alpha1/namespaces/default/stars/user-abc/write/dashboard.grafana.app/Dashboard/000000127",
			prefix: "/something/write",
			err:    "invalid request path",
		}, {
			name:   "missing three parts",
			url:    "http://localhost:3000/apis/preferences.grafana.app/v1alpha1/namespaces/default/stars/user-abc/write/dashboard.grafana.app/000000127",
			prefix: "/user-abc/write",
			err:    "expected {group}/{kind}/{id}",
		}}
		for _, tt := range tests {
			t.Run(tt.name, func(t *testing.T) {
				item, err := itemFromPath(tt.url, tt.prefix)
				if tt.err == "" {
					require.NoError(t, err)
					require.Equal(t, tt.item, item)
				} else {
					require.ErrorContains(t, err, tt.err)
				}
			})
		}
	})
}
