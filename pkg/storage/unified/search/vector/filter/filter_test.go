package filter_test

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/storage/unified/search/vector/filter"
)

func assertLogicalExpression(t *testing.T, got *filter.Filter, want *filter.Filter) {
	t.Helper()
	require.NotNil(t, got)
	require.NotNil(t, want)

	gotExpr := got.Logical
	wantExpr := want.Logical

	require.NotNil(t, gotExpr, "Expected LogicalExpression, but was nil")
	require.NotNil(t, wantExpr, "Wanted LogicalExpression, but was nil")

	assert.Equal(t, wantExpr.Operator, gotExpr.Operator, "Operator mismatch")
	require.Len(t, gotExpr.Filters, len(wantExpr.Filters), "Filter count mismatch")

	// Compare filters in a way that is order-insensitive
	for _, wf := range wantExpr.Filters {
		assert.Contains(t, gotExpr.Filters, wf)
	}
}

func TestParse(t *testing.T) {
	testCases := []struct {
		name      string
		input     string
		want      *filter.Filter
		wantErr   error
		checkErr  bool
		customCmp bool
	}{
		{
			name:  "simple equality",
			input: `{"genre": "documentary"}`,
			want: &filter.Filter{
				Comparison: &filter.ComparisonExpression{
					Field: "genre", Operator: filter.Eq, Value: "documentary",
				},
			},
		},
		{
			name:  "explicit equality",
			input: `{"genre": {"$eq": "documentary"}}`,
			want: &filter.Filter{
				Comparison: &filter.ComparisonExpression{
					Field: "genre", Operator: filter.Eq, Value: "documentary",
				},
			},
		},
		{
			name:  "not equal",
			input: `{"genre": {"$ne": "drama"}}`,
			want: &filter.Filter{
				Comparison: &filter.ComparisonExpression{
					Field: "genre", Operator: filter.Ne, Value: "drama",
				},
			},
		},
		{
			name:  "greater than",
			input: `{"year": {"$gt": 2019}}`,
			want: &filter.Filter{
				Comparison: &filter.ComparisonExpression{
					Field: "year", Operator: filter.Gt, Value: float64(2019),
				},
			},
		},
		{
			name:  "greater than or equal",
			input: `{"year": {"$gte": 2020}}`,
			want: &filter.Filter{
				Comparison: &filter.ComparisonExpression{
					Field: "year", Operator: filter.Gte, Value: float64(2020),
				},
			},
		},
		{
			name:  "less than",
			input: `{"year": {"$lt": 2020}}`,
			want: &filter.Filter{
				Comparison: &filter.ComparisonExpression{
					Field: "year", Operator: filter.Lt, Value: float64(2020),
				},
			},
		},
		{
			name:  "less than or equal",
			input: `{"year": {"$lte": 2020}}`,
			want: &filter.Filter{
				Comparison: &filter.ComparisonExpression{
					Field: "year", Operator: filter.Lte, Value: float64(2020),
				},
			},
		},
		{
			name:  "in array",
			input: `{"genre": {"$in": ["comedy", "documentary"]}}`,
			want: &filter.Filter{
				Comparison: &filter.ComparisonExpression{
					Field: "genre", Operator: filter.In, Value: []any{"comedy", "documentary"},
				},
			},
		},
		{
			name:  "not in array",
			input: `{"genre": {"$nin": ["comedy", "documentary"]}}`,
			want: &filter.Filter{
				Comparison: &filter.ComparisonExpression{
					Field: "genre", Operator: filter.Nin, Value: []any{"comedy", "documentary"},
				},
			},
		},
		{
			name:  "exists true",
			input: `{"genre": {"$exists": true}}`,
			want: &filter.Filter{
				Existence: &filter.ExistenceExpression{
					Field: "genre", Operator: filter.Exists, Exists: true,
				},
			},
		},
		{
			name:  "exists false",
			input: `{"genre": {"$exists": false}}`,
			want: &filter.Filter{
				Existence: &filter.ExistenceExpression{
					Field: "genre", Operator: filter.Exists, Exists: false,
				},
			},
		},
		{
			name:  "logical AND",
			input: `{"$and": [{"genre": "drama"}, {"year": {"$gte": 2020}}]}`,
			want: &filter.Filter{
				Logical: &filter.LogicalExpression{
					Operator: filter.And,
					Filters: []*filter.Filter{
						{Comparison: &filter.ComparisonExpression{Field: "genre", Operator: filter.Eq, Value: "drama"}},
						{Comparison: &filter.ComparisonExpression{Field: "year", Operator: filter.Gte, Value: float64(2020)}},
					},
				},
			},
		},
		{
			name:  "logical OR",
			input: `{"$or": [{"genre": "drama"}, {"year": {"$gte": 2020}}]}`,
			want: &filter.Filter{
				Logical: &filter.LogicalExpression{
					Operator: filter.Or,
					Filters: []*filter.Filter{
						{Comparison: &filter.ComparisonExpression{Field: "genre", Operator: filter.Eq, Value: "drama"}},
						{Comparison: &filter.ComparisonExpression{Field: "year", Operator: filter.Gte, Value: float64(2020)}},
					},
				},
			},
		},
		{
			name:  "implicit AND on multiple fields",
			input: `{"genre": "drama", "year": 2021}`,
			want: &filter.Filter{
				Logical: &filter.LogicalExpression{
					Operator: filter.And,
					Filters: []*filter.Filter{
						{Comparison: &filter.ComparisonExpression{Field: "genre", Operator: filter.Eq, Value: "drama"}},
						{Comparison: &filter.ComparisonExpression{Field: "year", Operator: filter.Eq, Value: float64(2021)}},
					},
				},
			},
			customCmp: true,
		},
		{
			name:  "implicit AND on same field",
			input: `{"price": {"$gte": 10, "$lte": 50}}`,
			want: &filter.Filter{
				Logical: &filter.LogicalExpression{
					Operator: filter.And,
					Filters: []*filter.Filter{
						{Comparison: &filter.ComparisonExpression{Field: "price", Operator: filter.Gte, Value: float64(10)}},
						{Comparison: &filter.ComparisonExpression{Field: "price", Operator: filter.Lte, Value: float64(50)}},
					},
				},
			},
			customCmp: true,
		},
		{
			name:     "invalid JSON",
			input:    `{"genre": "documentary"`,
			wantErr:  filter.ErrInvalidFilter,
			checkErr: true,
		},
		{
			name:  "empty filter",
			input: `{}`,
			want:  nil,
		},
		{
			name:     "logical operator with other keys",
			input:    `{"$and": [], "other": "value"}`,
			wantErr:  filter.ErrInvalidFilter,
			checkErr: true,
		},
		{
			name:     "logical operator value not array",
			input:    `{"$and": {}}`,
			wantErr:  filter.ErrInvalidFilter,
			checkErr: true,
		},
		{
			name:     "logical operator empty array",
			input:    `{"$and": []}`,
			wantErr:  filter.ErrInvalidFilter,
			checkErr: true,
		},
		{
			name:     "$exists value not boolean",
			input:    `{"field": {"$exists": "true"}}`,
			wantErr:  filter.ErrInvalidFilter,
			checkErr: true,
		},
		{
			name:     "$gt value not number",
			input:    `{"field": {"$gt": "2020"}}`,
			wantErr:  filter.ErrInvalidFilter,
			checkErr: true,
		},
		{
			name:     "$in value not array",
			input:    `{"field": {"$in": "comedy"}}`,
			wantErr:  filter.ErrInvalidFilter,
			checkErr: true,
		},
		{
			name:     "$in empty array",
			input:    `{"field": {"$in": []}}`,
			wantErr:  filter.ErrInvalidFilter,
			checkErr: true,
		},
		{
			name:     "$in array with non-primitive",
			input:    `{"field": {"$in": ["a", {}]}}`,
			wantErr:  filter.ErrInvalidFilter,
			checkErr: true,
		},
		{
			name:     "unknown operator",
			input:    `{"field": {"$what": 1}}`,
			wantErr:  filter.ErrInvalidFilter,
			checkErr: true,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			got, err := filter.Parse(json.RawMessage(tc.input))

			if tc.checkErr {
				require.ErrorIs(t, err, tc.wantErr)
				return
			}
			require.NoError(t, err)

			if tc.customCmp {
				assertLogicalExpression(t, got, tc.want)
			} else {
				assert.Equal(t, tc.want, got)
			}
		})
	}
}
