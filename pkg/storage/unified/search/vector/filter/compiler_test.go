package filter

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestCompile(t *testing.T) {
	cases := []struct {
		name      string
		filter    *Filter
		wantQuery string
		wantArgs  []any
		wantErr   bool
	}{
		{
			name:      "nil filter",
			filter:    nil,
			wantQuery: "",
			wantArgs:  nil,
		},
		{
			name:      "simple equality uses containment",
			filter:    &Filter{Comparison: &ComparisonExpression{Field: "genre", Operator: Eq, Value: "documentary"}},
			wantQuery: "(metadata @> $1::jsonb)",
			wantArgs:  []any{`{"genre":"documentary"}`},
		},
		{
			name:      "numeric greater than casts to numeric",
			filter:    &Filter{Comparison: &ComparisonExpression{Field: "year", Operator: Gt, Value: 2019}},
			wantQuery: "(CASE WHEN jsonb_typeof(metadata -> $1) = 'number' THEN (metadata ->> $1)::numeric END > $2)",
			wantArgs:  []any{"year", 2019},
		},
		{
			name:      "not equal",
			filter:    &Filter{Comparison: &ComparisonExpression{Field: "genre", Operator: Ne, Value: "documentary"}},
			wantQuery: "NOT (COALESCE(metadata, '{}'::jsonb) @> $1::jsonb)",
			wantArgs:  []any{`{"genre":"documentary"}`},
		},
		{
			name:      "exists",
			filter:    &Filter{Existence: &ExistenceExpression{Field: "rating", Exists: true}},
			wantQuery: "(metadata ? $1)",
			wantArgs:  []any{"rating"},
		},
		{
			name:      "not exists",
			filter:    &Filter{Existence: &ExistenceExpression{Field: "rating", Exists: false}},
			wantQuery: "NOT (metadata ? $1)",
			wantArgs:  []any{"rating"},
		},
		{
			name:      "in clause",
			filter:    &Filter{Comparison: &ComparisonExpression{Field: "genre", Operator: In, Value: []any{"comedy", "drama"}}},
			wantQuery: "(jsonb_extract_path_text(metadata, $1) IN ($2, $3) OR (metadata->$4 @> $5::jsonb) OR (metadata->$6 @> $7::jsonb))",
			wantArgs:  []any{"genre", "comedy", "drama", "genre", `"comedy"`, "genre", `"drama"`},
		},
		{
			name:      "not in clause",
			filter:    &Filter{Comparison: &ComparisonExpression{Field: "genre", Operator: Nin, Value: []any{"comedy", "drama"}}},
			wantQuery: "(jsonb_extract_path_text(metadata, $1) NOT IN ($2, $3) AND NOT (metadata->$4 @> $5::jsonb) AND NOT (metadata->$6 @> $7::jsonb))",
			wantArgs:  []any{"genre", "comedy", "drama", "genre", `"comedy"`, "genre", `"drama"`},
		},
		{
			name:      "empty in clause is FALSE",
			filter:    &Filter{Comparison: &ComparisonExpression{Field: "genre", Operator: In, Value: []any{}}},
			wantQuery: "FALSE",
			wantArgs:  []any{},
		},
		{
			name:      "empty not in clause is TRUE",
			filter:    &Filter{Comparison: &ComparisonExpression{Field: "genre", Operator: Nin, Value: []any{}}},
			wantQuery: "TRUE",
			wantArgs:  []any{},
		},
		{
			name:    "unmarshallable in value errors",
			filter:  &Filter{Comparison: &ComparisonExpression{Field: "genre", Operator: In, Value: []any{make(chan int)}}},
			wantErr: true,
		},
		{
			name: "logical AND",
			filter: &Filter{Logical: &LogicalExpression{Operator: And, Filters: []*Filter{
				{Comparison: &ComparisonExpression{Field: "genre", Operator: Eq, Value: "drama"}},
				{Comparison: &ComparisonExpression{Field: "year", Operator: Gte, Value: 2020}},
			}}},
			wantQuery: "((metadata @> $1::jsonb) AND (CASE WHEN jsonb_typeof(metadata -> $2) = 'number' THEN (metadata ->> $2)::numeric END >= $3))",
			wantArgs:  []any{`{"genre":"drama"}`, "year", 2020},
		},
		{
			name: "logical OR",
			filter: &Filter{Logical: &LogicalExpression{Operator: Or, Filters: []*Filter{
				{Comparison: &ComparisonExpression{Field: "rating", Operator: Lte, Value: 2}},
				{Existence: &ExistenceExpression{Field: "sequel", Exists: false}},
			}}},
			wantQuery: "((CASE WHEN jsonb_typeof(metadata -> $1) = 'number' THEN (metadata ->> $1)::numeric END <= $2) OR NOT (metadata ? $3))",
			wantArgs:  []any{"rating", 2, "sequel"},
		},
		{
			name: "nested logical operators",
			filter: &Filter{Logical: &LogicalExpression{Operator: And, Filters: []*Filter{
				{Comparison: &ComparisonExpression{Field: "genre", Operator: Eq, Value: "action"}},
				{Logical: &LogicalExpression{Operator: Or, Filters: []*Filter{
					{Comparison: &ComparisonExpression{Field: "year", Operator: Gt, Value: 2010}},
					{Comparison: &ComparisonExpression{Field: "year", Operator: Lt, Value: 2000}},
				}}},
			}}},
			wantQuery: "((metadata @> $1::jsonb) AND ((CASE WHEN jsonb_typeof(metadata -> $2) = 'number' THEN (metadata ->> $2)::numeric END > $3) OR (CASE WHEN jsonb_typeof(metadata -> $4) = 'number' THEN (metadata ->> $4)::numeric END < $5)))",
			wantArgs:  []any{`{"genre":"action"}`, "year", 2010, "year", 2000},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			query, args, err := Compile(tc.filter)
			if tc.wantErr {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)
			assert.Equal(t, tc.wantQuery, query)
			assert.Equal(t, tc.wantArgs, args)
		})
	}
}

func TestCompileOptions(t *testing.T) {
	f := &Filter{Comparison: &ComparisonExpression{Field: "year", Operator: Gt, Value: 2019}}

	// FilterArgsOffset shifts the first placeholder so the clause can follow
	// fixed scope params (resource=$1, namespace=$2, model=$3).
	query, args, err := Compile(f, FilterArgsOffset(4), FilterAnd())
	require.NoError(t, err)
	assert.Equal(t, " AND (CASE WHEN jsonb_typeof(metadata -> $4) = 'number' THEN (metadata ->> $4)::numeric END > $5)", query)
	assert.Equal(t, []any{"year", 2019}, args)

	// FilterAnd on a nil filter stays empty (no dangling AND).
	query, _, err = Compile(nil, FilterAnd())
	require.NoError(t, err)
	assert.Equal(t, "", query)
}
