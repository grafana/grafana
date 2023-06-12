package accesscontrol

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestBatch(t *testing.T) {
	type testCase struct {
		desc      string
		batchSize int
		count     int
	}

	testCases := []testCase{
		{desc: "empty", batchSize: 1, count: 0},
		{desc: "1 run of 5", batchSize: 5, count: 5},
		{desc: "10 runs of 5", batchSize: 5, count: 50},
		{desc: "unmatching end", batchSize: 10, count: 25},
		{desc: "batch bigger than count", batchSize: 500, count: 25},
	}

	for _, tc := range testCases {
		t.Run(tc.desc, func(t *testing.T) {
			items := make([]int, tc.count)
			sum := 0

			got := batch(len(items), tc.batchSize, func(start int, end int) error {
				chunk := items[start:end]
				for range chunk {
					sum += 1
				}

				return nil
			})

			require.NoError(t, got)
			require.Equal(t, tc.count, sum)
		})
	}
}
