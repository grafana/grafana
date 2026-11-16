package filter

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestValueCount(t *testing.T) {
	cases := []struct {
		raw  string
		want int
	}{
		{`{"a":"x"}`, 0},
		{`{"a":{"$in":[1,2,3]}}`, 3},
		{`{"a":{"$nin":["x","y"]}}`, 2},
		{`{"$or":[{"a":{"$in":[1,2]}},{"b":{"$in":[3,4,5]}}]}`, 5},
		{`{"$and":[{"a":{"$gt":1}},{"b":{"$exists":true}}]}`, 0},
	}
	for _, tc := range cases {
		f, err := Parse(json.RawMessage(tc.raw))
		require.NoError(t, err)
		require.Equal(t, tc.want, ValueCount(f), tc.raw)
	}
	require.Equal(t, 0, ValueCount(nil))
}
