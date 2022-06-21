package plugins

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func Test_FixedRoleFromPlugin(t *testing.T) {
	type testCase struct {
		name   string
		plugin Plugin
	}

	tt := []testCase{
		{
			name: "First run",
			plugin: Plugin{
				JSONData: JSONData{
					ID:   "test-plugin",
					Type: "app",
					Name: "test-plugin",
					Includes: []*Includes{
						{
							Name:       "route1",
							Path:       "/a/route1?path=\"path\"",
							Type:       "page",
							Role:       "Admin",
							AddToNav:   true,
							DefaultNav: true,
						},
						{
							Name:       "route2",
							Path:       "/a/route2?path=\"path\"",
							Type:       "page",
							Role:       "Editor",
							AddToNav:   true,
							DefaultNav: false,
						},
						{
							Name:       "route3",
							Path:       "/a/route3?path=\"path\"",
							Type:       "page",
							Role:       "Editor",
							AddToNav:   false,
							DefaultNav: false,
						},
					},
				},
			},
		},
	}

	for _, tc := range tt {
		t.Run(tc.name, func(t *testing.T) {
			registrations := FixedRoleFromPlugin(&tc.plugin)
			assert.NotNil(t, registrations)
		})
	}
}
