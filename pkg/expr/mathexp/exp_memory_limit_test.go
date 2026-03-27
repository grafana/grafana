package mathexp

import (
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestComputeResultStats(t *testing.T) {
	tests := []struct {
		name     string
		results  Results
		expected resultStats
	}{
		{
			name:     "empty results",
			results:  Results{},
			expected: resultStats{},
		},
		{
			name: "single number with labels",
			results: Results{
				Values: Values{
					makeNumber("n", data.Labels{"service": "web", "region": "us-east-1"}, float64Pointer(42)),
				},
			},
			expected: resultStats{
				count:         1,
				seriesCount:   0,
				maxDatapoints: 0,
				maxLabelBytes: len("service") + len("web") + len("region") + len("us-east-1"),
			},
		},
		{
			name: "two series with different lengths and labels",
			results: Results{
				Values: Values{
					makeSeries("a", data.Labels{"id": "1"},
						tp{time.Unix(1, 0), float64Pointer(1)},
						tp{time.Unix(2, 0), float64Pointer(2)},
					),
					makeSeries("b", data.Labels{"id": "1", "env": "production"},
						tp{time.Unix(1, 0), float64Pointer(3)},
						tp{time.Unix(2, 0), float64Pointer(4)},
						tp{time.Unix(3, 0), float64Pointer(5)},
					),
				},
			},
			expected: resultStats{
				count:         2,
				seriesCount:   2,
				maxDatapoints: 3,
				maxLabelBytes: len("id") + len("1") + len("env") + len("production"),
			},
		},
		{
			name: "mix of series and numbers",
			results: Results{
				Values: Values{
					makeSeries("s", data.Labels{"x": "y"},
						tp{time.Unix(1, 0), float64Pointer(1)},
					),
					makeNumber("n", data.Labels{"a": "longer-value"}, float64Pointer(10)),
				},
			},
			expected: resultStats{
				count:         2,
				seriesCount:   1,
				maxDatapoints: 1,
				maxLabelBytes: len("a") + len("longer-value"),
			},
		},
		{
			name: "NoData values have zero labels and zero datapoints",
			results: Results{
				Values: Values{
					NewNoData(),
					makeSeries("s", data.Labels{"id": "1"},
						tp{time.Unix(1, 0), float64Pointer(1)},
					),
				},
			},
			expected: resultStats{
				count:         2,
				seriesCount:   1,
				maxDatapoints: 1,
				maxLabelBytes: len("id") + len("1"),
			},
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := computeResultStats(tc.results)
			assert.Equal(t, tc.expected, got)
		})
	}
}

func TestEstimateBinaryOutputBytes(t *testing.T) {
	tests := []struct {
		name     string
		a        resultStats
		b        resultStats
		expected int64
	}{
		{
			name:     "empty A returns zero",
			a:        resultStats{count: 0},
			b:        resultStats{count: 10, seriesCount: 10, maxDatapoints: 100},
			expected: 0,
		},
		{
			name:     "empty B returns zero",
			a:        resultStats{count: 10, seriesCount: 10, maxDatapoints: 100},
			b:        resultStats{count: 0},
			expected: 0,
		},
		{
			name: "number x number uses only labels and overhead",
			a:    resultStats{count: 5, seriesCount: 0, maxDatapoints: 0, maxLabelBytes: 100},
			b:    resultStats{count: 5, seriesCount: 0, maxDatapoints: 0, maxLabelBytes: 200},
			// 25 unions * (0 + 200 + 500) = 17,500
			expected: 25 * (200 + frameOverhead),
		},
		{
			name: "series x series includes bPoints cost",
			a:    resultStats{count: 10, seriesCount: 10, maxDatapoints: 300, maxLabelBytes: 200},
			b:    resultStats{count: 10, seriesCount: 10, maxDatapoints: 300, maxLabelBytes: 200},
			// 100 unions * (300*bytesPerDatapoint + 200 + frameOverhead + 300*bytesPerBPoint)
			expected: 100 * (300*bytesPerDatapoint + 200 + frameOverhead + 300*bytesPerBPoint),
		},
		{
			name: "series x number omits bPoints cost",
			a:    resultStats{count: 10, seriesCount: 10, maxDatapoints: 300, maxLabelBytes: 200},
			b:    resultStats{count: 1, seriesCount: 0, maxDatapoints: 0, maxLabelBytes: 50},
			// 10 unions * (300*bytesPerDatapoint + 200 + frameOverhead), no bPoints since b has no series
			expected: 10 * (300*bytesPerDatapoint + 200 + frameOverhead),
		},
		{
			name: "asymmetric series uses max datapoints from either side",
			a:    resultStats{count: 2, seriesCount: 2, maxDatapoints: 100, maxLabelBytes: 50},
			b:    resultStats{count: 3, seriesCount: 3, maxDatapoints: 500, maxLabelBytes: 50},
			// 6 unions * (500*bytesPerDatapoint + 50 + frameOverhead + 500*bytesPerBPoint)
			expected: 6 * (500*bytesPerDatapoint + 50 + frameOverhead + 500*bytesPerBPoint),
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := estimateBinaryOutputBytes(tc.a, tc.b)
			assert.Equal(t, tc.expected, got)
		})
	}
}

