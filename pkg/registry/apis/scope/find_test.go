package scope

import (
	"testing"

	scope "github.com/grafana/grafana/pkg/apis/scope/v0alpha1"
	"github.com/stretchr/testify/require"
)

func TestFilterAndAppendItem(t *testing.T) {
	t.Run("Appends item to results if parent matches and query is empty", func(t *testing.T) {
		item := scope.ScopeNode{
			Spec: scope.ScopeNodeSpec{
				ParentName:  "parentNumberOne",
				Title:       "item",
				Description: "item description",
				NodeType:    "item type",
				LinkType:    "item link type",
				LinkID:      "item link ID",
			},
		}

		results := &scope.TreeResults{}
		filterAndAppendItem(item, "parentNumberOne", "", results)
		require.Equal(t, len(results.Items), 1)
	})

	t.Run("Does not append item to results if title doesn't start with query", func(t *testing.T) {
		item := scope.ScopeNode{
			Spec: scope.ScopeNodeSpec{
				ParentName:  "parentNumberOne",
				Title:       "itemOne",
				Description: "item description",
				NodeType:    "item type",
				LinkType:    "item link type",
				LinkID:      "item link ID",
			},
		}

		results := &scope.TreeResults{}
		filterAndAppendItem(item, "parentNumberOne", "itemTwo", results)
		require.Equal(t, len(results.Items), 0)
	})

	t.Run("Does not append item to results if parent does not match", func(t *testing.T) {
		item := scope.ScopeNode{
			Spec: scope.ScopeNodeSpec{
				ParentName:  "",
				Title:       "itemOne",
				Description: "item description",
				NodeType:    "item type",
				LinkType:    "item link type",
				LinkID:      "item link ID",
			},
		}

		results := &scope.TreeResults{}
		filterAndAppendItem(item, "", "itemTwo", results)
		require.Equal(t, len(results.Items), 0)
	})
}
