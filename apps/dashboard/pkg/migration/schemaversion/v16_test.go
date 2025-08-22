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
					map[string]interface{}{
						"id":        4, // Next ID after max panel ID (3)
						"type":      "row",
						"title":     "",
						"collapsed": true,
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
					map[string]interface{}{
						"id": 3,
						"gridPos": map[string]interface{}{
							"x": 0,
							"y": 2,
							"w": 24,
							"h": 8,
						},
					},
					map[string]interface{}{
						"id":        5, // Next ID after row panel (4)
						"type":      "row",
						"title":     "",
						"collapsed": false,
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
					map[string]interface{}{
						"id":        4, // Next ID after max panel ID (3)
						"type":      "row",
						"title":     "Row",
						"collapsed": false,
						"repeat":    "",
						"panels":    []interface{}{},
						"gridPos": map[string]interface{}{
							"x": 0,
							"y": 0,
							"w": 24,
							"h": 8,
						},
					},
					map[string]interface{}{
						"id": 3,
						"gridPos": map[string]interface{}{
							"x": 0,
							"y": 10,
							"w": 24,
							"h": 8,
						},
					},
					map[string]interface{}{
						"id":        5, // Next ID after row panel (4)
						"type":      "row",
						"title":     "",
						"collapsed": false,
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
			name: "should not add row panel if row has not visible title or not collapsed",
			input: map[string]interface{}{
				"schemaVersion": 15,
				"rows": []interface{}{
					map[string]interface{}{
						"collapse": true,
						"height":   304, // 8 * 38
						"panels": []interface{}{
							map[string]interface{}{
								"span": 12,
								"id":   1,
							},
						},
					},
					map[string]interface{}{
						"height": 304, // 8 * 38
						"panels": []interface{}{
							map[string]interface{}{
								"span": 12,
								"id":   2,
							},
						},
					},
					map[string]interface{}{
						"height": 304, // 8 * 38
						"panels": []interface{}{
							map[string]interface{}{
								"span": 12,
								"id":   3,
							},
							map[string]interface{}{
								"span": 6,
								"id":   4,
							},
							map[string]interface{}{
								"span": 6,
								"id":   5,
							},
						},
					},
					map[string]interface{}{
						"collapse": true,
						"height":   304, // 8 * 38
						"panels": []interface{}{
							map[string]interface{}{
								"span": 12,
								"id":   6,
							},
						},
					},
				},
			},
			expected: map[string]interface{}{
				"schemaVersion": 16,
				"panels": []interface{}{
					// First row: collapsed row (panels go in collapsed row's panels array, row panel added after)
					map[string]interface{}{
						"id":        7,
						"type":      "row",
						"title":     "",
						"collapsed": true,
						"repeat":    "",
						"panels": []interface{}{
							map[string]interface{}{
								"id": 1,
								"gridPos": map[string]interface{}{
									"x": 0,
									"y": 1,
									"w": 24,
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
					// Second row: normal row (regular panel first, then row panel)
					map[string]interface{}{
						"id": 2,
						"gridPos": map[string]interface{}{
							"x": 0,
							"y": 2,
							"w": 24,
							"h": 8,
						},
					},
					map[string]interface{}{
						"id":        8,
						"type":      "row",
						"title":     "",
						"collapsed": false,
						"repeat":    "",
						"panels":    []interface{}{},
						"gridPos": map[string]interface{}{
							"x": 0,
							"y": 1,
							"w": 24,
							"h": 8,
						},
					},
					// Third row: normal row (regular panels first, then row panel)
					map[string]interface{}{
						"id": 3,
						"gridPos": map[string]interface{}{
							"x": 0,
							"y": 11,
							"w": 24,
							"h": 8,
						},
					},
					map[string]interface{}{
						"id": 4,
						"gridPos": map[string]interface{}{
							"x": 0,
							"y": 19,
							"w": 12,
							"h": 8,
						},
					},
					map[string]interface{}{
						"id": 5,
						"gridPos": map[string]interface{}{
							"x": 12,
							"y": 19,
							"w": 12,
							"h": 8,
						},
					},
					map[string]interface{}{
						"id":        9,
						"type":      "row",
						"title":     "",
						"collapsed": false,
						"repeat":    "",
						"panels":    []interface{}{},
						"gridPos": map[string]interface{}{
							"x": 0,
							"y": 10,
							"w": 24,
							"h": 8,
						},
					},
					// Fourth row: collapsed row (panels go in collapsed row's panels array, row panel added after)
					map[string]interface{}{
						"id":        10,
						"type":      "row",
						"title":     "",
						"collapsed": true,
						"repeat":    "",
						"panels": []interface{}{
							map[string]interface{}{
								"id": 6,
								"gridPos": map[string]interface{}{
									"x": 0,
									"y": 28,
									"w": 24,
									"h": 8,
								},
							},
						},
						"gridPos": map[string]interface{}{
							"x": 0,
							"y": 27,
							"w": 24,
							"h": 8,
						},
					},
				},
			},
		},
		{
			name: "should add all rows if even one collapsed or titled row is present",
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
					map[string]interface{}{
						"id":        4, // Next ID after max panel ID (3)
						"type":      "row",
						"title":     "",
						"collapsed": true,
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
					map[string]interface{}{
						"id": 3,
						"gridPos": map[string]interface{}{
							"x": 0,
							"y": 2,
							"w": 24,
							"h": 8,
						},
					},
					map[string]interface{}{
						"id":        5, // Next ID after row panel (4)
						"type":      "row",
						"title":     "",
						"collapsed": false,
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
					// createRow({ height: 6 }, [[4], [4], [4, 3], [4, 3]])
					map[string]interface{}{
						"height": 228, // 6 * 38
						"panels": []interface{}{
							map[string]interface{}{
								"span": 4,
								"id":   4,
							},
							map[string]interface{}{
								"span": 4,
								"id":   5,
							},
							map[string]interface{}{
								"span":   4,
								"height": 114, // 3 * 38
								"id":     6,
							},
							map[string]interface{}{
								"span":   4,
								"height": 114, // 3 * 38
								"id":     7,
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
						"height": 114, // 3 * 38
						"gridPos": map[string]interface{}{
							"x": 12,
							"y": 0,
							"w": 12,
							"h": 3,
						},
					},
					map[string]interface{}{
						"id":     3,
						"height": 114, // 3 * 38
						"gridPos": map[string]interface{}{
							"x": 12,
							"y": 3,
							"w": 12,
							"h": 3,
						},
					},
					map[string]interface{}{
						"id": 4,
						"gridPos": map[string]interface{}{
							"x": 0,
							"y": 6,
							"w": 8,
							"h": 6,
						},
					},
					map[string]interface{}{
						"id": 5,
						"gridPos": map[string]interface{}{
							"x": 8,
							"y": 6,
							"w": 8,
							"h": 6,
						},
					},
					map[string]interface{}{
						"id":     6,
						"height": 114, // 3 * 38
						"gridPos": map[string]interface{}{
							"x": 16,
							"y": 6,
							"w": 8,
							"h": 3,
						},
					},
					map[string]interface{}{
						"id":     7,
						"height": 114, // 3 * 38
						"gridPos": map[string]interface{}{
							"x": 16,
							"y": 9,
							"w": 8,
							"h": 3,
						},
					},
				},
			},
		},
		{
			name: "should place panel to the right side of panel having bigger height",
			input: map[string]interface{}{
				"schemaVersion": 15,
				"rows": []interface{}{
					// createRow({ height: 6 }, [[4], [2, 3], [4, 6], [2, 3], [2, 3]])
					map[string]interface{}{
						"height": 228, // 6 * 38
						"panels": []interface{}{
							map[string]interface{}{
								"span": 4,
								"id":   1,
							},
							map[string]interface{}{
								"span":   2,
								"height": 114, // 3 * 38
								"id":     2,
							},
							map[string]interface{}{
								"span":   4,
								"height": 228, // 6 * 38
								"id":     3,
							},
							map[string]interface{}{
								"span":   2,
								"height": 114, // 3 * 38
								"id":     4,
							},
							map[string]interface{}{
								"span":   2,
								"height": 114, // 3 * 38
								"id":     5,
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
							"w": 8,
							"h": 6,
						},
					},
					map[string]interface{}{
						"id":     2,
						"height": 114, // 3 * 38
						"gridPos": map[string]interface{}{
							"x": 8,
							"y": 0,
							"w": 4,
							"h": 3,
						},
					},
					map[string]interface{}{
						"id":     3,
						"height": 228, // 6 * 38
						"gridPos": map[string]interface{}{
							"x": 12,
							"y": 0,
							"w": 8,
							"h": 6,
						},
					},
					map[string]interface{}{
						"id":     4,
						"height": 114, // 3 * 38
						"gridPos": map[string]interface{}{
							"x": 20,
							"y": 0,
							"w": 4,
							"h": 3,
						},
					},
					map[string]interface{}{
						"id":     5,
						"height": 114, // 3 * 38
						"gridPos": map[string]interface{}{
							"x": 20,
							"y": 3,
							"w": 4,
							"h": 3,
						},
					},
				},
			},
		},
		{
			name: "should fill current row if it possible",
			input: map[string]interface{}{
				"schemaVersion": 15,
				"rows": []interface{}{
					// createRow({ height: 9 }, [[4], [2, 3], [4, 6], [2, 3], [2, 3], [8, 3]])
					map[string]interface{}{
						"height": 342, // 9 * 38
						"panels": []interface{}{
							map[string]interface{}{
								"span": 4,
								"id":   1,
							},
							map[string]interface{}{
								"span":   2,
								"height": 114, // 3 * 38
								"id":     2,
							},
							map[string]interface{}{
								"span":   4,
								"height": 228, // 6 * 38
								"id":     3,
							},
							map[string]interface{}{
								"span":   2,
								"height": 114, // 3 * 38
								"id":     4,
							},
							map[string]interface{}{
								"span":   2,
								"height": 114, // 3 * 38
								"id":     5,
							},
							map[string]interface{}{
								"span":   8,
								"height": 114, // 3 * 38
								"id":     6,
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
							"w": 8,
							"h": 9,
						},
					},
					map[string]interface{}{
						"id":     2,
						"height": 114, // 3 * 38
						"gridPos": map[string]interface{}{
							"x": 8,
							"y": 0,
							"w": 4,
							"h": 3,
						},
					},
					map[string]interface{}{
						"id":     3,
						"height": 228, // 6 * 38
						"gridPos": map[string]interface{}{
							"x": 12,
							"y": 0,
							"w": 8,
							"h": 6,
						},
					},
					map[string]interface{}{
						"id":     4,
						"height": 114, // 3 * 38
						"gridPos": map[string]interface{}{
							"x": 20,
							"y": 0,
							"w": 4,
							"h": 3,
						},
					},
					map[string]interface{}{
						"id":     5,
						"height": 114, // 3 * 38
						"gridPos": map[string]interface{}{
							"x": 20,
							"y": 3,
							"w": 4,
							"h": 3,
						},
					},
					map[string]interface{}{
						"id":     6,
						"height": 114, // 3 * 38
						"gridPos": map[string]interface{}{
							"x": 8,
							"y": 6,
							"w": 16,
							"h": 3,
						},
					},
				},
			},
		},
		{
			name: "should fill current row if it possible (2)",
			input: map[string]interface{}{
				"schemaVersion": 15,
				"rows": []interface{}{
					// createRow({ height: 8 }, [[4], [2, 3], [4, 6], [2, 3], [2, 3], [8, 3]])
					map[string]interface{}{
						"height": 304, // 8 * 38
						"panels": []interface{}{
							map[string]interface{}{
								"span": 4,
								"id":   1,
							},
							map[string]interface{}{
								"span":   2,
								"height": 114, // 3 * 38
								"id":     2,
							},
							map[string]interface{}{
								"span":   4,
								"height": 228, // 6 * 38
								"id":     3,
							},
							map[string]interface{}{
								"span":   2,
								"height": 114, // 3 * 38
								"id":     4,
							},
							map[string]interface{}{
								"span":   2,
								"height": 114, // 3 * 38
								"id":     5,
							},
							map[string]interface{}{
								"span":   8,
								"height": 114, // 3 * 38
								"id":     6,
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
							"w": 8,
							"h": 8,
						},
					},
					map[string]interface{}{
						"id":     2,
						"height": 114, // 3 * 38
						"gridPos": map[string]interface{}{
							"x": 8,
							"y": 0,
							"w": 4,
							"h": 3,
						},
					},
					map[string]interface{}{
						"id":     3,
						"height": 228, // 6 * 38
						"gridPos": map[string]interface{}{
							"x": 12,
							"y": 0,
							"w": 8,
							"h": 6,
						},
					},
					map[string]interface{}{
						"id":     4,
						"height": 114, // 3 * 38
						"gridPos": map[string]interface{}{
							"x": 20,
							"y": 0,
							"w": 4,
							"h": 3,
						},
					},
					map[string]interface{}{
						"id":     5,
						"height": 114, // 3 * 38
						"gridPos": map[string]interface{}{
							"x": 20,
							"y": 3,
							"w": 4,
							"h": 3,
						},
					},
					map[string]interface{}{
						"id":     6,
						"height": 114, // 3 * 38
						"gridPos": map[string]interface{}{
							"x": 8,
							"y": 6,
							"w": 16,
							"h": 3,
						},
					},
				},
			},
		},
		{
			name: "should fill current row if panel height more than row height",
			input: map[string]interface{}{
				"schemaVersion": 15,
				"rows": []interface{}{
					// createRow({ height: 6 }, [[4], [2, 3], [4, 8], [2, 3], [2, 3]])
					map[string]interface{}{
						"height": 228, // 6 * 38
						"panels": []interface{}{
							map[string]interface{}{
								"span": 4,
								"id":   1,
							},
							map[string]interface{}{
								"span":   2,
								"height": 114, // 3 * 38
								"id":     2,
							},
							map[string]interface{}{
								"span":   4,
								"height": 304, // 8 * 38
								"id":     3,
							},
							map[string]interface{}{
								"span":   2,
								"height": 114, // 3 * 38
								"id":     4,
							},
							map[string]interface{}{
								"span":   2,
								"height": 114, // 3 * 38
								"id":     5,
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
							"w": 8,
							"h": 6,
						},
					},
					map[string]interface{}{
						"id":     2,
						"height": 114, // 3 * 38
						"gridPos": map[string]interface{}{
							"x": 8,
							"y": 0,
							"w": 4,
							"h": 3,
						},
					},
					map[string]interface{}{
						"id":     3,
						"height": 304, // 8 * 38
						"gridPos": map[string]interface{}{
							"x": 12,
							"y": 0,
							"w": 8,
							"h": 8,
						},
					},
					map[string]interface{}{
						"id":     4,
						"height": 114, // 3 * 38
						"gridPos": map[string]interface{}{
							"x": 20,
							"y": 0,
							"w": 4,
							"h": 3,
						},
					},
					map[string]interface{}{
						"id":     5,
						"height": 114, // 3 * 38
						"gridPos": map[string]interface{}{
							"x": 20,
							"y": 3,
							"w": 4,
							"h": 3,
						},
					},
				},
			},
		},
		{
			name: "should wrap panels to multiple rows",
			input: map[string]interface{}{
				"schemaVersion": 15,
				"rows": []interface{}{
					// createRow({ height: 6 }, [[6], [6], [12], [6], [3], [3]])
					map[string]interface{}{
						"height": 228, // 6 * 38
						"panels": []interface{}{
							map[string]interface{}{
								"span": 6,
								"id":   1,
							},
							map[string]interface{}{
								"span": 6,
								"id":   2,
							},
							map[string]interface{}{
								"span": 12,
								"id":   3,
							},
							map[string]interface{}{
								"span": 6,
								"id":   4,
							},
							map[string]interface{}{
								"span": 3,
								"id":   5,
							},
							map[string]interface{}{
								"span": 3,
								"id":   6,
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
						"id": 2,
						"gridPos": map[string]interface{}{
							"x": 12,
							"y": 0,
							"w": 12,
							"h": 6,
						},
					},
					map[string]interface{}{
						"id": 3,
						"gridPos": map[string]interface{}{
							"x": 0,
							"y": 6,
							"w": 24,
							"h": 6,
						},
					},
					map[string]interface{}{
						"id": 4,
						"gridPos": map[string]interface{}{
							"x": 0,
							"y": 12,
							"w": 12,
							"h": 6,
						},
					},
					map[string]interface{}{
						"id": 5,
						"gridPos": map[string]interface{}{
							"x": 12,
							"y": 12,
							"w": 6,
							"h": 6,
						},
					},
					map[string]interface{}{
						"id": 6,
						"gridPos": map[string]interface{}{
							"x": 18,
							"y": 12,
							"w": 6,
							"h": 6,
						},
					},
				},
			},
		},
		{
			name: "should add repeated row if repeat set",
			input: map[string]interface{}{
				"schemaVersion": 15,
				"rows": []interface{}{
					map[string]interface{}{
						"showTitle": true,
						"title":     "Row",
						"height":    304, // 8 * 38
						"repeat":    "server",
						"panels": []interface{}{
							map[string]interface{}{
								"span": 6,
								"id":   1,
							},
						},
					},
					map[string]interface{}{
						"height": 304, // 8 * 38
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
					// Panel from first row
					map[string]interface{}{
						"id": 1,
						"gridPos": map[string]interface{}{
							"x": 0,
							"y": 1,
							"w": 12,
							"h": 8,
						},
					},
					// Repeated row panel (comes after its panels)
					map[string]interface{}{
						"id":        3,
						"type":      "row",
						"title":     "Row",
						"collapsed": false,
						"repeat":    "server",
						"panels":    []interface{}{},
						"gridPos": map[string]interface{}{
							"x": 0,
							"y": 0,
							"w": 24,
							"h": 8,
						},
					},
					// Panel from second row
					map[string]interface{}{
						"id": 2,
						"gridPos": map[string]interface{}{
							"x": 0,
							"y": 10,
							"w": 24,
							"h": 8,
						},
					},
					// Second row panel (comes after its panels)
					map[string]interface{}{
						"id":        4,
						"type":      "row",
						"title":     "",
						"collapsed": false,
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
			name: "should ignore repeated row",
			input: map[string]interface{}{
				"schemaVersion": 15,
				"rows": []interface{}{
					map[string]interface{}{
						"showTitle": true,
						"title":     "Row1",
						"height":    304, // 8 * 38
						"repeat":    "server",
						"panels": []interface{}{
							map[string]interface{}{
								"span": 6,
								"id":   1,
							},
						},
					},
					map[string]interface{}{
						"showTitle":       true,
						"title":           "Row2",
						"height":          304, // 8 * 38
						"repeatIteration": 12313,
						"repeatRowId":     1,
						"panels": []interface{}{
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
							"y": 1,
							"w": 12,
							"h": 8,
						},
					},
					map[string]interface{}{
						"id":        3, // Next ID after max panel ID (2)
						"type":      "row",
						"title":     "Row1",
						"collapsed": false,
						"repeat":    "server",
						"panels":    []interface{}{},
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
			name: "should assign id",
			input: map[string]interface{}{
				"schemaVersion": 15,
				"rows": []interface{}{
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
								// no id - should be assigned
							},
						},
					},
				},
			},
			expected: map[string]interface{}{
				"schemaVersion": 16,
				"panels": []interface{}{
					map[string]interface{}{
						"id":        3, // Next ID after max panel ID (1) and assigned panel ID (2)
						"type":      "row",
						"title":     "",
						"collapsed": true,
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
								"id": 2, // Should be assigned the next available ID
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
				},
			},
		},
	}

	runMigrationTests(t, tests, schemaversion.V16)
}
