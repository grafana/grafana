package schemaversion_test

import (
	"testing"

	"github.com/grafana/grafana/apps/dashboard/pkg/migration/schemaversion"
)

func TestV26(t *testing.T) {
	tests := []migrationTestCase{
		{
			name: "migrate text2 to text",
			input: map[string]interface{}{
				"schemaVersion": 25,
				"panels": []interface{}{
					map[string]interface{}{
						"id":    1,
						"type":  "text2",
						"title": "Text2 Panel",
					},
				},
			},
			expected: map[string]interface{}{
				"schemaVersion": 26,
				"panels": []interface{}{
					map[string]interface{}{
						"id":    1,
						"type":  "text",
						"title": "Text2 Panel",
					},
				},
			},
		},
		{
			name: "should not migrate panel with old text panel id",
			input: map[string]interface{}{
				"schemaVersion": 25,
				"panels": []interface{}{
					map[string]interface{}{
						"id":      2,
						"type":    "text",
						"title":   "Angular Text Panel",
						"content": "# Angular Text Panel\n# $constant\n\nFor markdown syntax help: [commonmark.org/help](https://commonmark.org/help/)\n\n## $text\n\n",
						"mode":    "markdown",
					},
				},
			},
			expected: map[string]interface{}{
				"schemaVersion": 26,
				"panels": []interface{}{
					map[string]interface{}{
						"id":      2,
						"type":    "text",
						"title":   "Angular Text Panel",
						"content": "# Angular Text Panel\n# $constant\n\nFor markdown syntax help: [commonmark.org/help](https://commonmark.org/help/)\n\n## $text\n\n",
						"mode":    "markdown",
					},
				},
			},
		},
		{
			name: "should clean up old angular options for panels with new Text Panel id",
			input: map[string]interface{}{
				"schemaVersion": 25,
				"panels": []interface{}{
					map[string]interface{}{
						"id":    3,
						"type":  "text2",
						"title": "React Text Panel from Angular Panel",
						"options": map[string]interface{}{
							"mode":    "markdown",
							"content": "# React Text Panel from Angular Panel\n# $constant\n\nFor markdown syntax help: [commonmark.org/help](https://commonmark.org/help/)\n\n## $text\n\n",
							"angular": map[string]interface{}{
								"content": "# React Text Panel from Angular Panel\n# $constant\n\nFor markdown syntax help: [commonmark.org/help](https://commonmark.org/help/)\n\n## $text\n\n",
								"mode":    "markdown",
								"options": map[string]interface{}{},
							},
						},
					},
				},
			},
			expected: map[string]interface{}{
				"schemaVersion": 26,
				"panels": []interface{}{
					map[string]interface{}{
						"id":    3,
						"type":  "text",
						"title": "React Text Panel from Angular Panel",
						"options": map[string]interface{}{
							"mode":    "markdown",
							"content": "# React Text Panel from Angular Panel\n# $constant\n\nFor markdown syntax help: [commonmark.org/help](https://commonmark.org/help/)\n\n## $text\n\n",
						},
					},
				},
			},
		},
	}

	runMigrationTests(t, tests, schemaversion.V26)
}
