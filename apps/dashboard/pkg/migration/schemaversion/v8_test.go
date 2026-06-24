package schemaversion_test

import (
	"testing"

	"github.com/grafana/grafana/apps/dashboard/pkg/migration/schemaversion"
)

func TestV8(t *testing.T) {
	tests := []migrationTestCase{
		{
			name: "InfluxDB structured query should be converted to new select format",
			input: map[string]interface{}{
				"title":         "V8 InfluxDB Query Migration Test Dashboard",
				"schemaVersion": 7,
				"panels": []interface{}{
					map[string]interface{}{
						"id": 1,
						"targets": []interface{}{
							map[string]interface{}{
								"fields": []interface{}{
									map[string]interface{}{
										"name":     "value",
										"func":     "mean",
										"mathExpr": "*2",
										"asExpr":   "doubled",
									},
									map[string]interface{}{
										"name": "count",
										"func": "sum",
									},
								},
								"tags": []interface{}{
									map[string]interface{}{
										"key":   "host",
										"value": "server1",
									},
								},
								"groupBy": []interface{}{
									map[string]interface{}{
										"type":     "time",
										"interval": "1m",
									},
									map[string]interface{}{
										"type": "tag",
										"key":  "host",
									},
								},
								"fill": "null",
							},
						},
					},
				},
			},
			expected: map[string]interface{}{
				"title":         "V8 InfluxDB Query Migration Test Dashboard",
				"schemaVersion": 8,
				"panels": []interface{}{
					map[string]interface{}{
						"id": 1,
						"targets": []interface{}{
							map[string]interface{}{
								"select": []interface{}{
									[]interface{}{
										map[string]interface{}{
											"type":   "field",
											"params": []interface{}{"value"},
										},
										map[string]interface{}{
											"type":   "mean",
											"params": []interface{}{},
										},
										map[string]interface{}{
											"type":   "math",
											"params": []interface{}{"*2"},
										},
										map[string]interface{}{
											"type":   "alias",
											"params": []interface{}{"doubled"},
										},
									},
									[]interface{}{
										map[string]interface{}{
											"type":   "field",
											"params": []interface{}{"count"},
										},
										map[string]interface{}{
											"type":   "sum",
											"params": []interface{}{},
										},
									},
								},
								"tags": []interface{}{
									map[string]interface{}{
										"key":   "host",
										"value": "server1",
									},
								},
								"groupBy": []interface{}{
									map[string]interface{}{
										"type":   "time",
										"params": []interface{}{"1m"},
									},
									map[string]interface{}{
										"type":   "tag",
										"params": []interface{}{"host"},
									},
									map[string]interface{}{
										"type":   "fill",
										"params": []interface{}{"null"},
									},
								},
							},
						},
					},
				},
			},
		},
		{
			name: "InfluxDB raw query should only remove fields and fill",
			input: map[string]interface{}{
				"title":         "V8 InfluxDB Raw Query Migration Test Dashboard",
				"schemaVersion": 7,
				"panels": []interface{}{
					map[string]interface{}{
						"id": 1,
						"targets": []interface{}{
							map[string]interface{}{
								"rawQuery": true,
								"fields": []interface{}{
									map[string]interface{}{
										"name": "value",
										"func": "mean",
									},
								},
								"tags": []interface{}{
									map[string]interface{}{
										"key":   "host",
										"value": "server1",
									},
								},
								"groupBy": []interface{}{
									map[string]interface{}{
										"type":     "time",
										"interval": "1m",
									},
								},
								"fill": "null",
							},
						},
					},
				},
			},
			expected: map[string]interface{}{
				"title":         "V8 InfluxDB Raw Query Migration Test Dashboard",
				"schemaVersion": 8,
				"panels": []interface{}{
					map[string]interface{}{
						"id": 1,
						"targets": []interface{}{
							map[string]interface{}{
								"rawQuery": true,
								"tags": []interface{}{
									map[string]interface{}{
										"key":   "host",
										"value": "server1",
									},
								},
								"groupBy": []interface{}{
									map[string]interface{}{
										"type":     "time",
										"interval": "1m",
									},
								},
							},
						},
					},
				},
			},
		},
		{
			name: "targets without old InfluxDB schema should remain unchanged",
			input: map[string]interface{}{
				"title":         "V8 Non-InfluxDB Target Test Dashboard",
				"schemaVersion": 7,
				"panels": []interface{}{
					map[string]interface{}{
						"id": 1,
						"targets": []interface{}{
							map[string]interface{}{
								"expr":   "up",
								"refId":  "A",
								"format": "time_series",
							},
						},
					},
				},
			},
			expected: map[string]interface{}{
				"title":         "V8 Non-InfluxDB Target Test Dashboard",
				"schemaVersion": 8,
				"panels": []interface{}{
					map[string]interface{}{
						"id": 1,
						"targets": []interface{}{
							map[string]interface{}{
								"expr":   "up",
								"refId":  "A",
								"format": "time_series",
							},
						},
					},
				},
			},
		},
		{
			name: "panels without targets should remain unchanged",
			input: map[string]interface{}{
				"title":         "V8 No Targets Test Dashboard",
				"schemaVersion": 7,
				"panels": []interface{}{
					map[string]interface{}{
						"id":   1,
						"type": "text",
					},
				},
			},
			expected: map[string]interface{}{
				"title":         "V8 No Targets Test Dashboard",
				"schemaVersion": 8,
				"panels": []interface{}{
					map[string]interface{}{
						"id":   1,
						"type": "text",
					},
				},
			},
		},
		{
			name: "dashboard without panels should only update schema version",
			input: map[string]interface{}{
				"title":         "V8 No Panels Test Dashboard",
				"schemaVersion": 7,
			},
			expected: map[string]interface{}{
				"title":         "V8 No Panels Test Dashboard",
				"schemaVersion": 8,
			},
		},
	}
	runMigrationTests(t, tests, schemaversion.V8)
}