func TestWalkBinary_memory_limit_blocks_cartesian_explosion(t *testing.T) {
	// Build two sets of 100 series each with non-matching labels.
	// This creates a worst-case cartesian product of 10,000 unions.
	aValues := make(Values, 100)
	bValues := make(Values, 100)
	for i := 0; i < 100; i++ {
		aValues[i] = makeSeries("a", data.Labels{"a_id": string(rune('A'+i%26)) + string(rune('0'+i/26))},
			tp{time.Unix(1, 0), float64Pointer(1)},
			tp{time.Unix(2, 0), float64Pointer(2)},
			tp{time.Unix(3, 0), float64Pointer(3)},
		)
		bValues[i] = makeSeries("b", data.Labels{"b_id": string(rune('A'+i%26)) + string(rune('0'+i/26))},
			tp{time.Unix(1, 0), float64Pointer(10)},
			tp{time.Unix(2, 0), float64Pointer(20)},
			tp{time.Unix(3, 0), float64Pointer(30)},
		)
	}

	vars := Vars{
		"A": Results{Values: aValues},
		"B": Results{Values: bValues},
	}

	e, err := New("$A + $B")
	require.NoError(t, err)

	// With a very small limit, the cartesian product should be rejected.
	_, err = e.Execute("", vars, tracing.InitializeTracerForTest(), WithMemoryLimit(1024))
	require.Error(t, err)
	assert.Contains(t, err.Error(), "100 series from $A")
	assert.Contains(t, err.Error(), "100 series from $B")
	assert.Contains(t, err.Error(), "10000 series pairs")
}

func TestWalkBinary_memory_limit_allows_matched_labels(t *testing.T) {
	// Build two sets of 100 series with matching labels.
	// This produces exactly 100 unions (1:1), which should be well within limits.
	aValues := make(Values, 100)
	bValues := make(Values, 100)
	for i := 0; i < 100; i++ {
		label := data.Labels{"id": string(rune('A'+i%26)) + string(rune('0'+i/26))}
		aValues[i] = makeSeries("a", label,
			tp{time.Unix(1, 0), float64Pointer(float64(i))},
			tp{time.Unix(2, 0), float64Pointer(float64(i * 2))},
		)
		bValues[i] = makeSeries("b", label,
			tp{time.Unix(1, 0), float64Pointer(1)},
			tp{time.Unix(2, 0), float64Pointer(2)},
		)
	}

	vars := Vars{
		"A": Results{Values: aValues},
		"B": Results{Values: bValues},
	}

	e, err := New("$A + $B")
	require.NoError(t, err)

	// The estimate is worst-case (10,000 unions) but the actual matching
	// produces only 100. Derive the limit from the estimation function
	// so this test is resilient to constant changes.
	aStats := computeResultStats(vars["A"])
	bStats := computeResultStats(vars["B"])
	estimated := estimateBinaryOutputBytes(aStats, bStats)

	// Set limit exactly at the worst-case estimate: should pass.
	_, err = e.Execute("", vars, tracing.InitializeTracerForTest(), WithMemoryLimit(estimated))
	require.NoError(t, err)
}

func TestWalkBinary_memory_limit_zero_disables_check(t *testing.T) {
	// Even a cartesian product should proceed when limit is 0.
	vars := Vars{
		"A": Results{Values: Values{
			makeSeries("a", data.Labels{"a_id": "1"}, tp{time.Unix(1, 0), float64Pointer(1)}),
			makeSeries("a", data.Labels{"a_id": "2"}, tp{time.Unix(1, 0), float64Pointer(2)}),
		}},
		"B": Results{Values: Values{
			makeSeries("b", data.Labels{"b_id": "1"}, tp{time.Unix(1, 0), float64Pointer(10)}),
			makeSeries("b", data.Labels{"b_id": "2"}, tp{time.Unix(1, 0), float64Pointer(20)}),
		}},
	}

	e, err := New("$A + $B")
	require.NoError(t, err)

	// Limit of 0 means no limit.
	_, err = e.Execute("", vars, tracing.InitializeTracerForTest(), WithMemoryLimit(0))
	require.NoError(t, err)
}

func TestWalkBinary_memory_limit_not_applied_without_option(t *testing.T) {
	// Without WithMemoryLimit, even small cartesian products should work.
	vars := Vars{
		"A": Results{Values: Values{
			makeSeries("a", data.Labels{"a_id": "1"}, tp{time.Unix(1, 0), float64Pointer(1)}),
		}},
		"B": Results{Values: Values{
			makeSeries("b", data.Labels{"b_id": "1"}, tp{time.Unix(1, 0), float64Pointer(10)}),
		}},
	}

	e, err := New("$A + $B")
	require.NoError(t, err)

	// No WithMemoryLimit option: MemoryLimit defaults to 0 (disabled).
	_, err = e.Execute("", vars, tracing.InitializeTracerForTest())
	require.NoError(t, err)
}

func TestFormatBytes(t *testing.T) {
	tests := []struct {
		name     string
		input    int64
		expected string
	}{
		{"bytes", 512, "512 B"},
		{"kibibytes", 1536, "1.5 KiB"},
		{"mebibytes", 5 << 20, "5.0 MiB"},
		{"gibibytes", 1 << 30, "1.0 GiB"},
		{"fractional gibibytes", 3 * (1 << 30) / 2, "1.5 GiB"},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			assert.Equal(t, tc.expected, formatBytes(tc.input))
		})
	}
}

func TestLabelBytes(t *testing.T) {
	tests := []struct {
		name     string
		labels   data.Labels
		expected int
	}{
		{"nil labels", nil, 0},
		{"empty labels", data.Labels{}, 0},
		{"single pair", data.Labels{"key": "value"}, 8},
		{"multiple pairs", data.Labels{"service": "web", "region": "us-east-1"}, 7 + 3 + 6 + 9},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			assert.Equal(t, tc.expected, labelBytes(tc.labels))
		})
	}
}
