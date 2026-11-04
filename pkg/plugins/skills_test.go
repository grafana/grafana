package plugins

import (
	"encoding/json"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestReadPluginJSONSkills(t *testing.T) {
	for _, tt := range []struct {
		name  string
		slug  string
		path  string
		valid bool
	}{
		{"packaged skill", "investigate-errors", "skills/investigate-errors/SKILL.md", true},
		{"root skill", "overview", "SKILL.md", true},
		{"longest slug", strings.Repeat("a", 64), "skills/workflow.md", true},
		{"empty slug", "", "SKILL.md", false},
		{"uppercase slug", "Overview", "SKILL.md", false},
		{"long slug", strings.Repeat("a", 65), "SKILL.md", false},
		{"empty path", "overview", "", false},
		{"absolute path", "overview", "/skills/SKILL.md", false},
		{"parent path", "overview", "../SKILL.md", false},
		{"nested parent", "overview", "skills/../SKILL.md", false},
		{"dot segment", "overview", "skills/./SKILL.md", false},
		{"empty segment", "overview", "skills//SKILL.md", false},
		{"backslash", "overview", `skills\SKILL.md`, false},
		{"URL", "overview", "https://example.com/SKILL.md", false},
		{"encoded parent", "overview", "skills/%2e%2e/SKILL.md", false},
		{"query string", "overview", "SKILL.md?raw=true", false},
		{"fragment", "overview", "SKILL.md#instructions", false},
		{"not markdown", "overview", "skills/workflow.js", false},
		{"long path", "overview", strings.Repeat("a", 1022) + ".md", false},
	} {
		t.Run(tt.name, func(t *testing.T) {
			raw, err := json.Marshal(map[string]any{"id": "example-app", "type": "app", "extensions": map[string]any{"skills": map[string]Skill{tt.slug: {Path: tt.path}}}})
			require.NoError(t, err)
			plugin, err := ReadPluginJSON(strings.NewReader(string(raw)))
			if !tt.valid {
				require.ErrorIs(t, err, ErrInvalidPluginJSON)
				return
			}
			require.NoError(t, err)
			require.Equal(t, tt.path, plugin.Extensions.Skills[tt.slug].Path)
			encoded, err := json.Marshal(plugin.Extensions)
			require.NoError(t, err)
			var restored Extensions
			require.NoError(t, json.Unmarshal(encoded, &restored))
			require.Equal(t, plugin.Extensions.Skills, restored.Skills)
		})
	}
}
