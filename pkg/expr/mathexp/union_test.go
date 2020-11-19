package mathexp

import (
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/stretchr/testify/assert"
)

func Test_union(t *testing.T) {
	var tests = []struct {
		name      string
		aResults  Results
		bResults  Results
		unionsAre assert.ComparisonAssertionFunc
		unions    []*Union
	}{
		{
			name: "equal tags single union",
			aResults: Results{
				Values: Values{
					makeSeriesNullableTime("a", data.Labels{"id": "1"}),
				},
			},
			bResults: Results{
				Values: Values{
					makeSeriesNullableTime("b", data.Labels{"id": "1"}),
				},
			},
			unionsAre: assert.EqualValues,
			unions: []*Union{
				{
					Labels: data.Labels{"id": "1"},
					A:      makeSeriesNullableTime("a", data.Labels{"id": "1"}),
					B:      makeSeriesNullableTime("b", data.Labels{"id": "1"}),
				},
			},
		},
		{
			name: "equal tags keys with no matching values will result in a union when len(A) == 1 && len(B) == 1",
			aResults: Results{
				Values: Values{
					makeSeriesNullableTime("a", data.Labels{"id": "1"}),
				},
			},
			bResults: Results{
				Values: Values{
					makeSeriesNullableTime("b", data.Labels{"id": "2"}),
				},
			},
			unionsAre: assert.EqualValues,
			unions: []*Union{
				{
					A: makeSeriesNullableTime("a", data.Labels{"id": "1"}),
					B: makeSeriesNullableTime("b", data.Labels{"id": "2"}),
				},
			},
		},
		{
			name: "equal tags keys with no matching values will result in no unions when len(A) != 1 && len(B) != 1",
			aResults: Results{
				Values: Values{
					makeSeriesNullableTime("a", data.Labels{"id": "1"}),
					makeSeriesNullableTime("q", data.Labels{"id": "3"}),
				},
			},
			bResults: Results{
				Values: Values{
					makeSeriesNullableTime("b", data.Labels{"id": "2"}),
				},
			},
			unionsAre: assert.EqualValues,
			unions:    []*Union{},
		},
		{
			name:      "empty results will result in no unions",
			aResults:  Results{},
			bResults:  Results{},
			unionsAre: assert.EqualValues,
			unions:    []*Union{},
		},
		{
			name: "incompatible tags of different length with will result in no unions when len(A) != 1 && len(B) != 1",
			aResults: Results{
				Values: Values{
					makeSeriesNullableTime("a", data.Labels{"ID": "1"}),
					makeSeriesNullableTime("q", data.Labels{"ID": "3"}),
				},
			},
			bResults: Results{
				Values: Values{
					makeSeriesNullableTime("b", data.Labels{"id": "1", "fish": "red snapper"}),
				},
			},
			unionsAre: assert.EqualValues,
			unions:    []*Union{},
		},
		{
			name: "A is subset of B results in single union with Labels of B",
			aResults: Results{
				Values: Values{
					makeSeriesNullableTime("a", data.Labels{"id": "1"}),
				},
			},
			bResults: Results{
				Values: Values{
					makeSeriesNullableTime("b", data.Labels{"id": "1", "fish": "herring"}),
				},
			},
			unionsAre: assert.EqualValues,
			unions: []*Union{
				{
					Labels: data.Labels{"id": "1", "fish": "herring"}, // Union gets the labels that is not the subset
					A:      makeSeriesNullableTime("a", data.Labels{"id": "1"}),
					B:      makeSeriesNullableTime("b", data.Labels{"id": "1", "fish": "herring"}),
				},
			},
		},
		{
			name: "B is subset of A results in single union with Labels of A",
			aResults: Results{
				Values: Values{
					makeSeriesNullableTime("a", data.Labels{"id": "1", "fish": "herring"}),
				},
			},
			bResults: Results{
				Values: Values{
					makeSeriesNullableTime("b", data.Labels{"id": "1"}),
				},
			},
			unionsAre: assert.EqualValues,
			unions: []*Union{
				{
					Labels: data.Labels{"id": "1", "fish": "herring"}, // Union gets the labels that is not the subset
					A:      makeSeriesNullableTime("a", data.Labels{"id": "1", "fish": "herring"}),
					B:      makeSeriesNullableTime("b", data.Labels{"id": "1"}),
				},
			},
		},
		{
			name: "single valued A is subset of many valued B, results in many union with Labels of B",
			aResults: Results{
				Values: Values{
					makeSeriesNullableTime("a", data.Labels{"id": "1"}),
				},
			},
			bResults: Results{
				Values: Values{
					makeSeriesNullableTime("b", data.Labels{"id": "1", "fish": "herring"}),
					makeSeriesNullableTime("b", data.Labels{"id": "1", "fish": "red snapper"}),
				},
			},
			unionsAre: assert.EqualValues,
			unions: []*Union{
				{
					Labels: data.Labels{"id": "1", "fish": "herring"},
					A:      makeSeriesNullableTime("a", data.Labels{"id": "1"}),
					B:      makeSeriesNullableTime("b", data.Labels{"id": "1", "fish": "herring"}),
				},
				{
					Labels: data.Labels{"id": "1", "fish": "red snapper"},
					A:      makeSeriesNullableTime("a", data.Labels{"id": "1"}),
					B:      makeSeriesNullableTime("b", data.Labels{"id": "1", "fish": "red snapper"}),
				},
			},
		},
		{
			name: "A with different tags keys lengths to B makes 3 unions (with two unions have matching tags)",
			// Is this the behavior we want? A result within the results will no longer
			// be uniquely identifiable.
			aResults: Results{
				Values: Values{
					makeSeriesNullableTime("a", data.Labels{"id": "1"}),
					makeSeriesNullableTime("aa", data.Labels{"id": "1", "fish": "herring"}),
				},
			},
			bResults: Results{
				Values: Values{
					makeSeriesNullableTime("b", data.Labels{"id": "1", "fish": "herring"}),
					makeSeriesNullableTime("bb", data.Labels{"id": "1", "fish": "red snapper"}),
				},
			},
			unionsAre: assert.EqualValues,
			unions: []*Union{
				{
					Labels: data.Labels{"id": "1", "fish": "herring"},
					A:      makeSeriesNullableTime("a", data.Labels{"id": "1"}),
					B:      makeSeriesNullableTime("b", data.Labels{"id": "1", "fish": "herring"}),
				},
				{
					Labels: data.Labels{"id": "1", "fish": "red snapper"},
					A:      makeSeriesNullableTime("a", data.Labels{"id": "1"}),
					B:      makeSeriesNullableTime("bb", data.Labels{"id": "1", "fish": "red snapper"}),
				},
				{
					Labels: data.Labels{"id": "1", "fish": "herring"},
					A:      makeSeriesNullableTime("aa", data.Labels{"id": "1", "fish": "herring"}),
					B:      makeSeriesNullableTime("b", data.Labels{"id": "1", "fish": "herring"}),
				},
			},
		},
		{
			name: "B with different tags keys lengths to A makes 3 unions (with two unions have matching tags)",
			// Is this the behavior we want? A result within the results will no longer
			// be uniquely identifiable.
			aResults: Results{
				Values: Values{
					makeSeriesNullableTime("b", data.Labels{"id": "1", "fish": "herring"}),
					makeSeriesNullableTime("bb", data.Labels{"id": "1", "fish": "red snapper"}),
				},
			},
			bResults: Results{
				Values: Values{
					makeSeriesNullableTime("a", data.Labels{"id": "1"}),
					makeSeriesNullableTime("aa", data.Labels{"id": "1", "fish": "herring"}),
				},
			},
			unionsAre: assert.EqualValues,
			unions: []*Union{
				{
					Labels: data.Labels{"id": "1", "fish": "herring"},
					A:      makeSeriesNullableTime("b", data.Labels{"id": "1", "fish": "herring"}),
					B:      makeSeriesNullableTime("a", data.Labels{"id": "1"}),
				},
				{
					Labels: data.Labels{"id": "1", "fish": "herring"},
					A:      makeSeriesNullableTime("b", data.Labels{"id": "1", "fish": "herring"}),
					B:      makeSeriesNullableTime("aa", data.Labels{"id": "1", "fish": "herring"}),
				},
				{
					Labels: data.Labels{"id": "1", "fish": "red snapper"},
					A:      makeSeriesNullableTime("bb", data.Labels{"id": "1", "fish": "red snapper"}),
					B:      makeSeriesNullableTime("a", data.Labels{"id": "1"}),
				},
			},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			unions := union(tt.aResults, tt.bResults)
			tt.unionsAre(t, tt.unions, unions)
		})
	}
}
