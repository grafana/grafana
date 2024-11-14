package scope

import (
	"testing"

	scope "github.com/grafana/grafana/pkg/apis/scope/v0alpha1"
	"github.com/stretchr/testify/require"
)

func TestFilterAndAppendItem(t *testing.T) {
	tcs := []struct {
		Description string

		ParentName string
		Title      string

		QueryParam  string
		ParentParam string

		ExpectedMatches int
	}{
		{
			Description:     "Matching parent without query param",
			ParentName:      "ParentNumberOne",
			Title:           "item",
			QueryParam:      "",
			ParentParam:     "ParentNumberOne",
			ExpectedMatches: 1,
		},
		{
			Description:     "Not matching parent",
			ParentName:      "ParentNumberOne",
			Title:           "itemOne",
			QueryParam:      "itemTwo",
			ParentParam:     "ParentNumberTwo",
			ExpectedMatches: 0,
		},
		{
			Description:     "Matching parent and query param",
			ParentName:      "ParentNumberOne",
			Title:           "itemOne",
			QueryParam:      "itemOne",
			ParentParam:     "ParentNumberOne",
			ExpectedMatches: 1,
		},
		{
			Description:     "matching parent but not matching query param",
			ParentName:      "ParentNumberOne",
			Title:           "itemOne",
			QueryParam:      "itemTwo",
			ParentParam:     "ParentNumberOne",
			ExpectedMatches: 0,
		},
	}

	for _, tc := range tcs {
		results := &scope.FindScopeNodeChildrenResults{}
		item := scope.ScopeNode{
			Spec: scope.ScopeNodeSpec{
				ParentName:  tc.ParentName,
				Title:       tc.Title,
				Description: "item description",
				NodeType:    "item type",
				LinkType:    "item link type",
				LinkID:      "item link ID",
			},
		}
		filterAndAppendItem(item, tc.ParentParam, tc.QueryParam, results)
		require.Equal(t, len(results.Items), tc.ExpectedMatches, tc.Description)
	}
}
