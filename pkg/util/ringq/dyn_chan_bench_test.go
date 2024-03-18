package ringq

import (
	"context"
	"testing"
)

func BenchmarkDynChanBaseline(b *testing.B) {
	in, out, _ := DynChan[int](1)
	in <- 1
	<-out
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
	}
}

func BenchmarkDynChanWithStatsRead(b *testing.B) {
	in, out, sr := DynChan[int](1)
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
		s, err := sr.ReadStats(ctx)
		if err != nil {
			b.Fatalf("unexpected error: %v", err)
		}
		if s.Enqueued == 0 {
			b.Fatalf("unexpected stats: %v", s)
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
