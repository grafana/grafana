package pq

import "testing"

func Benchmark_writeBuf_string(b *testing.B) {
	var buf writeBuf
	const s = "foo"

	b.ReportAllocs()
	b.ResetTimer()

	for i := 0; i < b.N; i++ {
		buf.string(s)
		buf.buf = buf.buf[:0]
	}
}
