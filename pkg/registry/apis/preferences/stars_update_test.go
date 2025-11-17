package preferences

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestStarsWrite(t *testing.T) {
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
