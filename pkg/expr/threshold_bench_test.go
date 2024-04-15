package expr

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"

	"github.com/grafana/grafana/pkg/expr/mathexp"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/util"
)

func BenchmarkThreshold(b *testing.B) {
	results := make(mathexp.Values, 0, 1000)
	for i := 0; i < cap(results); i++ {
		n := newNumber(data.Labels{"test": fmt.Sprintf("series-%d", i)}, util.Pointer(float64(i)))
		results = append(results, n)
	}
	ctx := context.Background()
	timeNow := time.Now()
	vars := mathexp.Vars{
		"A": newResults(results...),
	}
	trace := tracing.InitializeTracerForTest()
	b.ResetTimer()
	b.Run("greater than", func(b *testing.B) {
		greater, err := NewThresholdCommand("B", "A", ThresholdIsAbove, []float64{500})
		if err != nil {
			b.Fatalf("error: %s", err)
		}
		b.ResetTimer()
		for i := 0; i < b.N; i++ {
			_, _ = greater.Execute(ctx, timeNow, vars, trace)
		}
	})
	b.Run("less than", func(b *testing.B) {
		greater, err := NewThresholdCommand("B", "A", ThresholdIsAbove, []float64{500})
		if err != nil {
			b.Fatalf("error: %s", err)
		}
		b.ResetTimer()
		for i := 0; i < b.N; i++ {
			_, _ = greater.Execute(ctx, timeNow, vars, trace)
		}
	})
	b.Run("within range", func(b *testing.B) {
		greater, err := NewThresholdCommand("B", "A", ThresholdIsWithinRange, []float64{400.0, 600.0})
		if err != nil {
			b.Fatalf("error: %s", err)
		}
		b.ResetTimer()
		for i := 0; i < b.N; i++ {
			_, _ = greater.Execute(ctx, timeNow, vars, trace)
		}
	})
	b.Run("within range, no labels", func(b *testing.B) {
		greater, err := NewThresholdCommand("B", "A", ThresholdIsWithinRange, []float64{400.0, 600.0})
		if err != nil {
			b.Fatalf("error: %s", err)
		}

		results := make(mathexp.Values, 0, 1000)
		for i := 0; i < cap(results); i++ {
			n := newNumber(nil, util.Pointer(float64(i)))
			results = append(results, n)
		}
		vars := mathexp.Vars{
			"A": newResults(results...),
		}
		b.ResetTimer()
		for i := 0; i < b.N; i++ {
			_, _ = greater.Execute(ctx, timeNow, vars, trace)
		}
	})
	b.Run("outside range", func(b *testing.B) {
		greater, err := NewThresholdCommand("B", "A", ThresholdIsOutsideRange, []float64{400.0, 600.0})
		if err != nil {
			b.Fatalf("error: %s", err)
		}
		b.ResetTimer()
		for i := 0; i < b.N; i++ {
			_, _ = greater.Execute(ctx, timeNow, vars, trace)
		}
	})
}

/*
goos: windows
goarch: amd64
pkg: github.com/grafana/grafana/pkg/expr
cpu: 11th Gen Intel(R) Core(TM) i9-11900H @ 2.50GHz
BenchmarkThreshold
BenchmarkThreshold/greater_than
BenchmarkThreshold/greater_than-16         	    3624	    319428 ns/op	  560673 B/op	   10061 allocs/op
BenchmarkThreshold/less_than
BenchmarkThreshold/less_than-16            	    3787	    313414 ns/op	  561320 B/op	   10060 allocs/op
BenchmarkThreshold/within_range
BenchmarkThreshold/within_range-16         	      37	  31990481 ns/op	 1674032 B/op	   30134 allocs/op
BenchmarkThreshold/within_range,_no_labels
BenchmarkThreshold/within_range,_no_labels-16         	       3	 384440567 ns/op	610835274 B/op	10020193 allocs/op
BenchmarkThreshold/outside_range
BenchmarkThreshold/outside_range-16                   	      37	  32272343 ns/op	 1679473 B/op	   30135 allocs/op
PASS
*/
