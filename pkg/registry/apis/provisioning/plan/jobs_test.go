package plan_test

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/registry/apis/provisioning/plan"
)

// A move job builds its target path from a job-supplied directory and a base
// name. Nothing classified it, so a move could land a resource where Grafana
// cannot address it: the write succeeds in the repository and the next sync
// deletes it, with the repository and Grafana disagreeing and nothing saying
// why.
func TestJobPathsAreRefusedByTheSameRuleAsSync(t *testing.T) {
	tests := []struct {
		name    string
		path    string
		refused bool
	}{
		{name: "addressable file", path: "team/dashboard.json"},
		{name: "addressable folder", path: "team/sub/"},
		{name: "unsafe character", path: "team/Backend & UI.json", refused: true},
		{name: "unsafe folder", path: "team/bad & dir/", refused: true},
		{name: "traversal", path: "../escape.json", refused: true},
		{name: "too deep", path: "a/b/c/d/e/f/g/h/i/deep.json", refused: true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			refused := plan.RefuseUnsupportedPaths(tt.path)
			if !tt.refused {
				require.Empty(t, refused, "this path is addressable and must not be refused")
				return
			}
			require.Len(t, refused, 1)
			require.Equal(t, tt.path, refused[0].Path)
			require.Equal(t, plan.ReasonUnsupportedPath, refused[0].Reason)
		})
	}
}

// A README is not a resource, so a job moving one is not writing a resource at
// an unaddressable path and must not be refused.
func TestJobPathRefusalIgnoresNonResources(t *testing.T) {
	require.Empty(t, plan.RefuseUnsupportedPaths("team/README.md", "team/.keep"))
}
