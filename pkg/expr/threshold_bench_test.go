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
			_, _ = greater.Execute(ctx, timeNow, vars, trace, nil)
		}
	})
	b.Run("less than", func(b *testing.B) {
		greater, err := NewThresholdCommand("B", "A", ThresholdIsAbove, []float64{500})
		if err != nil {
			b.Fatalf("error: %s", err)
		}
		b.ResetTimer()
		for i := 0; i < b.N; i++ {
			_, _ = greater.Execute(ctx, timeNow, vars, trace, nil)
		}
	})
	b.Run("within range", func(b *testing.B) {
		greater, err := NewThresholdCommand("B", "A", ThresholdIsWithinRange, []float64{400.0, 600.0})
		if err != nil {
			b.Fatalf("error: %s", err)
		}
		b.ResetTimer()
		for i := 0; i < b.N; i++ {
			_, _ = greater.Execute(ctx, timeNow, vars, trace, nil)
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
			_, _ = greater.Execute(ctx, timeNow, vars, trace, nil)
		}
	})
	b.Run("outside range", func(b *testing.B) {
		greater, err := NewThresholdCommand("B", "A", ThresholdIsOutsideRange, []float64{400.0, 600.0})
		if err != nil {
			b.Fatalf("error: %s", err)
		}
		b.ResetTimer()
		for i := 0; i < b.N; i++ {
			_, _ = greater.Execute(ctx, timeNow, vars, trace, nil)
		}
	})
}
