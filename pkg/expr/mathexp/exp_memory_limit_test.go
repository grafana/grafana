package mathexp

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/infra/tracing"
)

func TestEstimateBinaryMemory(t *testing.T) {
	tests := []struct {
		name          string
		a             Results
		b             Results
		expectUnions  int
		expectNonZero bool // true if bytes should be > 0
	}{
		{
			name:         "empty A returns zero",
			a:            Results{},
			b:            Results{Values: Values{makeSeries("b", data.Labels{"id": "1"})}},
			expectUnions: 0,
		},
		{
			name: "matching labels produce 1:1 unions",
			a: Results{Values: Values{
				makeSeries("a", data.Labels{"id": "1"}, tp{time.Unix(1, 0), float64Pointer(1)}),
				makeSeries("a", data.Labels{"id": "2"}, tp{time.Unix(1, 0), float64Pointer(2)}),
			}},
			b: Results{Values: Values{
				makeSeries("b", data.Labels{"id": "1"}, tp{time.Unix(1, 0), float64Pointer(10)}),
				makeSeries("b", data.Labels{"id": "2"}, tp{time.Unix(1, 0), float64Pointer(20)}),
			}},
			expectUnions:  2,
			expectNonZero: true,
		},
		{
			name: "non-matching labels of same length produce zero unions",
			a: Results{Values: Values{
				makeSeries("a", data.Labels{"a_id": "1"}),
				makeSeries("a", data.Labels{"a_id": "2"}),
			}},
			b: Results{Values: Values{
				makeSeries("b", data.Labels{"b_id": "1"}),
				makeSeries("b", data.Labels{"b_id": "2"}),
			}},
			expectUnions: 0,
		},
		{
			name: "empty labels on one side produce cartesian product",
			a: Results{Values: Values{
				makeSeries("a", data.Labels{}, tp{time.Unix(1, 0), float64Pointer(1)}),
				makeSeries("a", data.Labels{}, tp{time.Unix(1, 0), float64Pointer(2)}),
			}},
			b: Results{Values: Values{
				makeSeries("b", data.Labels{"id": "1"}, tp{time.Unix(1, 0), float64Pointer(10)}),
				makeSeries("b", data.Labels{"id": "2"}, tp{time.Unix(1, 0), float64Pointer(20)}),
			}},
			expectUnions:  4,
			expectNonZero: true,
		},
		{
			name: "subset labels produce fan-out",
			a: Results{Values: Values{
				makeSeries("a", data.Labels{"service": "web", "endpoint": "/api"}, tp{time.Unix(1, 0), float64Pointer(1)}),
				makeSeries("a", data.Labels{"service": "web", "endpoint": "/health"}, tp{time.Unix(1, 0), float64Pointer(2)}),
			}},
			b: Results{Values: Values{
				makeSeries("b", data.Labels{"service": "web"}, tp{time.Unix(1, 0), float64Pointer(10)}),
			}},
			expectUnions:  2,
			expectNonZero: true,
		},
		{
			name: "single non-matching values fall back to 1 union",
			a: Results{Values: Values{
				makeSeries("a", data.Labels{"id": "1"}, tp{time.Unix(1, 0), float64Pointer(1)}),
			}},
			b: Results{Values: Values{
				makeSeries("b", data.Labels{"id": "2"}, tp{time.Unix(1, 0), float64Pointer(10)}),
			}},
			expectUnions:  1,
			expectNonZero: true,
		},
		{
			name: "NoData on one side produces 1 union",
			a:    Results{Values: Values{NewNoData()}},
			b: Results{Values: Values{
				makeSeries("b", data.Labels{"id": "1"}, tp{time.Unix(1, 0), float64Pointer(10)}),
			}},
			expectUnions:  1,
			expectNonZero: true,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			est := estimateBinaryMemory(tc.a, tc.b)
			assert.Equal(t, tc.expectUnions, est.unions)
			assert.Equal(t, len(tc.a.Values), est.aCount)
			assert.Equal(t, len(tc.b.Values), est.bCount)
			if tc.expectNonZero {
				assert.Greater(t, est.bytes, int64(0))
			} else {
				assert.Equal(t, int64(0), est.bytes)
			}
		})
	}
}

