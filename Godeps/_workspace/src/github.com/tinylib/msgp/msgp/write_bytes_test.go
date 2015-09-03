package msgp

import (
	"bytes"
	"math"
	"testing"
	"time"
)

func TestIssue116(t *testing.T) {
	data := AppendInt64(nil, math.MinInt64)
	i, _, err := ReadInt64Bytes(data)
	if err != nil {
		t.Fatal(err)
	}
	if i != math.MinInt64 {
		t.Errorf("put %d in and got %d out", math.MinInt64, i)
	}

	var buf bytes.Buffer

	w := NewWriter(&buf)
	w.WriteInt64(math.MinInt64)
	w.Flush()
	i, err = NewReader(&buf).ReadInt64()
	if err != nil {
		t.Fatal(err)
	}
	if i != math.MinInt64 {
		t.Errorf("put %d in and got %d out", math.MinInt64, i)
	}
}

func TestAppendMapHeader(t *testing.T) {
	szs := []uint32{0, 1, uint32(tint8), uint32(tint16), tuint32}
	var buf bytes.Buffer
	en := NewWriter(&buf)

	var bts []byte
	for _, sz := range szs {
		buf.Reset()
		en.WriteMapHeader(sz)
		en.Flush()
		bts = AppendMapHeader(bts[0:0], sz)

		if !bytes.Equal(buf.Bytes(), bts) {
			t.Errorf("for size %d, encoder wrote %q and append wrote %q", sz, buf.Bytes(), bts)
		}
	}
}

func BenchmarkAppendMapHeader(b *testing.B) {
	buf := make([]byte, 0, 9)
	N := b.N / 4
	b.ReportAllocs()
	b.ResetTimer()
	for i := 0; i < N; i++ {
		AppendMapHeader(buf[:0], 0)
		AppendMapHeader(buf[:0], uint32(tint8))
		AppendMapHeader(buf[:0], tuint16)
		AppendMapHeader(buf[:0], tuint32)
	}
}

func TestAppendArrayHeader(t *testing.T) {
	szs := []uint32{0, 1, uint32(tint8), uint32(tint16), tuint32}
	var buf bytes.Buffer
	en := NewWriter(&buf)

	var bts []byte
	for _, sz := range szs {
		buf.Reset()
		en.WriteArrayHeader(sz)
		en.Flush()
		bts = AppendArrayHeader(bts[0:0], sz)

		if !bytes.Equal(buf.Bytes(), bts) {
			t.Errorf("for size %d, encoder wrote %q and append wrote %q", sz, buf.Bytes(), bts)
		}
	}
}

func BenchmarkAppendArrayHeader(b *testing.B) {
	buf := make([]byte, 0, 9)
	N := b.N / 4
	b.ReportAllocs()
	b.ResetTimer()
	for i := 0; i < N; i++ {
		AppendArrayHeader(buf[:0], 0)
		AppendArrayHeader(buf[:0], uint32(tint8))
		AppendArrayHeader(buf[:0], tuint16)
		AppendArrayHeader(buf[:0], tuint32)
	}
}

func TestAppendNil(t *testing.T) {
	var bts []byte
	bts = AppendNil(bts[0:0])
	if bts[0] != mnil {
		t.Fatal("bts[0] is not 'nil'")
	}
}

func TestAppendFloat64(t *testing.T) {
	f := float64(3.14159)
	var buf bytes.Buffer
	en := NewWriter(&buf)

	var bts []byte
	en.WriteFloat64(f)
	en.Flush()
	bts = AppendFloat64(bts[0:0], f)
	if !bytes.Equal(buf.Bytes(), bts) {
		t.Errorf("for float %f, encoder wrote %q; append wrote %q", f, buf.Bytes(), bts)
	}
}

func BenchmarkAppendFloat64(b *testing.B) {
	f := float64(3.14159)
	buf := make([]byte, 0, 9)
	b.SetBytes(9)
	b.ReportAllocs()
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		AppendFloat64(buf[0:0], f)
	}
}

func TestAppendFloat32(t *testing.T) {
	f := float32(3.14159)
	var buf bytes.Buffer
	en := NewWriter(&buf)

	var bts []byte
	en.WriteFloat32(f)
	en.Flush()
	bts = AppendFloat32(bts[0:0], f)
	if !bytes.Equal(buf.Bytes(), bts) {
		t.Errorf("for float %f, encoder wrote %q; append wrote %q", f, buf.Bytes(), bts)
	}
}

func BenchmarkAppendFloat32(b *testing.B) {
	f := float32(3.14159)
	buf := make([]byte, 0, 5)
	b.SetBytes(5)
	b.ReportAllocs()
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		AppendFloat32(buf[0:0], f)
	}
}

func TestAppendInt64(t *testing.T) {
	is := []int64{0, 1, -5, -50, int64(tint16), int64(tint32), int64(tint64)}
	var buf bytes.Buffer
	en := NewWriter(&buf)

	var bts []byte
	for _, i := range is {
		buf.Reset()
		en.WriteInt64(i)
		en.Flush()
		bts = AppendInt64(bts[0:0], i)
		if !bytes.Equal(buf.Bytes(), bts) {
			t.Errorf("for int64 %d, encoder wrote %q; append wrote %q", i, buf.Bytes(), bts)
		}
	}
}

