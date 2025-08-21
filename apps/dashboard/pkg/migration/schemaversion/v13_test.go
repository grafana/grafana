package schemaversion

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestV13(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{
			name: "migrate graph panel with threshold1 and threshold2",
			input: `{
				"schemaVersion": 12,
				"panels": [
					{
						"type": "graph",
						"grid": {
							"threshold1": 80,
							"threshold1Color": "#d44a3a",
							"threshold2": 90,
							"threshold2Color": "#d44a3a",
							"thresholdLine": true
						}
					}
				]
			}`,
			expected: `{
				"schemaVersion": 12,
				"panels": [
					{
						"type": "graph",
						"grid": {},
						"thresholds": [
							{
								"value": 80,
								"line": true,
								"lineColor": "#d44a3a",
								"colorMode": "custom",
								"op": "gt"
							},
							{
								"value": 90,
								"line": true,
								"lineColor": "#d44a3a",
								"colorMode": "custom",
								"op": "gt"
							}
						]
					}
				]
			}`,
		},
		{
			name: "migrate graph panel with threshold1 only",
			input: `{
				"schemaVersion": 12,
				"panels": [
					{
						"type": "graph",
						"grid": {
							"threshold1": 80,
							"threshold1Color": "#d44a3a",
							"thresholdLine": false
						}
					}
				]
			}`,
			expected: `{
				"schemaVersion": 12,
				"panels": [
					{
						"type": "graph",
						"grid": {},
						"thresholds": [
							{
								"value": 80,
								"fill": true,
								"fillColor": "#d44a3a",
								"colorMode": "custom",
								"op": "gt"
							}
						]
					}
				]
			}`,
		},
		{
			name: "migrate graph panel with threshold2 only",
			input: `{
				"schemaVersion": 12,
				"panels": [
					{
						"type": "graph",
						"grid": {
							"threshold2": 90,
							"threshold2Color": "#d44a3a",
							"thresholdLine": true
						}
					}
				]
			}`,
			expected: `{
				"schemaVersion": 12,
				"panels": [
					{
						"type": "graph",
						"grid": {},
						"thresholds": [
							{
								"value": 90,
								"line": true,
								"lineColor": "#d44a3a",
								"colorMode": "custom",
								"op": "gt"
							}
						]
					}
				]
			}`,
		},
		{
			name: "migrate graph panel with threshold1 > threshold2",
			input: `{
				"schemaVersion": 12,
				"panels": [
					{
						"type": "graph",
						"grid": {
							"threshold1": 90,
							"threshold1Color": "#d44a3a",
							"threshold2": 80,
							"threshold2Color": "#d44a3a",
							"thresholdLine": false
						}
					}
				]
			}`,
			expected: `{
				"schemaVersion": 12,
				"panels": [
					{
						"type": "graph",
						"grid": {},
						"thresholds": [
							{
								"value": 90,
								"fill": true,
								"fillColor": "#d44a3a",
								"colorMode": "custom",
								"op": "lt"
							},
							{
								"value": 80,
								"fill": true,
								"fillColor": "#d44a3a",
								"colorMode": "custom",
								"op": "lt"
							}
						]
					}
				]
			}`,
		},
		{
			name: "migrate graph panel with existing thresholds",
			input: `{
				"schemaVersion": 12,
				"panels": [
					{
						"type": "graph",
						"thresholds": [
							{
								"value": 50,
								"color": "#7EB26D"
							}
						],
						"grid": {
							"threshold1": 80,
							"threshold1Color": "#d44a3a",
							"thresholdLine": true
						}
					}
				]
			}`,
			expected: `{
				"schemaVersion": 12,
				"panels": [
					{
						"type": "graph",
						"thresholds": [
							{
								"value": 50,
								"color": "#7EB26D",
								"op": "gt"
							},
							{
								"value": 80,
								"line": true,
								"lineColor": "#d44a3a",
								"colorMode": "custom",
								"op": "gt"
							}
						],
						"grid": {}
					}
				]
			}`,
		},
		{
			name: "skip non-graph panels",
			input: `{
				"schemaVersion": 12,
				"panels": [
					{
						"type": "stat",
						"grid": {
							"threshold1": 80,
							"threshold1Color": "#d44a3a"
						}
					}
				]
			}`,
			expected: `{
				"schemaVersion": 12,
				"panels": [
					{
						"type": "stat",
						"grid": {
							"threshold1": 80,
							"threshold1Color": "#d44a3a"
						}
					}
				]
			}`,
		},
		{
			name: "skip panels without grid",
			input: `{
				"schemaVersion": 12,
				"panels": [
					{
						"type": "graph"
					}
				]
			}`,
			expected: `{
				"schemaVersion": 12,
				"panels": [
					{
						"type": "graph"
					}
				]
			}`,
		},
		{
			name: "handle nil threshold values",
			input: `{
				"schemaVersion": 12,
				"panels": [
					{
						"type": "graph",
						"grid": {
							"threshold1": null,
							"threshold2": null
						}
					}
				]
			}`,
			expected: `{
				"schemaVersion": 12,
				"panels": [
					{
						"type": "graph",
						"grid": {},
						"thresholds": []
					}
				]
			}`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var input map[string]interface{}
			err := json.Unmarshal([]byte(tt.input), &input)
			require.NoError(t, err)

			var expected map[string]interface{}
			err = json.Unmarshal([]byte(tt.expected), &expected)
			require.NoError(t, err)

			err = V13(input)
			require.NoError(t, err)

			// Compare the result
			require.Equal(t, expected, input)
		})
	}
}
