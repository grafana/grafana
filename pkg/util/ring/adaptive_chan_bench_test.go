package ring

import (
	"context"
	"testing"
)

func BenchmarkAdaptiveChanBaseline(b *testing.B) {
	in, out, _ := AdaptiveChan[int]()
	in <- 1
	<-out
	b.Cleanup(func() {
		close(in)
	})

	b.ResetTimer()
	b.ReportAllocs()

	for i := 0; i < b.N; i++ {
		in <- i
		val := <-out
		if val != i {
			b.Fatalf("expected 1, got %d", val)
		}
	}
}

func BenchmarkAdaptiveChanWithStatsRead(b *testing.B) {
	var stats AdaptiveChanStats
	in, out, sr := AdaptiveChan[int]()
	in <- 1
	<-out
	ctx := context.Background()
	b.Cleanup(func() {
		close(in)
	})

	b.ResetTimer()
	b.ReportAllocs()

	for i := 0; i < b.N; i++ {
		in <- 1
		val := <-out
		if val != 1 {
			b.Fatalf("expected 1, got %d", val)
		}
		err := sr.WriteStats(ctx, &stats)
		if err != nil {
			b.Fatalf("unexpected error: %v", err)
		}
		if stats.Enqueued == 0 {
			b.Fatalf("unexpected stats: %v", stats)
		}
	}
}

func BenchmarkGoChanBaseline(b *testing.B) {
	c := make(chan int, 1)
	b.Cleanup(func() {
		close(c)
	})

	b.ResetTimer()
	b.ReportAllocs()

	for i := 0; i < b.N; i++ {
		c <- 1
		val := <-c
		if val != 1 {
			b.Fatalf("expected 1, got %d", val)
		}
	}
}
