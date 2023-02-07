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
					makeSeries("a", data.Labels{"id": "1"}),
				},
			},
			bResults: Results{
				Values: Values{
					makeSeries("b", data.Labels{"id": "1"}),
				},
			},
			unionsAre: assert.EqualValues,
			unions: []*Union{
				{
					Labels: data.Labels{"id": "1"},
					A:      makeSeries("a", data.Labels{"id": "1"}),
					B:      makeSeries("b", data.Labels{"id": "1"}),
				},
			},
		},
		{
			name: "equal tags keys with no matching values will result in a union when len(A) == 1 && len(B) == 1",
			aResults: Results{
				Values: Values{
					makeSeries("a", data.Labels{"id": "1"}),
				},
			},
			bResults: Results{
				Values: Values{
					makeSeries("b", data.Labels{"id": "2"}),
				},
			},
			unionsAre: assert.EqualValues,
			unions: []*Union{
				{
					A: makeSeries("a", data.Labels{"id": "1"}),
					B: makeSeries("b", data.Labels{"id": "2"}),
				},
			},
		},
		{
			name: "equal tags keys with no matching values will result in no unions when len(A) != 1 && len(B) != 1",
			aResults: Results{
				Values: Values{
					makeSeries("a", data.Labels{"id": "1"}),
					makeSeries("q", data.Labels{"id": "3"}),
				},
			},
			bResults: Results{
				Values: Values{
					makeSeries("b", data.Labels{"id": "2"}),
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
			name: "empty result and data result will result in no unions",
			aResults: Results{
				Values: Values{
					makeSeries("a", data.Labels{"id": "1"}),
				},
			},
			bResults:  Results{},
			unionsAre: assert.EqualValues,
			unions:    []*Union{},
		},
		{
			name: "no data result and data result will result in no unions",
			aResults: Results{
				Values: Values{
					makeSeries("a", data.Labels{"id": "1"}),
				},
			},
			bResults: Results{
				Values: Values{
					NoData{}.New(),
				},
			},
			unionsAre: assert.EqualValues,
			unions: []*Union{
				{
					Labels: nil,
					A:      makeSeries("a", data.Labels{"id": "1"}),
					B:      NewNoData(),
				},
			},
		},
		{
			name: "incompatible tags of different length with will result in no unions when len(A) != 1 && len(B) != 1",
			aResults: Results{
				Values: Values{
					makeSeries("a", data.Labels{"ID": "1"}),
					makeSeries("q", data.Labels{"ID": "3"}),
				},
			},
			bResults: Results{
				Values: Values{
					makeSeries("b", data.Labels{"id": "1", "fish": "red snapper"}),
				},
			},
			unionsAre: assert.EqualValues,
			unions:    []*Union{},
		},
		{
			name: "A is subset of B results in single union with Labels of B",
			aResults: Results{
				Values: Values{
					makeSeries("a", data.Labels{"id": "1"}),
				},
			},
			bResults: Results{
				Values: Values{
					makeSeries("b", data.Labels{"id": "1", "fish": "herring"}),
				},
			},
			unionsAre: assert.EqualValues,
			unions: []*Union{
				{
					Labels: data.Labels{"id": "1", "fish": "herring"}, // Union gets the labels that is not the subset
					A:      makeSeries("a", data.Labels{"id": "1"}),
					B:      makeSeries("b", data.Labels{"id": "1", "fish": "herring"}),
				},
			},
		},
		{
			name: "B is subset of A results in single union with Labels of A",
			aResults: Results{
				Values: Values{
					makeSeries("a", data.Labels{"id": "1", "fish": "herring"}),
				},
			},
			bResults: Results{
				Values: Values{
					makeSeries("b", data.Labels{"id": "1"}),
				},
			},
			unionsAre: assert.EqualValues,
			unions: []*Union{
				{
					Labels: data.Labels{"id": "1", "fish": "herring"}, // Union gets the labels that is not the subset
					A:      makeSeries("a", data.Labels{"id": "1", "fish": "herring"}),
					B:      makeSeries("b", data.Labels{"id": "1"}),
				},
			},
		},
		{
			name: "single valued A is subset of many valued B, results in many union with Labels of B",
			aResults: Results{
				Values: Values{
					makeSeries("a", data.Labels{"id": "1"}),
				},
			},
			bResults: Results{
				Values: Values{
					makeSeries("b", data.Labels{"id": "1", "fish": "herring"}),
					makeSeries("b", data.Labels{"id": "1", "fish": "red snapper"}),
				},
			},
			unionsAre: assert.EqualValues,
			unions: []*Union{
				{
					Labels: data.Labels{"id": "1", "fish": "herring"},
					A:      makeSeries("a", data.Labels{"id": "1"}),
					B:      makeSeries("b", data.Labels{"id": "1", "fish": "herring"}),
				},
				{
					Labels: data.Labels{"id": "1", "fish": "red snapper"},
					A:      makeSeries("a", data.Labels{"id": "1"}),
					B:      makeSeries("b", data.Labels{"id": "1", "fish": "red snapper"}),
				},
			},
		},
		{
			name: "A with different tags keys lengths to B makes 3 unions (with two unions have matching tags)",
			// Is this the behavior we want? A result within the results will no longer
			// be uniquely identifiable.
			aResults: Results{
				Values: Values{
					makeSeries("a", data.Labels{"id": "1"}),
					makeSeries("aa", data.Labels{"id": "1", "fish": "herring"}),
				},
			},
			bResults: Results{
				Values: Values{
					makeSeries("b", data.Labels{"id": "1", "fish": "herring"}),
					makeSeries("bb", data.Labels{"id": "1", "fish": "red snapper"}),
				},
			},
			unionsAre: assert.EqualValues,
			unions: []*Union{
				{
					Labels: data.Labels{"id": "1", "fish": "herring"},
					A:      makeSeries("a", data.Labels{"id": "1"}),
					B:      makeSeries("b", data.Labels{"id": "1", "fish": "herring"}),
				},
				{
					Labels: data.Labels{"id": "1", "fish": "red snapper"},
					A:      makeSeries("a", data.Labels{"id": "1"}),
					B:      makeSeries("bb", data.Labels{"id": "1", "fish": "red snapper"}),
				},
				{
					Labels: data.Labels{"id": "1", "fish": "herring"},
					A:      makeSeries("aa", data.Labels{"id": "1", "fish": "herring"}),
					B:      makeSeries("b", data.Labels{"id": "1", "fish": "herring"}),
				},
			},
		},
		{
			name: "B with different tags keys lengths to A makes 3 unions (with two unions have matching tags)",
			// Is this the behavior we want? A result within the results will no longer
			// be uniquely identifiable.
			aResults: Results{
				Values: Values{
					makeSeries("b", data.Labels{"id": "1", "fish": "herring"}),
					makeSeries("bb", data.Labels{"id": "1", "fish": "red snapper"}),
				},
			},
			bResults: Results{
				Values: Values{
					makeSeries("a", data.Labels{"id": "1"}),
					makeSeries("aa", data.Labels{"id": "1", "fish": "herring"}),
				},
			},
			unionsAre: assert.EqualValues,
			unions: []*Union{
				{
					Labels: data.Labels{"id": "1", "fish": "herring"},
					A:      makeSeries("b", data.Labels{"id": "1", "fish": "herring"}),
					B:      makeSeries("a", data.Labels{"id": "1"}),
				},
				{
					Labels: data.Labels{"id": "1", "fish": "herring"},
					A:      makeSeries("b", data.Labels{"id": "1", "fish": "herring"}),
					B:      makeSeries("aa", data.Labels{"id": "1", "fish": "herring"}),
				},
				{
					Labels: data.Labels{"id": "1", "fish": "red snapper"},
					A:      makeSeries("bb", data.Labels{"id": "1", "fish": "red snapper"}),
					B:      makeSeries("a", data.Labels{"id": "1"}),
				},
			},
		},
		{
			name: "A is no-data and B is anything makes no-data",
			// Is this the behavior we want? A result within the results will no longer
			// be uniquely identifiable.
			aResults: Results{
				Values: Values{
					NewNoData(),
				},
			},
			bResults: Results{
				Values: Values{
					makeSeries("a", data.Labels{"id": "1"}),
					makeSeries("aa", data.Labels{"id": "1", "fish": "herring"}),
				},
			},
			unionsAre: assert.EqualValues,
			unions: []*Union{
				{
					Labels: nil,
					A:      NewNoData(),
					B:      makeSeries("a", data.Labels{"id": "1"}),
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
