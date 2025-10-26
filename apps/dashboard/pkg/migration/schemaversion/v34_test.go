package schemaversion_test

import (
	"testing"

	"github.com/grafana/grafana/apps/dashboard/pkg/migration/schemaversion"
)

func TestV34(t *testing.T) {
	tests := []migrationTestCase{
		{
			name: "splits CloudWatch query with multiple statistics into separate queries",
			input: map[string]interface{}{
				"panels": []interface{}{
					map[string]interface{}{
						"id":   1,
						"type": "timeseries",
						"targets": []interface{}{
							map[string]interface{}{
								"refId":      "A",
								"dimensions": map[string]interface{}{"InstanceId": "i-123"},
								"namespace":  "AWS/EC2",
								"region":     "us-east-1",
								"metricName": "CPUUtilization",
								"statistics": []interface{}{"Average", "Maximum", "Minimum"},
							},
						},
					},
				},
			},
			expected: map[string]interface{}{
				"schemaVersion": int(34),
				"panels": []interface{}{
					map[string]interface{}{
						"id":   1,
						"type": "timeseries",
						"targets": []interface{}{
							map[string]interface{}{
								"refId":            "A",
								"dimensions":       map[string]interface{}{"InstanceId": "i-123"},
								"namespace":        "AWS/EC2",
								"region":           "us-east-1",
								"metricName":       "CPUUtilization",
								"statistic":        "Average",
								"metricEditorMode": 0,
								"metricQueryType":  0,
							},
							map[string]interface{}{
								"refId":            "B",
								"dimensions":       map[string]interface{}{"InstanceId": "i-123"},
								"namespace":        "AWS/EC2",
								"region":           "us-east-1",
								"metricName":       "CPUUtilization",
								"statistic":        "Maximum",
								"metricEditorMode": 0,
								"metricQueryType":  0,
							},
							map[string]interface{}{
								"refId":            "C",
								"dimensions":       map[string]interface{}{"InstanceId": "i-123"},
								"namespace":        "AWS/EC2",
								"region":           "us-east-1",
								"metricName":       "CPUUtilization",
								"statistic":        "Minimum",
								"metricEditorMode": 0,
								"metricQueryType":  0,
							},
						},
					},
				},
			},
		},
		{
			name: "converts single statistic array to statistic field",
			input: map[string]interface{}{
				"panels": []interface{}{
					map[string]interface{}{
						"id": 1,
						"targets": []interface{}{
							map[string]interface{}{
								"refId":      "A",
								"dimensions": map[string]interface{}{"InstanceId": "i-123"},
								"namespace":  "AWS/EC2",
								"region":     "us-east-1",
								"metricName": "CPUUtilization",
								"statistics": []interface{}{"Average"},
							},
						},
					},
				},
			},
			expected: map[string]interface{}{
				"schemaVersion": int(34),
				"panels": []interface{}{
					map[string]interface{}{
						"id": 1,
						"targets": []interface{}{
							map[string]interface{}{
								"refId":            "A",
								"dimensions":       map[string]interface{}{"InstanceId": "i-123"},
								"namespace":        "AWS/EC2",
								"region":           "us-east-1",
								"metricName":       "CPUUtilization",
								"statistic":        "Average",
								"metricEditorMode": 0,
								"metricQueryType":  0,
							},
						},
					},
				},
			},
		},
		{
			name: "does not migrate non-CloudWatch queries",
			input: map[string]interface{}{
				"panels": []interface{}{
					map[string]interface{}{
						"id": 1,
						"targets": []interface{}{
							map[string]interface{}{
								"refId":      "A",
								"expr":       "up",
								"datasource": "prometheus",
								"statistics": []interface{}{"Average", "Maximum"},
							},
						},
					},
				},
			},
			expected: map[string]interface{}{
				"schemaVersion": int(34),
				"panels": []interface{}{
					map[string]interface{}{
						"id": 1,
						"targets": []interface{}{
							map[string]interface{}{
								"refId":      "A",
								"expr":       "up",
								"datasource": "prometheus",
								"statistics": []interface{}{"Average", "Maximum"},
							},
						},
					},
				},
			},
		},
		{
			name: "migrates CloudWatch annotation queries with multiple statistics",
			input: map[string]interface{}{
				"annotations": map[string]interface{}{
					"list": []interface{}{
						map[string]interface{}{
							"name":           "CloudWatch Annotation",
							"dimensions":     map[string]interface{}{"InstanceId": "i-123"},
							"namespace":      "AWS/EC2",
							"region":         "us-east-1",
							"prefixMatching": false,
							"statistics":     []interface{}{"Minimum", "Sum"},
						},
					},
				},
			},
			expected: map[string]interface{}{
				"schemaVersion": int(34),
				"annotations": map[string]interface{}{
					"list": []interface{}{
						map[string]interface{}{
							"name":           "CloudWatch Annotation - Minimum",
							"dimensions":     map[string]interface{}{"InstanceId": "i-123"},
							"namespace":      "AWS/EC2",
							"region":         "us-east-1",
							"prefixMatching": false,
							"statistic":      "Minimum",
						},
						map[string]interface{}{
							"name":           "CloudWatch Annotation - Sum",
							"dimensions":     map[string]interface{}{"InstanceId": "i-123"},
							"namespace":      "AWS/EC2",
							"region":         "us-east-1",
							"prefixMatching": false,
							"statistic":      "Sum",
						},
					},
				},
			},
		},
		{
			name: "handles annotation with empty statistics array",
			input: map[string]interface{}{
				"annotations": map[string]interface{}{
					"list": []interface{}{
						map[string]interface{}{
							"name":           "CloudWatch Annotation",
							"dimensions":     map[string]interface{}{"InstanceId": "i-123"},
							"namespace":      "AWS/EC2",
							"region":         "us-east-1",
							"prefixMatching": false,
							"statistics":     []interface{}{},
						},
					},
				},
			},
			expected: map[string]interface{}{
				"schemaVersion": int(34),
				"annotations": map[string]interface{}{
					"list": []interface{}{
						map[string]interface{}{
							"name":           "CloudWatch Annotation",
							"dimensions":     map[string]interface{}{"InstanceId": "i-123"},
							"namespace":      "AWS/EC2",
							"region":         "us-east-1",
							"prefixMatching": false,
						},
					},
				},
			},
		},
		{
			name: "handles annotation with single statistic",
			input: map[string]interface{}{
				"annotations": map[string]interface{}{
					"list": []interface{}{
						map[string]interface{}{
							"name":           "CloudWatch Annotation",
							"dimensions":     map[string]interface{}{"InstanceId": "i-123"},
							"namespace":      "AWS/EC2",
							"region":         "us-east-1",
							"prefixMatching": false,
							"statistics":     []interface{}{"Average"},
						},
					},
				},
			},
			expected: map[string]interface{}{
				"schemaVersion": int(34),
				"annotations": map[string]interface{}{
					"list": []interface{}{
						map[string]interface{}{
							"name":           "CloudWatch Annotation",
							"dimensions":     map[string]interface{}{"InstanceId": "i-123"},
							"namespace":      "AWS/EC2",
							"region":         "us-east-1",
							"prefixMatching": false,
							"statistic":      "Average",
						},
					},
				},
			},
		},
		{
			name: "handles annotation with null statistic",
			input: map[string]interface{}{
				"annotations": map[string]interface{}{
					"list": []interface{}{
						map[string]interface{}{
							"name":           "CloudWatch Annotation",
							"dimensions":     map[string]interface{}{"InstanceId": "i-123"},
							"namespace":      "AWS/EC2",
							"region":         "us-east-1",
							"prefixMatching": false,
							"statistics":     []interface{}{nil},
						},
					},
				},
			},
			expected: map[string]interface{}{
				"schemaVersion": int(34),
				"annotations": map[string]interface{}{
					"list": []interface{}{
						map[string]interface{}{
							"name":           "CloudWatch Annotation",
							"dimensions":     map[string]interface{}{"InstanceId": "i-123"},
							"namespace":      "AWS/EC2",
							"region":         "us-east-1",
							"prefixMatching": false,
							// No statistic property for null
						},
					},
				},
			},
		},
		{
			name: "handles annotation with all suffix types (for getSuffixForStat coverage)",
			input: map[string]interface{}{
				"annotations": map[string]interface{}{
					"list": []interface{}{
						map[string]interface{}{
							"name":           "CloudWatch Annotation",
							"dimensions":     map[string]interface{}{"InstanceId": "i-123"},
							"namespace":      "AWS/EC2",
							"region":         "us-east-1",
							"prefixMatching": false,
							"statistics":     []interface{}{123, true, false, map[string]interface{}{}, []interface{}{}, "", "Average"},
						},
					},
				},
			},
			expected: map[string]interface{}{
				"schemaVersion": int(34),
				"annotations": map[string]interface{}{
					"list": []interface{}{
						map[string]interface{}{
							"name":           "CloudWatch Annotation - 123",
							"dimensions":     map[string]interface{}{"InstanceId": "i-123"},
							"namespace":      "AWS/EC2",
							"region":         "us-east-1",
							"prefixMatching": false,
							"statistic":      123,
						},
						map[string]interface{}{
							"name":           "CloudWatch Annotation - true",
							"dimensions":     map[string]interface{}{"InstanceId": "i-123"},
							"namespace":      "AWS/EC2",
							"region":         "us-east-1",
							"prefixMatching": false,
							"statistic":      true,
						},
						map[string]interface{}{
							"name":           "CloudWatch Annotation - false",
							"dimensions":     map[string]interface{}{"InstanceId": "i-123"},
							"namespace":      "AWS/EC2",
							"region":         "us-east-1",
							"prefixMatching": false,
							"statistic":      false,
						},
						map[string]interface{}{
							"name":           "CloudWatch Annotation - [object Object]",
							"dimensions":     map[string]interface{}{"InstanceId": "i-123"},
							"namespace":      "AWS/EC2",
							"region":         "us-east-1",
							"prefixMatching": false,
							"statistic":      map[string]interface{}{},
						},
						map[string]interface{}{
							"name":           "CloudWatch Annotation - ",
							"dimensions":     map[string]interface{}{"InstanceId": "i-123"},
							"namespace":      "AWS/EC2",
							"region":         "us-east-1",
							"prefixMatching": false,
							"statistic":      []interface{}{},
						},
						map[string]interface{}{
							"name":           "CloudWatch Annotation - ",
							"dimensions":     map[string]interface{}{"InstanceId": "i-123"},
							"namespace":      "AWS/EC2",
							"region":         "us-east-1",
							"prefixMatching": false,
							"statistic":      "",
						},
						map[string]interface{}{
							"name":           "CloudWatch Annotation - Average",
							"dimensions":     map[string]interface{}{"InstanceId": "i-123"},
							"namespace":      "AWS/EC2",
							"region":         "us-east-1",
							"prefixMatching": false,
							"statistic":      "Average",
						},
					},
				},
			},
		},
		{
			name: "handles mixed query types in same panel",
			input: map[string]interface{}{
				"panels": []interface{}{
					map[string]interface{}{
						"id": 1,
						"targets": []interface{}{
							map[string]interface{}{
								"refId":      "A",
								"dimensions": map[string]interface{}{"InstanceId": "i-123"},
								"namespace":  "AWS/EC2",
								"region":     "us-east-1",
								"metricName": "CPUUtilization",
								"statistics": []interface{}{"Average", "Maximum"},
							},
							map[string]interface{}{
								"refId":      "B",
								"expr":       "up",
								"datasource": "prometheus",
							},
						},
					},
				},
			},
			expected: map[string]interface{}{
				"schemaVersion": int(34),
				"panels": []interface{}{
					map[string]interface{}{
						"id": 1,
						"targets": []interface{}{
							map[string]interface{}{
								"refId":            "A",
								"dimensions":       map[string]interface{}{"InstanceId": "i-123"},
								"namespace":        "AWS/EC2",
								"region":           "us-east-1",
								"metricName":       "CPUUtilization",
								"statistic":        "Average",
								"metricEditorMode": 0,
								"metricQueryType":  0,
							},
							map[string]interface{}{
								"refId":      "B",
								"expr":       "up",
								"datasource": "prometheus",
							},
							map[string]interface{}{
								"refId":            "C",
								"dimensions":       map[string]interface{}{"InstanceId": "i-123"},
								"namespace":        "AWS/EC2",
								"region":           "us-east-1",
								"metricName":       "CPUUtilization",
								"statistic":        "Maximum",
								"metricEditorMode": 0,
								"metricQueryType":  0,
							},
						},
					},
				},
			},
		},
		{
			name: "handles CloudWatch query without statistics field",
			input: map[string]interface{}{
				"panels": []interface{}{
					map[string]interface{}{
						"id": 1,
						"targets": []interface{}{
							map[string]interface{}{
								"refId":      "A",
								"dimensions": map[string]interface{}{"InstanceId": "i-123"},
								"namespace":  "AWS/EC2",
								"region":     "us-east-1",
								"metricName": "CPUUtilization",
							},
						},
					},
				},
			},
			expected: map[string]interface{}{
				"schemaVersion": int(34),
				"panels": []interface{}{
					map[string]interface{}{
						"id": 1,
						"targets": []interface{}{
							map[string]interface{}{
								"refId":            "A",
								"dimensions":       map[string]interface{}{"InstanceId": "i-123"},
								"namespace":        "AWS/EC2",
								"region":           "us-east-1",
								"metricName":       "CPUUtilization",
								"metricEditorMode": 0,
								"metricQueryType":  0,
							},
						},
					},
				},
			},
		},
		{
			name: "handles missing targets gracefully",
			input: map[string]interface{}{
				"panels": []interface{}{
					map[string]interface{}{
						"id":   1,
						"type": "timeseries",
					},
				},
			},
			expected: map[string]interface{}{
				"schemaVersion": int(34),
				"panels": []interface{}{
					map[string]interface{}{
						"id":   1,
						"type": "timeseries",
					},
				},
			},
		},
		{
			name: "handles missing annotations gracefully",
			input: map[string]interface{}{
				"panels": []interface{}{},
			},
			expected: map[string]interface{}{
				"schemaVersion": int(34),
				"panels":        []interface{}{},
			},
		},
		{
			name: "handles empty statistics array",
			input: map[string]interface{}{
				"panels": []interface{}{
					map[string]interface{}{
						"id": 1,
						"targets": []interface{}{
							map[string]interface{}{
								"refId":      "A",
								"dimensions": map[string]interface{}{"InstanceId": "i-123"},
								"namespace":  "AWS/EC2",
								"region":     "us-east-1",
								"metricName": "CPUUtilization",
								"statistics": []interface{}{},
							},
						},
					},
				},
			},
			expected: map[string]interface{}{
				"schemaVersion": int(34),
				"panels": []interface{}{
					map[string]interface{}{
						"id": 1,
						"targets": []interface{}{
							map[string]interface{}{
								"refId":            "A",
								"dimensions":       map[string]interface{}{"InstanceId": "i-123"},
								"namespace":        "AWS/EC2",
								"region":           "us-east-1",
								"metricName":       "CPUUtilization",
								"metricEditorMode": 0,
								"metricQueryType":  0,
							},
						},
					},
				},
			},
		},
		{
			name: "preserves other query properties during migration",
			input: map[string]interface{}{
				"panels": []interface{}{
					map[string]interface{}{
						"id": 1,
						"targets": []interface{}{
							map[string]interface{}{
								"refId":      "A",
								"dimensions": map[string]interface{}{"InstanceId": "i-123"},
								"namespace":  "AWS/EC2",
								"region":     "us-east-1",
								"metricName": "CPUUtilization",
								"statistics": []interface{}{"Average", "Maximum"},
								"period":     "300",
								"alias":      "CPU Usage",
							},
						},
					},
				},
			},
			expected: map[string]interface{}{
				"schemaVersion": int(34),
				"panels": []interface{}{
					map[string]interface{}{
						"id": 1,
						"targets": []interface{}{
							map[string]interface{}{
								"refId":            "A",
								"dimensions":       map[string]interface{}{"InstanceId": "i-123"},
								"namespace":        "AWS/EC2",
								"region":           "us-east-1",
								"metricName":       "CPUUtilization",
								"statistic":        "Average",
								"period":           "300",
								"alias":            "CPU Usage",
								"metricEditorMode": 0,
								"metricQueryType":  0,
							},
							map[string]interface{}{
								"refId":            "B",
								"dimensions":       map[string]interface{}{"InstanceId": "i-123"},
								"namespace":        "AWS/EC2",
								"region":           "us-east-1",
								"metricName":       "CPUUtilization",
								"statistic":        "Maximum",
								"period":           "300",
								"alias":            "CPU Usage",
								"metricEditorMode": 0,
								"metricQueryType":  0,
							},
						},
					},
				},
			},
		},
		{
			name: "migrates CloudWatch queries in nested panels (collapsed rows)",
			input: map[string]interface{}{
				"panels": []interface{}{
					map[string]interface{}{
						"collapsed": true,
						"gridPos": map[string]interface{}{
							"h": 1,
							"w": 24,
							"x": 0,
							"y": 89,
						},
						"id":    96,
						"title": "DynamoDB",
						"type":  "row",
						"panels": []interface{}{
							map[string]interface{}{
								"gridPos": map[string]interface{}{
									"h": 8,
									"w": 12,
									"x": 0,
									"y": 0,
								},
								"id": 4,
								"targets": []interface{}{
									map[string]interface{}{
										"refId":      "C",
										"dimensions": map[string]interface{}{"InstanceId": "i-123"},
										"namespace":  "AWS/EC2",
										"region":     "default",
										"metricName": "CPUUtilization",
										"statistics": []interface{}{"Average", "Minimum", "p12.21"},
									},
									map[string]interface{}{
										"refId":      "B",
										"dimensions": map[string]interface{}{"InstanceId": "i-123"},
										"namespace":  "AWS/EC2",
										"region":     "us-east-2",
										"metricName": "CPUUtilization",
										"statistics": []interface{}{"Sum"},
									},
								},
							},
							map[string]interface{}{
								"id": 5,
								"targets": []interface{}{
									map[string]interface{}{
										"refId":      "A",
										"dimensions": map[string]interface{}{"InstanceId": "i-456"},
										"namespace":  "AWS/EC2",
										"region":     "us-west-1",
										"metricName": "NetworkIn",
										"statistics": []interface{}{"Sum", "Min"},
									},
								},
							},
						},
					},
				},
			},
			expected: map[string]interface{}{
				"schemaVersion": int(34),
				"panels": []interface{}{
					map[string]interface{}{
						"collapsed": true,
						"gridPos": map[string]interface{}{
							"h": 1,
							"w": 24,
							"x": 0,
							"y": 89,
						},
						"id":    96,
						"title": "DynamoDB",
						"type":  "row",
						"panels": []interface{}{
							map[string]interface{}{
								"gridPos": map[string]interface{}{
									"h": 8,
									"w": 12,
									"x": 0,
									"y": 0,
								},
								"id": 4,
								"targets": []interface{}{
									map[string]interface{}{
										"refId":            "C",
										"dimensions":       map[string]interface{}{"InstanceId": "i-123"},
										"namespace":        "AWS/EC2",
										"region":           "default",
										"metricName":       "CPUUtilization",
										"statistic":        "Average",
										"metricEditorMode": 0,
										"metricQueryType":  0,
									},
									map[string]interface{}{
										"refId":            "B",
										"dimensions":       map[string]interface{}{"InstanceId": "i-123"},
										"namespace":        "AWS/EC2",
										"region":           "us-east-2",
										"metricName":       "CPUUtilization",
										"statistic":        "Sum",
										"metricEditorMode": 0,
										"metricQueryType":  0,
									},
									map[string]interface{}{
										"refId":            "A",
										"dimensions":       map[string]interface{}{"InstanceId": "i-123"},
										"namespace":        "AWS/EC2",
										"region":           "default",
										"metricName":       "CPUUtilization",
										"statistic":        "Minimum",
										"metricEditorMode": 0,
										"metricQueryType":  0,
									},
									map[string]interface{}{
										"refId":            "D",
										"dimensions":       map[string]interface{}{"InstanceId": "i-123"},
										"namespace":        "AWS/EC2",
										"region":           "default",
										"metricName":       "CPUUtilization",
										"statistic":        "p12.21",
										"metricEditorMode": 0,
										"metricQueryType":  0,
									},
								},
							},
							map[string]interface{}{
								"id": 5,
								"targets": []interface{}{
									map[string]interface{}{
										"refId":            "A",
										"dimensions":       map[string]interface{}{"InstanceId": "i-456"},
										"namespace":        "AWS/EC2",
										"region":           "us-west-1",
										"metricName":       "NetworkIn",
										"statistic":        "Sum",
										"metricEditorMode": 0,
										"metricQueryType":  0,
									},
									map[string]interface{}{
										"refId":            "B",
										"dimensions":       map[string]interface{}{"InstanceId": "i-456"},
										"namespace":        "AWS/EC2",
										"region":           "us-west-1",
										"metricName":       "NetworkIn",
										"statistic":        "Min",
										"metricEditorMode": 0,
										"metricQueryType":  0,
									},
								},
							},
						},
					},
				},
			},
		},
		{
			name: "preserves existing metricQueryType (hasOwnProperty test)",
			input: map[string]interface{}{
				"panels": []interface{}{
					map[string]interface{}{
						"id": 1,
						"targets": []interface{}{
							map[string]interface{}{
								"refId":           "A",
								"dimensions":      map[string]interface{}{"InstanceId": "i-123"},
								"namespace":       "AWS/EC2",
								"region":          "us-east-1",
								"metricName":      "CPUUtilization",
								"metricQueryType": 1, // Already exists - should be preserved
								"statistics":      []interface{}{"Average"},
							},
						},
					},
				},
			},
			expected: map[string]interface{}{
				"schemaVersion": int(34),
				"panels": []interface{}{
					map[string]interface{}{
						"id": 1,
						"targets": []interface{}{
							map[string]interface{}{
								"refId":            "A",
								"dimensions":       map[string]interface{}{"InstanceId": "i-123"},
								"namespace":        "AWS/EC2",
								"region":           "us-east-1",
								"metricName":       "CPUUtilization",
								"metricQueryType":  1, // Preserved
								"metricEditorMode": 1, // Set to Code due to Insights
								"statistic":        "Average",
							},
						},
					},
				},
			},
		},
		{
			name: "preserves existing metricEditorMode (hasOwnProperty test)",
			input: map[string]interface{}{
				"panels": []interface{}{
					map[string]interface{}{
						"id": 1,
						"targets": []interface{}{
							map[string]interface{}{
								"refId":            "A",
								"dimensions":       map[string]interface{}{"InstanceId": "i-123"},
								"namespace":        "AWS/EC2",
								"region":           "us-east-1",
								"metricName":       "CPUUtilization",
								"metricEditorMode": 1, // Already exists - should be preserved
								"statistics":       []interface{}{"Average"},
							},
						},
					},
				},
			},
			expected: map[string]interface{}{
				"schemaVersion": int(34),
				"panels": []interface{}{
					map[string]interface{}{
						"id": 1,
						"targets": []interface{}{
							map[string]interface{}{
								"refId":            "A",
								"dimensions":       map[string]interface{}{"InstanceId": "i-123"},
								"namespace":        "AWS/EC2",
								"region":           "us-east-1",
								"metricName":       "CPUUtilization",
								"metricEditorMode": 1, // Preserved
								"metricQueryType":  0, // Set to default
								"statistic":        "Average",
							},
						},
					},
				},
			},
		},
		{
			name: "preserves existing metricEditorMode and metricQueryType values",
			input: map[string]interface{}{
				"panels": []interface{}{
					map[string]interface{}{
						"id": 1,
						"targets": []interface{}{
							map[string]interface{}{
								"refId":            "A",
								"dimensions":       map[string]interface{}{"InstanceId": "i-123"},
								"namespace":        "AWS/EC2",
								"region":           "us-east-1",
								"metricName":       "CPUUtilization",
								"statistics":       []interface{}{"Average", "Maximum"},
								"metricEditorMode": 1,
								"metricQueryType":  1,
								"period":           "300",
								"alias":            "CPU Usage",
							},
						},
					},
				},
			},
			expected: map[string]interface{}{
				"schemaVersion": int(34),
				"panels": []interface{}{
					map[string]interface{}{
						"id": 1,
						"targets": []interface{}{
							map[string]interface{}{
								"refId":            "A",
								"dimensions":       map[string]interface{}{"InstanceId": "i-123"},
								"namespace":        "AWS/EC2",
								"region":           "us-east-1",
								"metricName":       "CPUUtilization",
								"statistic":        "Average",
								"period":           "300",
								"alias":            "CPU Usage",
								"metricEditorMode": 1,
								"metricQueryType":  1,
							},
							map[string]interface{}{
								"refId":            "B",
								"dimensions":       map[string]interface{}{"InstanceId": "i-123"},
								"namespace":        "AWS/EC2",
								"region":           "us-east-1",
								"metricName":       "CPUUtilization",
								"statistic":        "Maximum",
								"period":           "300",
								"alias":            "CPU Usage",
								"metricEditorMode": 1,
								"metricQueryType":  1,
							},
						},
					},
				},
			},
		},
		{
			name: "handles refId generation with existing refIds",
			input: map[string]interface{}{
				"panels": []interface{}{
					map[string]interface{}{
						"id": 1,
						"targets": []interface{}{
							map[string]interface{}{"refId": "A", "expr": "prometheus"},
							map[string]interface{}{"refId": "C", "expr": "prometheus"}, // Skip B to test gap filling
							map[string]interface{}{
								"refId":      "D",
								"dimensions": map[string]interface{}{"InstanceId": "i-123"},
								"namespace":  "AWS/EC2",
								"region":     "us-east-1",
								"metricName": "CPUUtilization",
								"statistics": []interface{}{"Average", "Maximum"},
							},
						},
					},
				},
			},
			expected: map[string]interface{}{
				"schemaVersion": int(34),
				"panels": []interface{}{
					map[string]interface{}{
						"id": 1,
						"targets": []interface{}{
							map[string]interface{}{"refId": "A", "expr": "prometheus"},
							map[string]interface{}{"refId": "C", "expr": "prometheus"},
							map[string]interface{}{
								"refId":            "D",
								"dimensions":       map[string]interface{}{"InstanceId": "i-123"},
								"namespace":        "AWS/EC2",
								"region":           "us-east-1",
								"metricName":       "CPUUtilization",
								"statistic":        "Average",
								"metricEditorMode": 0,
								"metricQueryType":  0,
							},
							map[string]interface{}{
								"refId":            "B", // Should use the available B
								"dimensions":       map[string]interface{}{"InstanceId": "i-123"},
								"namespace":        "AWS/EC2",
								"region":           "us-east-1",
								"metricName":       "CPUUtilization",
								"statistic":        "Maximum",
								"metricEditorMode": 0,
								"metricQueryType":  0,
							},
						},
					},
				},
			},
		},
		{
			name: "handles non-CloudWatch annotation (skips migration)",
			input: map[string]interface{}{
				"annotations": map[string]interface{}{
					"list": []interface{}{
						map[string]interface{}{
							"name":       "Regular Annotation",
							"datasource": "prometheus",
						},
					},
				},
			},
			expected: map[string]interface{}{
				"schemaVersion": int(34),
				"annotations": map[string]interface{}{
					"list": []interface{}{
						map[string]interface{}{
							"name":       "Regular Annotation",
							"datasource": "prometheus",
						},
					},
				},
			},
		},
		{
			name: "handles missing annotations list",
			input: map[string]interface{}{
				"annotations": map[string]interface{}{},
			},
			expected: map[string]interface{}{
				"schemaVersion": int(34),
				"annotations":   map[string]interface{}{},
			},
		},
		{
			name: "handles missing annotations entirely",
			input: map[string]interface{}{
				"panels": []interface{}{},
			},
			expected: map[string]interface{}{
				"schemaVersion": int(34),
				"panels":        []interface{}{},
			},
		},
		{
			name: "tests generateNextRefId double letter generation",
			input: map[string]interface{}{
				"panels": []interface{}{
					map[string]interface{}{
						"id": 1,
						"targets": func() []interface{} {
							targets := []interface{}{}
							// Create A-Z refIds
							for c := 'A'; c <= 'Z'; c++ {
								targets = append(targets, map[string]interface{}{
									"refId": string(c),
									"expr":  "prometheus",
								})
							}
							// Add CloudWatch query that will need double letter refId
							targets = append(targets, map[string]interface{}{
								"refId":      "AA",
								"dimensions": map[string]interface{}{"InstanceId": "i-123"},
								"namespace":  "AWS/EC2",
								"region":     "us-east-1",
								"metricName": "CPUUtilization",
								"statistics": []interface{}{"Average", "Maximum"},
							})
							return targets
						}(),
					},
				},
			},
			expected: map[string]interface{}{
				"schemaVersion": int(34),
				"panels": []interface{}{
					map[string]interface{}{
						"id": 1,
						"targets": func() []interface{} {
							targets := []interface{}{}
							// Create A-Z refIds
							for c := 'A'; c <= 'Z'; c++ {
								targets = append(targets, map[string]interface{}{
									"refId": string(c),
									"expr":  "prometheus",
								})
							}
							// Add the migrated CloudWatch queries
							targets = append(targets, map[string]interface{}{
								"refId":            "AA",
								"dimensions":       map[string]interface{}{"InstanceId": "i-123"},
								"namespace":        "AWS/EC2",
								"region":           "us-east-1",
								"metricName":       "CPUUtilization",
								"statistic":        "Average",
								"metricEditorMode": 0,
								"metricQueryType":  0,
							})
							targets = append(targets, map[string]interface{}{
								"refId":            "AB", // Next available double letter
								"dimensions":       map[string]interface{}{"InstanceId": "i-123"},
								"namespace":        "AWS/EC2",
								"region":           "us-east-1",
								"metricName":       "CPUUtilization",
								"statistic":        "Maximum",
								"metricEditorMode": 0,
								"metricQueryType":  0,
							})
							return targets
						}(),
					},
				},
			},
		},
	}
	runMigrationTests(t, tests, schemaversion.V34)
}
