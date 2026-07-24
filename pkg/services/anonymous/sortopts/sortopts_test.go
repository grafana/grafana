package sortopts

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestSorter(t *testing.T) {
	tests := []struct {
		name        string
		query       string
		expectedSQL []string
		expectedErr bool
	}{
		{
			name:  "empty query",
			query: "",
		},
		{
			name:        "single field ascending",
			query:       "userAgent-asc",
			expectedSQL: []string{"user_agent ASC"},
		},
		{
			name:        "single field descending",
			query:       "userAgent-desc",
			expectedSQL: []string{"user_agent DESC"},
		},
		{
			name:        "multiple fields",
			query:       "userAgent-asc,updatedAt-desc",
			expectedSQL: []string{"user_agent ASC", "updated_at DESC"},
		},
		{
			name:        "unknown option",
			query:       "uzer_agent",
			expectedErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			sortOptions, err := ParseSortQueryParam(tt.query)
			if tt.expectedErr {
				require.Error(t, err)
			} else {
				require.NoError(t, err)
			}

			if len(tt.expectedSQL) > 0 {
				orderBy := make([]string, 0)
				for _, opt := range sortOptions {
					require.Len(t, opt.Filter, 1)

					orderBy = append(orderBy, opt.Filter[0].OrderBy())
				}

				assert.EqualValues(t, tt.expectedSQL, orderBy)
			}
		})
	}
}

func TestSorter_OrderBy(t *testing.T) {
	tests := []struct {
		name        string
		sorter      Sorter
		expectedSQL string
	}{
		{
			name: "with table name ascending",
			sorter: Sorter{
				Field:         "user_agent",
				WithTableName: true,
			},
			expectedSQL: "anon_device.user_agent ASC",
		},
		{
			name: "with table name descending",
			sorter: Sorter{
				Field:         "user_agent",
				WithTableName: true,
				Descending:    true,
			},
			expectedSQL: "anon_device.user_agent DESC",
		},
		{
			name: "without table name ascending",
			sorter: Sorter{
				Field: "user_agent",
			},
			expectedSQL: "user_agent ASC",
		},
		{
			name: "without table name descending",
			sorter: Sorter{
				Field:      "user_agent",
				Descending: true,
			},
			expectedSQL: "user_agent DESC",
		},
		{
			name: "with table name lowercase ascending",
			sorter: Sorter{
				Field:         "user_agent",
				WithTableName: true,
				LowerCase:     true,
			},
			expectedSQL: "LOWER(anon_device.user_agent) ASC",
		},
		{
			name: "with table name lowercase descending",
			sorter: Sorter{
				Field:         "user_agent",
				WithTableName: true,
				LowerCase:     true,
				Descending:    true,
			},
			expectedSQL: "LOWER(anon_device.user_agent) DESC",
		},
		{
			name: "without table name lowercase ascending",
			sorter: Sorter{
				Field:     "user_agent",
				LowerCase: true,
			},
			expectedSQL: "LOWER(user_agent) ASC",
		},
		{
			name: "without table name lowercase descending",
			sorter: Sorter{
				Field:      "user_agent",
				LowerCase:  true,
				Descending: true,
			},
			expectedSQL: "LOWER(user_agent) DESC",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.expectedSQL, tt.sorter.OrderBy())
		})
	}
}
