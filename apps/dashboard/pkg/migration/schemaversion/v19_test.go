package schemaversion_test

import (
	"testing"

	"github.com/grafana/grafana/apps/dashboard/pkg/migration/schemaversion"
)

func TestV19(t *testing.T) {
	tests := []migrationTestCase{
		{
			name: "panel with legacy dashboard link gets upgraded to URL format",
			input: map[string]interface{}{
				"title":         "V19 Panel Links Migration Test Dashboard",
				"schemaVersion": 18,
				"panels": []interface{}{
					map[string]interface{}{
						"id": 1,
						"links": []interface{}{
							map[string]interface{}{
								"dashboard": "my dashboard",
								"title":     "Dashboard Link",
							},
						},
					},
				},
			},
			expected: map[string]interface{}{
				"title":         "V19 Panel Links Migration Test Dashboard",
				"schemaVersion": 19,
				"panels": []interface{}{
					map[string]interface{}{
						"id": 1,
						"links": []interface{}{
							map[string]interface{}{
								"url":         "dashboard/db/my-dashboard",
								"title":       "Dashboard Link",
								"targetBlank": false,
							},
						},
					},
				},
			},
		},
		{
			name: "panel with legacy dashUri link gets upgraded to URL format",
			input: map[string]interface{}{
				"title":         "V19 DashUri Links Migration Test Dashboard",
				"schemaVersion": 18,
				"panels": []interface{}{
					map[string]interface{}{
						"id": 1,
						"links": []interface{}{
							map[string]interface{}{
								"dashUri": "my-dashboard-uid",
								"title":   "DashUri Link",
							},
						},
					},
				},
			},
			expected: map[string]interface{}{
				"title":         "V19 DashUri Links Migration Test Dashboard",
				"schemaVersion": 19,
				"panels": []interface{}{
					map[string]interface{}{
						"id": 1,
						"links": []interface{}{
							map[string]interface{}{
								"url":         "dashboard/my-dashboard-uid",
								"title":       "DashUri Link",
								"targetBlank": false,
							},
						},
					},
				},
			},
		},
		{
			name: "panel with keepTime flag gets upgraded with keepTime parameter",
			input: map[string]interface{}{
				"title":         "V19 KeepTime Links Migration Test Dashboard",
				"schemaVersion": 18,
				"panels": []interface{}{
					map[string]interface{}{
						"id": 1,
						"links": []interface{}{
							map[string]interface{}{
								"url":      "http://example.com",
								"keepTime": true,
								"title":    "KeepTime Link",
							},
						},
					},
				},
			},
			expected: map[string]interface{}{
				"title":         "V19 KeepTime Links Migration Test Dashboard",
				"schemaVersion": 19,
				"panels": []interface{}{
					map[string]interface{}{
						"id": 1,
						"links": []interface{}{
							map[string]interface{}{
								"url":         "http://example.com?$__url_time_range",
								"title":       "KeepTime Link",
								"targetBlank": false,
							},
						},
					},
				},
			},
		},
		{
			name: "panel with includeVars flag gets upgraded with includeVars parameter",
			input: map[string]interface{}{
				"title":         "V19 IncludeVars Links Migration Test Dashboard",
				"schemaVersion": 18,
				"panels": []interface{}{
					map[string]interface{}{
						"id": 1,
						"links": []interface{}{
							map[string]interface{}{
								"url":         "http://example.com",
								"includeVars": true,
								"title":       "IncludeVars Link",
							},
						},
					},
				},
			},
			expected: map[string]interface{}{
				"title":         "V19 IncludeVars Links Migration Test Dashboard",
				"schemaVersion": 19,
				"panels": []interface{}{
					map[string]interface{}{
						"id": 1,
						"links": []interface{}{
							map[string]interface{}{
								"url":         "http://example.com?$__all_variables",
								"title":       "IncludeVars Link",
								"targetBlank": false,
							},
						},
					},
				},
			},
		},
		{
			name: "panel with custom params gets upgraded with params in URL",
			input: map[string]interface{}{
				"title":         "V19 Custom Params Links Migration Test Dashboard",
				"schemaVersion": 18,
				"panels": []interface{}{
					map[string]interface{}{
						"id": 1,
						"links": []interface{}{
							map[string]interface{}{
								"url":    "http://example.com",
								"params": "customParam=value",
								"title":  "Custom Params Link",
							},
						},
					},
				},
			},
			expected: map[string]interface{}{
				"title":         "V19 Custom Params Links Migration Test Dashboard",
				"schemaVersion": 19,
				"panels": []interface{}{
					map[string]interface{}{
						"id": 1,
						"links": []interface{}{
							map[string]interface{}{
								"url":         "http://example.com?customParam=value",
								"title":       "Custom Params Link",
								"targetBlank": false,
							},
						},
					},
				},
			},
		},
		{
			name: "panel with multiple flags and params gets upgraded correctly",
			input: map[string]interface{}{
				"title":         "V19 Complex Links Migration Test Dashboard",
				"schemaVersion": 18,
				"panels": []interface{}{
					map[string]interface{}{
						"id": 1,
						"links": []interface{}{
							map[string]interface{}{
								"dashboard":   "my dashboard",
								"keepTime":    true,
								"includeVars": true,
								"params":      "customParam=value",
								"title":       "Complex Link",
								"targetBlank": true,
							},
						},
					},
				},
			},
			expected: map[string]interface{}{
				"title":         "V19 Complex Links Migration Test Dashboard",
				"schemaVersion": 19,
				"panels": []interface{}{
					map[string]interface{}{
						"id": 1,
						"links": []interface{}{
							map[string]interface{}{
								"url":         "dashboard/db/my-dashboard?$__url_time_range&$__all_variables&customParam=value",
								"title":       "Complex Link",
								"targetBlank": true,
							},
						},
					},
				},
			},
		},
		{
			name: "panel with existing URL and no legacy properties remains unchanged",
			input: map[string]interface{}{
				"title":         "V19 Existing URL Links Migration Test Dashboard",
				"schemaVersion": 18,
				"panels": []interface{}{
					map[string]interface{}{
						"id": 1,
						"links": []interface{}{
							map[string]interface{}{
								"url":         "http://example.com",
								"title":       "Existing URL Link",
								"targetBlank": false,
							},
						},
					},
				},
			},
			expected: map[string]interface{}{
				"title":         "V19 Existing URL Links Migration Test Dashboard",
				"schemaVersion": 19,
				"panels": []interface{}{
					map[string]interface{}{
						"id": 1,
						"links": []interface{}{
							map[string]interface{}{
								"url":         "http://example.com",
								"title":       "Existing URL Link",
								"targetBlank": false,
							},
						},
					},
				},
			},
		},
		{
			name: "panel with no links remains unchanged",
			input: map[string]interface{}{
				"title":         "V19 No Links Migration Test Dashboard",
				"schemaVersion": 18,
				"panels": []interface{}{
					map[string]interface{}{
						"id": 1,
					},
				},
			},
			expected: map[string]interface{}{
				"title":         "V19 No Links Migration Test Dashboard",
				"schemaVersion": 19,
				"panels": []interface{}{
					map[string]interface{}{
						"id": 1,
					},
				},
			},
		},
		{
			name: "dashboard with no panels remains unchanged",
			input: map[string]interface{}{
				"title":         "V19 No Panels Migration Test Dashboard",
				"schemaVersion": 18,
			},
			expected: map[string]interface{}{
				"title":         "V19 No Panels Migration Test Dashboard",
				"schemaVersion": 19,
			},
		},
	}

	runMigrationTests(t, tests, schemaversion.V19)
}
