package accesspolicy

import (
	"encoding/json"
	"fmt"
	"testing"

	"github.com/grafana/grafana/pkg/util"
	"github.com/stretchr/testify/require"
)

func TestRuleReducer(t *testing.T) {
	t.Run("Check write pointer becomes star", func(t *testing.T) {
		rules := ReduceRules([]AccessRule{
			{Kind: "dashboard", Verb: "read"},
			{Kind: "dashboard", Verb: "write", Target: util.Pointer("permissions")},
			{Kind: "dashboard", Verb: "read"},
		})
		require.Len(t, rules, 1)
		require.Equal(t, rules[0], AccessRule{Kind: "dashboard", Verb: "*"})
	})

	t.Run("Check sort", func(t *testing.T) {
		rules := ReduceRules([]AccessRule{
			{Kind: "x", Verb: "b"},
			{Kind: "x", Verb: "a"},
			{Kind: "x", Verb: "a"}, // ignore duplicates
			{Kind: "x", Verb: "a"}, // ignore duplicates
			{Kind: "x", Verb: "a"}, // ignore duplicates
			{Kind: "x", Verb: "a"},
			{Kind: "z", Verb: "b"},
			{Kind: "AAA", Verb: ""}, // ignore
			{Kind: "", Verb: "XXX"}, // ignore
			{Kind: "z", Verb: "a"},
			{Kind: "y", Verb: "b"},
			{Kind: "y", Verb: "a"},
		})
		out, err := json.MarshalIndent(rules, "", "  ")
		fmt.Printf("%s", string(out))
		require.NoError(t, err)
		require.JSONEq(t, `[
			{
			  "kind": "x",
			  "verb": "a"
			},
			{
			  "kind": "x",
			  "verb": "b"
			},
			{
			  "kind": "y",
			  "verb": "a"
			},
			{
			  "kind": "y",
			  "verb": "b"
			},
			{
			  "kind": "z",
			  "verb": "a"
			},
			{
			  "kind": "z",
			  "verb": "b"
			}
		  ]`, string(out))
	})
}
