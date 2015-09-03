package msgp

import (
	"testing"
)

func BenchmarkReadWriteFloat32(b *testing.B) {
	var f float32 = 3.9081
	bts := AppendFloat32([]byte{}, f)
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		bts = AppendFloat32(bts[0:0], f)
		f, bts, _ = ReadFloat32Bytes(bts)
	}
}

func BenchmarkReadWriteFloat64(b *testing.B) {
	var f float64 = 3.9081
	bts := AppendFloat64([]byte{}, f)
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		bts = AppendFloat64(bts[0:0], f)
		f, bts, _ = ReadFloat64Bytes(bts)
	}
}