func BenchmarkAppendInt64(b *testing.B) {
	is := []int64{0, 1, -5, -50, int64(tint16), int64(tint32), int64(tint64)}
	l := len(is)
	buf := make([]byte, 0, 9)
	b.ReportAllocs()
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		AppendInt64(buf[0:0], is[i%l])
	}
}

func TestAppendUint64(t *testing.T) {
	us := []uint64{0, 1, uint64(tuint16), uint64(tuint32), tuint64}
	var buf bytes.Buffer
	en := NewWriter(&buf)
	var bts []byte

	for _, u := range us {
		buf.Reset()
		en.WriteUint64(u)
		en.Flush()
		bts = AppendUint64(bts[0:0], u)
		if !bytes.Equal(buf.Bytes(), bts) {
			t.Errorf("for uint64 %d, encoder wrote %q; append wrote %q", u, buf.Bytes(), bts)
		}
	}
}

func BenchmarkAppendUint64(b *testing.B) {
	us := []uint64{0, 1, 15, uint64(tuint16), uint64(tuint32), tuint64}
	buf := make([]byte, 0, 9)
	b.ReportAllocs()
	b.ResetTimer()
	l := len(us)
	for i := 0; i < b.N; i++ {
		AppendUint64(buf[0:0], us[i%l])
	}
}

func TestAppendBytes(t *testing.T) {
	sizes := []int{0, 1, 225, int(tuint32)}
	var buf bytes.Buffer
	en := NewWriter(&buf)
	var bts []byte

	for _, sz := range sizes {
		buf.Reset()
		b := RandBytes(sz)
		en.WriteBytes(b)
		en.Flush()
		bts = AppendBytes(b[0:0], b)
		if !bytes.Equal(buf.Bytes(), bts) {
			t.Errorf("for bytes of length %d, encoder wrote %d bytes and append wrote %d bytes", sz, buf.Len(), len(bts))
		}
	}
}

func benchappendBytes(size uint32, b *testing.B) {
	bts := RandBytes(int(size))
	buf := make([]byte, 0, len(bts)+5)
	b.SetBytes(int64(len(bts) + 5))
	b.ReportAllocs()
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		AppendBytes(buf[0:0], bts)
	}
}

func BenchmarkAppend16Bytes(b *testing.B) { benchappendBytes(16, b) }

func BenchmarkAppend256Bytes(b *testing.B) { benchappendBytes(256, b) }

func BenchmarkAppend2048Bytes(b *testing.B) { benchappendBytes(2048, b) }

func TestAppendString(t *testing.T) {
	sizes := []int{0, 1, 225, int(tuint32)}
	var buf bytes.Buffer
	en := NewWriter(&buf)
	var bts []byte

	for _, sz := range sizes {
		buf.Reset()
		s := string(RandBytes(sz))
		en.WriteString(s)
		en.Flush()
		bts = AppendString(bts[0:0], s)
		if !bytes.Equal(buf.Bytes(), bts) {
			t.Errorf("for string of length %d, encoder wrote %d bytes and append wrote %d bytes", sz, buf.Len(), len(bts))
			t.Errorf("WriteString prefix: %x", buf.Bytes()[0:5])
			t.Errorf("Appendstring prefix: %x", bts[0:5])
		}
	}
}

func benchappendString(size uint32, b *testing.B) {
	str := string(RandBytes(int(size)))
	buf := make([]byte, 0, len(str)+5)
	b.SetBytes(int64(len(str) + 5))
	b.ReportAllocs()
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		AppendString(buf[0:0], str)
	}
}

func BenchmarkAppend16String(b *testing.B) { benchappendString(16, b) }

func BenchmarkAppend256String(b *testing.B) { benchappendString(256, b) }

func BenchmarkAppend2048String(b *testing.B) { benchappendString(2048, b) }

func TestAppendBool(t *testing.T) {
	vs := []bool{true, false}
	var buf bytes.Buffer
	en := NewWriter(&buf)
	var bts []byte

	for _, v := range vs {
		buf.Reset()
		en.WriteBool(v)
		en.Flush()
		bts = AppendBool(bts[0:0], v)
		if !bytes.Equal(buf.Bytes(), bts) {
			t.Errorf("for %t, encoder wrote %q and append wrote %q", v, buf.Bytes(), bts)
		}
	}
}

func BenchmarkAppendBool(b *testing.B) {
	vs := []bool{true, false}
	buf := make([]byte, 0, 1)
	b.SetBytes(1)
	b.ReportAllocs()
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		AppendBool(buf[0:0], vs[i%2])
	}
}

func BenchmarkAppendTime(b *testing.B) {
	t := time.Now()
	b.SetBytes(15)
	buf := make([]byte, 0, 15)
	b.ReportAllocs()
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		AppendTime(buf[0:0], t)
	}
}