func TestEstimateBinaryMemory_per_pair_cost_reflects_actual_sizes(t *testing.T) {
	// Two matching series with different lengths. The estimate should use each
	// pair's actual sizes, not a global max.
	shortSeries := makeSeries("a", data.Labels{"id": "1"},
		tp{time.Unix(1, 0), float64Pointer(1)},
	)
	longSeries := makeSeries("a", data.Labels{"id": "2"},
		tp{time.Unix(1, 0), float64Pointer(1)},
		tp{time.Unix(2, 0), float64Pointer(2)},
		tp{time.Unix(3, 0), float64Pointer(3)},
		tp{time.Unix(4, 0), float64Pointer(4)},
		tp{time.Unix(5, 0), float64Pointer(5)},
	)

	a := Results{Values: Values{shortSeries, longSeries}}
	b := Results{Values: Values{
		makeSeries("b", data.Labels{"id": "1"}, tp{time.Unix(1, 0), float64Pointer(10)}),
		makeSeries("b", data.Labels{"id": "2"},
			tp{time.Unix(1, 0), float64Pointer(10)},
			tp{time.Unix(2, 0), float64Pointer(20)},
			tp{time.Unix(3, 0), float64Pointer(30)},
			tp{time.Unix(4, 0), float64Pointer(40)},
			tp{time.Unix(5, 0), float64Pointer(50)},
		),
	}}

	est := estimateBinaryMemory(a, b)
	assert.Equal(t, 2, est.unions)

	// Compute expected cost per pair:
	lb := labelBytes(data.Labels{"id": "1"})
	// Pair 1: short(1 dp) x short(1 dp), Pair 2: long(5 dp) x long(5 dp)
	pair1 := int64(1)*bytesPerDatapoint + int64(lb) + frameOverhead + int64(1)*bytesPerBPoint
	pair2 := int64(5)*bytesPerDatapoint + int64(lb) + frameOverhead + int64(5)*bytesPerBPoint
	assert.Equal(t, pair1+pair2, est.bytes)
}

func TestWalkBinary_memory_limit_blocks_cartesian_explosion(t *testing.T) {
	// Build two sets of 100 series with empty labels on both sides.
	// Empty labels match everything, producing a true 10,000-pair cartesian product.
	aValues := make(Values, 100)
	bValues := make(Values, 100)
	for i := range 100 {
		aValues[i] = makeSeries("a", data.Labels{},
			tp{time.Unix(1, 0), float64Pointer(1)},
			tp{time.Unix(2, 0), float64Pointer(2)},
			tp{time.Unix(3, 0), float64Pointer(3)},
		)
		bValues[i] = makeSeries("b", data.Labels{},
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
	for i := range 100 {
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

	// Derive the limit from the estimation so this test is resilient to
	// constant changes. With real union counting, the estimate reflects the
	// actual 100 pairs, not the worst-case 10,000.
	est := estimateBinaryMemory(vars["A"], vars["B"])
	assert.Equal(t, 100, est.unions)

	// Set limit exactly at the estimate: should pass.
	_, err = e.Execute("", vars, tracing.InitializeTracerForTest(), WithMemoryLimit(est.bytes))
	require.NoError(t, err)
}

func TestWalkBinary_memory_limit_zero_disables_check(t *testing.T) {
	// Even a cartesian product should proceed when limit is 0.
	vars := Vars{
		"A": Results{Values: Values{
			makeSeries("a", data.Labels{}, tp{time.Unix(1, 0), float64Pointer(1)}),
			makeSeries("a", data.Labels{}, tp{time.Unix(1, 0), float64Pointer(2)}),
		}},
		"B": Results{Values: Values{
			makeSeries("b", data.Labels{}, tp{time.Unix(1, 0), float64Pointer(10)}),
			makeSeries("b", data.Labels{}, tp{time.Unix(1, 0), float64Pointer(20)}),
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
			makeSeries("a", data.Labels{}, tp{time.Unix(1, 0), float64Pointer(1)}),
		}},
		"B": Results{Values: Values{
			makeSeries("b", data.Labels{}, tp{time.Unix(1, 0), float64Pointer(10)}),
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
