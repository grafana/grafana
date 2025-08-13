package schemaversion_test

import (
	"testing"

	"github.com/grafana/grafana/apps/dashboard/pkg/migration/schemaversion"
)

func TestV16(t *testing.T) {
	tests := []migrationTestCase{
		{
			name: "should create proper grid",
			input: map[string]interface{}{
				"schemaVersion": 15,
				"rows": []interface{}{
					// createRow({ collapse: false, height: 8 }, [[6], [6]])
					map[string]interface{}{
						"collapse": false,
						"height":   304, // 8 * 38 (PANEL_HEIGHT_STEP)
						"panels": []interface{}{
							map[string]interface{}{
								"span": 6,
								"id":   1,
							},
							map[string]interface{}{
								"span": 6,
								"id":   2,
							},
						},
					},
				},
			},
			expected: map[string]interface{}{
				"schemaVersion": 16,
				"panels": []interface{}{
					map[string]interface{}{
						"id": 1,
						"gridPos": map[string]interface{}{
							"x": 0,
							"y": 0,
							"w": 12,
							"h": 8,
						},
					},
					map[string]interface{}{
						"id": 2,
						"gridPos": map[string]interface{}{
							"x": 12,
							"y": 0,
							"w": 12,
							"h": 8,
						},
					},
				},
			},
		},
		{
			name: "should add special row panel if row is collapsed",
			input: map[string]interface{}{
				"schemaVersion": 15,
				"rows": []interface{}{
					// createRow({ collapse: true, height: 8 }, [[6], [6]])
					map[string]interface{}{
						"collapse": true,
						"height":   304, // 8 * 38
						"panels": []interface{}{
							map[string]interface{}{
								"span": 6,
								"id":   1,
							},
							map[string]interface{}{
								"span": 6,
								"id":   2,
							},
						},
					},
					// createRow({ height: 8 }, [[12]])
					map[string]interface{}{
						"height": 304, // 8 * 38
						"panels": []interface{}{
							map[string]interface{}{
								"span": 12,
								"id":   3,
							},
						},
					},
				},
			},
			expected: map[string]interface{}{
				"schemaVersion": 16,
				"panels": []interface{}{
					// Collapsed row panel comes first
					map[string]interface{}{
						"id":        4,
						"type":      "row",
						"collapsed": true,
						"title":     "",
						"repeat":    "",
						"panels": []interface{}{
							map[string]interface{}{
								"id": 1,
								"gridPos": map[string]interface{}{
									"x": 0,
									"y": 1,
									"w": 12,
									"h": 8,
								},
							},
							map[string]interface{}{
								"id": 2,
								"gridPos": map[string]interface{}{
									"x": 12,
									"y": 1,
									"w": 12,
									"h": 8,
								},
							},
						},
						"gridPos": map[string]interface{}{
							"x": 0,
							"y": 0,
							"w": 24,
							"h": 8,
						},
					},
					// Then panel from second row
					map[string]interface{}{
						"id": 3,
						"gridPos": map[string]interface{}{
							"x": 0,
							"y": 2,
							"w": 24,
							"h": 8,
						},
					},
					// Then normal row panel
					map[string]interface{}{
						"id":        5,
						"type":      "row",
						"collapsed": false,
						"title":     "",
						"repeat":    "",
						"panels":    []interface{}{},
						"gridPos": map[string]interface{}{
							"x": 0,
							"y": 1,
							"w": 24,
							"h": 8,
						},
					},
				},
			},
		},
		{
			name: "should add special row panel if row has visible title",
			input: map[string]interface{}{
				"schemaVersion": 15,
				"rows": []interface{}{
					// createRow({ showTitle: true, title: 'Row', height: 8 }, [[6], [6]])
					map[string]interface{}{
						"showTitle": true,
						"title":     "Row",
						"height":    304, // 8 * 38
						"panels": []interface{}{
							map[string]interface{}{
								"span": 6,
								"id":   1,
							},
							map[string]interface{}{
								"span": 6,
								"id":   2,
							},
						},
					},
					// createRow({ height: 8 }, [[12]])
					map[string]interface{}{
						"height": 304, // 8 * 38
						"panels": []interface{}{
							map[string]interface{}{
								"span": 12,
								"id":   3,
							},
						},
					},
				},
			},
			expected: map[string]interface{}{
				"schemaVersion": 16,
				"panels": []interface{}{
					// Panels from first row come first
					map[string]interface{}{
						"id": 1,
						"gridPos": map[string]interface{}{
							"x": 0,
							"y": 1,
							"w": 12,
							"h": 8,
						},
					},
					map[string]interface{}{
						"id": 2,
						"gridPos": map[string]interface{}{
							"x": 12,
							"y": 1,
							"w": 12,
							"h": 8,
						},
					},
					// Then row panel for showTitle
					map[string]interface{}{
						"id":        4,
						"type":      "row",
						"collapsed": false,
						"title":     "Row",
						"repeat":    "",
						"panels":    []interface{}{},
						"gridPos": map[string]interface{}{
							"x": 0,
							"y": 0,
							"w": 24,
							"h": 8,
						},
					},
					// Then panel from second row
					map[string]interface{}{
						"id": 3,
						"gridPos": map[string]interface{}{
							"x": 0,
							"y": 10,
							"w": 24,
							"h": 8,
						},
					},
					// Then second row panel
					map[string]interface{}{
						"id":        5,
						"type":      "row",
						"collapsed": false,
						"title":     "",
						"repeat":    "",
						"panels":    []interface{}{},
						"gridPos": map[string]interface{}{
							"x": 0,
							"y": 9,
							"w": 24,
							"h": 8,
						},
					},
				},
			},
		},
		{
			name: "should properly place panels with fixed height",
			input: map[string]interface{}{
				"schemaVersion": 15,
				"rows": []interface{}{
					// createRow({ height: 6 }, [[6], [6, 3], [6, 3]])
					map[string]interface{}{
						"height": 228, // 6 * 38
						"panels": []interface{}{
							map[string]interface{}{
								"span": 6,
								"id":   1,
							},
							map[string]interface{}{
								"span":   6,
								"height": 114, // 3 * 38
								"id":     2,
							},
							map[string]interface{}{
								"span":   6,
								"height": 114, // 3 * 38
								"id":     3,
							},
						},
					},
				},
			},
			expected: map[string]interface{}{
				"schemaVersion": 16,
				"panels": []interface{}{
					map[string]interface{}{
						"id": 1,
						"gridPos": map[string]interface{}{
							"x": 0,
							"y": 0,
							"w": 12,
							"h": 6,
						},
					},
					map[string]interface{}{
						"id":     2,
						"height": 114, // 3 * 38 (preserved from input)
						"gridPos": map[string]interface{}{
							"x": 12,
							"y": 0,
							"w": 12,
							"h": 3,
						},
					},
					map[string]interface{}{
						"id":     3,
						"height": 114, // 3 * 38 (preserved from input)
						"gridPos": map[string]interface{}{
							"x": 12,
							"y": 3,
							"w": 12,
							"h": 3,
						},
					},
				},
			},
		},
		{
			name: "should handle panels without span",
			input: map[string]interface{}{
				"schemaVersion": 15,
				"rows": []interface{}{
					map[string]interface{}{
						"height": 304, // 8 * 38
						"panels": []interface{}{
							map[string]interface{}{
								"id": 1,
								// no span - should default to 4
							},
							map[string]interface{}{
								"span": 8,
								"id":   2,
							},
						},
					},
				},
			},
			expected: map[string]interface{}{
				"schemaVersion": 16,
				"panels": []interface{}{
					map[string]interface{}{
						"id": 1,
						"gridPos": map[string]interface{}{
							"x": 0,
							"y": 0,
							"w": 8, // default span 4 * widthFactor (2)
							"h": 8,
						},
					},
					map[string]interface{}{
						"id": 2,
						"gridPos": map[string]interface{}{
							"x": 8,
							"y": 0,
							"w": 16, // span 8 * widthFactor (2)
							"h": 8,
						},
					},
				},
			},
		},
		{
			name: "should handle minSpan conversion",
			input: map[string]interface{}{
				"schemaVersion": 15,
				"rows": []interface{}{
					map[string]interface{}{
						"height": 304, // 8 * 38
						"panels": []interface{}{
							map[string]interface{}{
								"span":    6,
								"minSpan": 4,
								"id":      1,
							},
						},
					},
				},
			},
			expected: map[string]interface{}{
				"schemaVersion": 16,
				"panels": []interface{}{
					map[string]interface{}{
						"id":      1,
						"minSpan": 8, // (24/12) * 4 = 8
						"gridPos": map[string]interface{}{
							"x": 0,
							"y": 0,
							"w": 12,
							"h": 8,
						},
					},
				},
			},
		},
		{
			name: "should handle dashboard with no rows",
			input: map[string]interface{}{
				"schemaVersion": 15,
				"title":         "No Rows",
			},
			expected: map[string]interface{}{
				"schemaVersion": 16,
				"title":         "No Rows",
			},
		},
		{
			name: "should handle dashboard with empty rows",
			input: map[string]interface{}{
				"schemaVersion": 15,
				"title":         "Empty Rows",
				"rows":          []interface{}{},
			},
			expected: map[string]interface{}{
				"schemaVersion": 16,
				"title":         "Empty Rows",
				"panels":        []interface{}{},
			},
		},
		{
			name: "should preserve existing panels",
			input: map[string]interface{}{
				"schemaVersion": 15,
				"panels": []interface{}{
					map[string]interface{}{
						"id":   10,
						"type": "existing",
					},
				},
				"rows": []interface{}{
					map[string]interface{}{
						"height": 304, // 8 * 38
						"panels": []interface{}{
							map[string]interface{}{
								"span": 12,
								"id":   1,
							},
						},
					},
				},
			},
			expected: map[string]interface{}{
				"schemaVersion": 16,
				"panels": []interface{}{
					map[string]interface{}{
						"id":   10,
						"type": "existing",
					},
					map[string]interface{}{
						"id": 1,
						"gridPos": map[string]interface{}{
							"x": 0,
							"y": 0,
							"w": 24,
							"h": 8,
						},
					},
				},
			},
		},
		{
			name: "should skip repeated row iterations",
			input: map[string]interface{}{
				"schemaVersion": 15,
				"rows": []interface{}{
					map[string]interface{}{
						"height": 304, // 8 * 38
						"panels": []interface{}{
							map[string]interface{}{
								"span": 12,
								"id":   1,
							},
						},
					},
					map[string]interface{}{
						"height":          304, // 8 * 38
						"repeatIteration": true,
						"panels": []interface{}{
							map[string]interface{}{
								"span": 12,
								"id":   2,
							},
						},
					},
				},
			},
			expected: map[string]interface{}{
				"schemaVersion": 16,
				"panels": []interface{}{
					map[string]interface{}{
						"id": 1,
						"gridPos": map[string]interface{}{
							"x": 0,
							"y": 0,
							"w": 24,
							"h": 8,
						},
					},
				},
			},
		},
	}

	runMigrationTests(t, tests, schemaversion.V16)
}
