package schemaversion_test

import (
	"testing"

	"github.com/grafana/grafana/pkg/apis/dashboard/migration/schemaversion"
)

func TestV38(t *testing.T) {
	tests := []migrationTestCase{
		{
			name: "no table panels",
			input: map[string]interface{}{
				"schemaVersion": 37,
				"title":         "Test Dashboard",
				"panels": []interface{}{
					map[string]interface{}{
						"type":  "graph",
						"title": "Panel 1",
					},
				},
			},
			expected: map[string]interface{}{
				"title":         "Test Dashboard",
				"schemaVersion": 38,
				"panels": []interface{}{
					map[string]interface{}{
						"type":  "graph",
						"title": "Panel 1",
					},
				},
			},
		},
		{
			name: "table panel with basic gauge displayMode",
			input: map[string]interface{}{
				"schemaVersion": 37,
				"panels": []interface{}{
					map[string]interface{}{
						"type": "table",
						"fieldConfig": map[string]interface{}{
							"defaults": map[string]interface{}{
								"custom": map[string]interface{}{
									"displayMode": "basic",
								},
							},
						},
					},
				},
			},
			expected: map[string]interface{}{
				"schemaVersion": 38,
				"panels": []interface{}{
					map[string]interface{}{
						"type": "table",
						"fieldConfig": map[string]interface{}{
							"defaults": map[string]interface{}{
								"custom": map[string]interface{}{
									"cellOptions": map[string]interface{}{
										"type": "gauge",
										"mode": "basic",
									},
								},
							},
						},
					},
				},
			},
		},
		{
			name: "table panel with gradient-gauge displayMode",
			input: map[string]interface{}{
				"schemaVersion": 37,
				"panels": []interface{}{
					map[string]interface{}{
						"type": "table",
						"fieldConfig": map[string]interface{}{
							"defaults": map[string]interface{}{
								"custom": map[string]interface{}{
									"displayMode": "gradient-gauge",
								},
							},
						},
					},
				},
			},
			expected: map[string]interface{}{
				"schemaVersion": 38,
				"panels": []interface{}{
					map[string]interface{}{
						"type": "table",
						"fieldConfig": map[string]interface{}{
							"defaults": map[string]interface{}{
								"custom": map[string]interface{}{
									"cellOptions": map[string]interface{}{
										"type": "gauge",
										"mode": "gradient",
									},
								},
							},
						},
					},
				},
			},
		},
		{
			name: "table panel with lcd-gauge displayMode",
			input: map[string]interface{}{
				"schemaVersion": 37,
				"panels": []interface{}{
					map[string]interface{}{
						"type": "table",
						"fieldConfig": map[string]interface{}{
							"defaults": map[string]interface{}{
								"custom": map[string]interface{}{
									"displayMode": "lcd-gauge",
								},
							},
						},
					},
				},
			},
			expected: map[string]interface{}{
				"schemaVersion": 38,
				"panels": []interface{}{
					map[string]interface{}{
						"type": "table",
						"fieldConfig": map[string]interface{}{
							"defaults": map[string]interface{}{
								"custom": map[string]interface{}{
									"cellOptions": map[string]interface{}{
										"type": "gauge",
										"mode": "lcd",
									},
								},
							},
						},
					},
				},
			},
		},
		{
			name: "table panel with color-background displayMode",
			input: map[string]interface{}{
				"schemaVersion": 37,
				"panels": []interface{}{
					map[string]interface{}{
						"type": "table",
						"fieldConfig": map[string]interface{}{
							"defaults": map[string]interface{}{
								"custom": map[string]interface{}{
									"displayMode": "color-background",
								},
							},
						},
					},
				},
			},
			expected: map[string]interface{}{
				"schemaVersion": 38,
				"panels": []interface{}{
					map[string]interface{}{
						"type": "table",
						"fieldConfig": map[string]interface{}{
							"defaults": map[string]interface{}{
								"custom": map[string]interface{}{
									"cellOptions": map[string]interface{}{
										"type": "color-background",
										"mode": "gradient",
									},
								},
							},
						},
					},
				},
			},
		},
		{
			name: "table panel with color-background-solid displayMode",
			input: map[string]interface{}{
				"schemaVersion": 37,
				"panels": []interface{}{
					map[string]interface{}{
						"type": "table",
						"fieldConfig": map[string]interface{}{
							"defaults": map[string]interface{}{
								"custom": map[string]interface{}{
									"displayMode": "color-background-solid",
								},
							},
						},
					},
				},
			},
			expected: map[string]interface{}{
				"schemaVersion": 38,
				"panels": []interface{}{
					map[string]interface{}{
						"type": "table",
						"fieldConfig": map[string]interface{}{
							"defaults": map[string]interface{}{
								"custom": map[string]interface{}{
									"cellOptions": map[string]interface{}{
										"type": "color-background",
										"mode": "basic",
									},
								},
							},
						},
					},
				},
			},
		},
		{
			name: "table panel with default displayMode",
			input: map[string]interface{}{
				"schemaVersion": 37,
				"panels": []interface{}{
					map[string]interface{}{
						"type": "table",
						"fieldConfig": map[string]interface{}{
							"defaults": map[string]interface{}{
								"custom": map[string]interface{}{
									"displayMode": "some-other-mode",
								},
							},
						},
					},
				},
			},
			expected: map[string]interface{}{
				"schemaVersion": 38,
				"panels": []interface{}{
					map[string]interface{}{
						"type": "table",
						"fieldConfig": map[string]interface{}{
							"defaults": map[string]interface{}{
								"custom": map[string]interface{}{
									"cellOptions": map[string]interface{}{
										"type": "some-other-mode",
									},
								},
							},
						},
					},
				},
			},
		},
	}
	runMigrationTests(t, tests, schemaversion.V38)
}
