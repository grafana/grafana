package msgp

import (
	"bytes"
	"io"
	"math"
	"math/rand"
	"reflect"
	"testing"
	"time"
)

func TestSanity(t *testing.T) {
	if !isfixint(0) {
		t.Fatal("WUT.")
	}
}

func TestReadIntf(t *testing.T) {
	// NOTE: if you include cases
	// with, say, int32s, the test
	// will fail, b/c integers are
	// always read out as int64, and
	// unsigned integers as uint64

	var testCases = []interface{}{
		float64(128.032),
		float32(9082.092),
		int64(-40),
		uint64(9082981),
		time.Now(),
		"hello!",
		[]byte("hello!"),
		map[string]interface{}{
			"thing-1": "thing-1-value",
			"thing-2": int64(800),
			"thing-3": []byte("some inner bytes..."),
			"thing-4": false,
		},
	}

	var buf bytes.Buffer
	var v interface{}
	dec := NewReader(&buf)
	enc := NewWriter(&buf)

	for i, ts := range testCases {
		buf.Reset()
		err := enc.WriteIntf(ts)
		if err != nil {
			t.Errorf("Test case %d: %s", i, err)
			continue
		}
		err = enc.Flush()
		if err != nil {
			t.Fatal(err)
		}
		v, err = dec.ReadIntf()
		if err != nil {
			t.Errorf("Test case: %d: %s", i, err)
		}
		if !reflect.DeepEqual(v, ts) {
			t.Errorf("%v in; %v out", ts, v)
		}
	}

}

func TestReadMapHeader(t *testing.T) {
	tests := []struct {
		Sz uint32
	}{
		{0},
		{1},
		{tuint16},
		{tuint32},
	}

	var buf bytes.Buffer
	var sz uint32
	var err error
	wr := NewWriter(&buf)
	rd := NewReader(&buf)
	for i, test := range tests {
		buf.Reset()
		err = wr.WriteMapHeader(test.Sz)
		if err != nil {
			t.Fatal(err)
		}
		err = wr.Flush()
		if err != nil {
			t.Fatal(err)
		}
		sz, err = rd.ReadMapHeader()
		if err != nil {
			t.Errorf("Test case %d: got error %s", i, err)
		}
		if sz != test.Sz {
			t.Errorf("Test case %d: wrote size %d; got size %d", i, test.Sz, sz)
		}
	}
}

func BenchmarkReadMapHeader(b *testing.B) {
	sizes := []uint32{0, 1, tuint16, tuint32}
	data := make([]byte, 0, len(sizes)*5)
	for _, d := range sizes {
		data = AppendMapHeader(data, d)
	}
	rd := NewReader(NewEndlessReader(data, b))
	b.SetBytes(int64(len(data) / len(sizes)))
	b.ReportAllocs()
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		rd.ReadMapHeader()
	}
}

func TestReadArrayHeader(t *testing.T) {
	tests := []struct {
		Sz uint32
	}{
		{0},
		{1},
		{tuint16},
		{tuint32},
	}

	var buf bytes.Buffer
	var sz uint32
	var err error
	wr := NewWriter(&buf)
	rd := NewReader(&buf)
	for i, test := range tests {
		buf.Reset()
		err = wr.WriteArrayHeader(test.Sz)
		if err != nil {
			t.Fatal(err)
		}
		err = wr.Flush()
		if err != nil {
			t.Fatal(err)
		}
		sz, err = rd.ReadArrayHeader()
		if err != nil {
			t.Errorf("Test case %d: got error %s", i, err)
		}
		if sz != test.Sz {
			t.Errorf("Test case %d: wrote size %d; got size %d", i, test.Sz, sz)
		}
	}
}

func BenchmarkReadArrayHeader(b *testing.B) {
	sizes := []uint32{0, 1, tuint16, tuint32}
	data := make([]byte, 0, len(sizes)*5)
	for _, d := range sizes {
		data = AppendArrayHeader(data, d)
	}
	rd := NewReader(NewEndlessReader(data, b))
	b.ReportAllocs()
	b.SetBytes(int64(len(data) / len(sizes)))
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		rd.ReadArrayHeader()
	}
}

func TestReadNil(t *testing.T) {
	var buf bytes.Buffer
	wr := NewWriter(&buf)
	rd := NewReader(&buf)

	wr.WriteNil()
	wr.Flush()
	err := rd.ReadNil()
	if err != nil {
		t.Fatal(err)
	}
}

func BenchmarkReadNil(b *testing.B) {
	data := AppendNil(nil)
	rd := NewReader(NewEndlessReader(data, b))
	b.ReportAllocs()
	b.SetBytes(1)
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		err := rd.ReadNil()
		if err != nil {
			b.Fatal(err)
		}
	}
}

func TestReadFloat64(t *testing.T) {
	var buf bytes.Buffer
	wr := NewWriter(&buf)
	rd := NewReader(&buf)

	for i := 0; i < 100; i++ {
		buf.Reset()

		flt := (rand.Float64() - 0.5) * math.MaxFloat64
		err := wr.WriteFloat64(flt)
		if err != nil {
			t.Fatal(err)
		}
		err = wr.Flush()
		if err != nil {
			t.Fatal(err)
		}
		out, err := rd.ReadFloat64()
		if err != nil {
			t.Errorf("Error reading %f: %s", flt, err)
			continue
		}

		if out != flt {
			t.Errorf("Put in %f but got out %f", flt, out)
		}
	}
}

func BenchmarkReadFloat64(b *testing.B) {
	fs := []float64{rand.Float64(), rand.Float64(), rand.Float64(), rand.Float64()}
	data := make([]byte, 0, 9*len(fs))
	for _, f := range fs {
		data = AppendFloat64(data, f)
	}
	rd := NewReader(NewEndlessReader(data, b))
	b.SetBytes(9)
	b.ReportAllocs()
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, err := rd.ReadFloat64()
		if err != nil {
			b.Fatal(err)
		}
	}
}

func TestReadFloat32(t *testing.T) {
	var buf bytes.Buffer
	wr := NewWriter(&buf)
	rd := NewReader(&buf)

	for i := 0; i < 10000; i++ {
		buf.Reset()

		flt := (rand.Float32() - 0.5) * math.MaxFloat32
		err := wr.WriteFloat32(flt)
		if err != nil {
			t.Fatal(err)
		}
		err = wr.Flush()
		if err != nil {
			t.Fatal(err)
		}
		out, err := rd.ReadFloat32()
		if err != nil {
			t.Errorf("Error reading %f: %s", flt, err)
			continue
		}

		if out != flt {
			t.Errorf("Put in %f but got out %f", flt, out)
		}
	}
}

func BenchmarkReadFloat32(b *testing.B) {
	fs := []float32{rand.Float32(), rand.Float32(), rand.Float32(), rand.Float32()}
	data := make([]byte, 0, 5*len(fs))
	for _, f := range fs {
		data = AppendFloat32(data, f)
	}
	rd := NewReader(NewEndlessReader(data, b))
	b.SetBytes(5)
	b.ReportAllocs()
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, err := rd.ReadFloat32()
		if err != nil {
			b.Fatal(err)
		}
	}
}

func TestReadInt64(t *testing.T) {
	var buf bytes.Buffer
	wr := NewWriter(&buf)
	rd := NewReader(&buf)

	ints := []int64{-100000, -5000, -5, 0, 8, 240, int64(tuint16), int64(tuint32), int64(tuint64)}

	for i, num := range ints {
		buf.Reset()

		err := wr.WriteInt64(num)
		if err != nil {
			t.Fatal(err)
		}
		err = wr.Flush()
		if err != nil {
			t.Fatal(err)
		}
		out, err := rd.ReadInt64()
		if err != nil {
			t.Fatal(err)
		}
		if out != num {
			t.Errorf("Test case %d: put %d in and got %d out", i, num, out)
		}
	}
}

func BenchmarkReadInt64(b *testing.B) {
	is := []int64{0, 1, 65000, rand.Int63()}
	data := make([]byte, 0, 9*len(is))
	for _, n := range is {
		data = AppendInt64(data, n)
	}
	rd := NewReader(NewEndlessReader(data, b))
	b.SetBytes(int64(len(data) / len(is)))
	b.ReportAllocs()
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, err := rd.ReadInt64()
		if err != nil {
			b.Fatal(err)
		}
	}
}

func TestReadUint64(t *testing.T) {
	var buf bytes.Buffer
	wr := NewWriter(&buf)
	rd := NewReader(&buf)

	ints := []uint64{0, 8, 240, uint64(tuint16), uint64(tuint32), uint64(tuint64)}

	for i, num := range ints {
		buf.Reset()

		err := wr.WriteUint64(num)
		if err != nil {
			t.Fatal(err)
		}
		err = wr.Flush()
		if err != nil {
			t.Fatal(err)
		}
		out, err := rd.ReadUint64()
		if out != num {
			t.Errorf("Test case %d: put %d in and got %d out", i, num, out)
		}
	}
}

func BenchmarkReadUint64(b *testing.B) {
	us := []uint64{0, 1, 10000, uint64(rand.Uint32() * 4)}
	data := make([]byte, 0, 9*len(us))
	for _, n := range us {
		data = AppendUint64(data, n)
	}
	rd := NewReader(NewEndlessReader(data, b))
	b.SetBytes(int64(len(data) / len(us)))
	b.ReportAllocs()
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, err := rd.ReadUint64()
		if err != nil {
			b.Fatal(err)
		}
	}
}

func TestReadBytes(t *testing.T) {
	var buf bytes.Buffer
	wr := NewWriter(&buf)
	rd := NewReader(&buf)

	sizes := []int{0, 1, 225, int(tuint32)}
	var scratch []byte
	for i, size := range sizes {
		buf.Reset()
		bts := RandBytes(size)

		err := wr.WriteBytes(bts)
		if err != nil {
			t.Fatal(err)
		}
		err = wr.Flush()
		if err != nil {
			t.Fatal(err)
		}

		out, err := rd.ReadBytes(scratch)
		if err != nil {
			t.Errorf("test case %d: %s", i, err)
			continue
		}

		if !bytes.Equal(bts, out) {
			t.Errorf("test case %d: Bytes not equal.", i)
		}

	}
}

func benchBytes(size uint32, b *testing.B) {
	data := make([]byte, 0, size+5)
	data = AppendBytes(data, RandBytes(int(size)))

	rd := NewReader(NewEndlessReader(data, b))
	b.SetBytes(int64(len(data)))
	b.ReportAllocs()
	b.ResetTimer()
	var scratch []byte
	var err error
	for i := 0; i < b.N; i++ {
		scratch, err = rd.ReadBytes(scratch)
		if err != nil {
			b.Fatal(err)
		}
	}
}

func BenchmarkRead16Bytes(b *testing.B) {
	benchBytes(16, b)
}

func BenchmarkRead256Bytes(b *testing.B) {
	benchBytes(256, b)
}

// This particular case creates
// an object larger than the default
// read buffer size, so it's a decent
// indicator of worst-case performance.
func BenchmarkRead2048Bytes(b *testing.B) {
	benchBytes(2048, b)
}

func TestReadString(t *testing.T) {
	var buf bytes.Buffer
	wr := NewWriter(&buf)
	rd := NewReader(&buf)

	sizes := []int{0, 1, 225, int(math.MaxUint16 + 5)}
	for i, size := range sizes {
		buf.Reset()
		in := string(RandBytes(size))

		err := wr.WriteString(in)
		if err != nil {
			t.Fatal(err)
		}
		err = wr.Flush()
		if err != nil {
			t.Fatal(err)
		}

		out, err := rd.ReadString()
		if err != nil {
			t.Errorf("test case %d: %s", i, err)
		}
		if out != in {
			t.Errorf("test case %d: strings not equal.", i)
			t.Errorf("string (len = %d) in; string (len = %d) out", size, len(out))
		}

	}
}

func benchString(size uint32, b *testing.B) {
	str := string(RandBytes(int(size)))
	data := make([]byte, 0, len(str)+5)
	data = AppendString(data, str)
	rd := NewReader(NewEndlessReader(data, b))
	b.SetBytes(int64(len(data)))
	b.ReportAllocs()
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, err := rd.ReadString()
		if err != nil {
			b.Fatal(err)
		}
	}
}

func benchStringAsBytes(size uint32, b *testing.B) {
	str := string(RandBytes(int(size)))
	data := make([]byte, 0, len(str)+5)
	data = AppendString(data, str)
	rd := NewReader(NewEndlessReader(data, b))
	b.SetBytes(int64(len(data)))
	b.ReportAllocs()
	b.ResetTimer()
	var scratch []byte
	var err error
	for i := 0; i < b.N; i++ {
		scratch, err = rd.ReadStringAsBytes(scratch)
		if err != nil {
			b.Fatal(err)
		}
	}
}

func BenchmarkRead16StringAsBytes(b *testing.B) {
	benchStringAsBytes(16, b)
}

func BenchmarkRead256StringAsBytes(b *testing.B) {
	benchStringAsBytes(256, b)
}

func BenchmarkRead16String(b *testing.B) {
	benchString(16, b)
}

func BenchmarkRead256String(b *testing.B) {
	benchString(256, b)
}

func TestReadComplex64(t *testing.T) {
	var buf bytes.Buffer
	wr := NewWriter(&buf)
	rd := NewReader(&buf)

	for i := 0; i < 100; i++ {
		buf.Reset()
		f := complex(rand.Float32()*math.MaxFloat32, rand.Float32()*math.MaxFloat32)

		wr.WriteComplex64(f)
		err := wr.Flush()
		if err != nil {
			t.Fatal(err)
		}

		out, err := rd.ReadComplex64()
		if err != nil {
			t.Error(err)
			continue
		}

		if out != f {
			t.Errorf("Wrote %f; read %f", f, out)
		}

	}
}

func BenchmarkReadComplex64(b *testing.B) {
	f := complex(rand.Float32(), rand.Float32())
	data := AppendComplex64(nil, f)
	rd := NewReader(NewEndlessReader(data, b))
	b.SetBytes(int64(len(data)))
	b.ReportAllocs()
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, err := rd.ReadComplex64()
		if err != nil {
			b.Fatal(err)
		}
	}
}

func TestReadComplex128(t *testing.T) {
	var buf bytes.Buffer
	wr := NewWriter(&buf)
	rd := NewReader(&buf)

	for i := 0; i < 10; i++ {
		buf.Reset()
		f := complex(rand.Float64()*math.MaxFloat64, rand.Float64()*math.MaxFloat64)

		wr.WriteComplex128(f)
		err := wr.Flush()
		if err != nil {
			t.Fatal(err)
		}

		out, err := rd.ReadComplex128()
		if err != nil {
			t.Error(err)
			continue
		}
		if out != f {
			t.Errorf("Wrote %f; read %f", f, out)
		}

	}
}

func BenchmarkReadComplex128(b *testing.B) {
	f := complex(rand.Float64(), rand.Float64())
	data := AppendComplex128(nil, f)
	rd := NewReader(NewEndlessReader(data, b))
	b.SetBytes(int64(len(data)))
	b.ReportAllocs()
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, err := rd.ReadComplex128()
		if err != nil {
			b.Fatal(err)
		}
	}
}

func TestTime(t *testing.T) {
	var buf bytes.Buffer
	now := time.Now()
	en := NewWriter(&buf)
	dc := NewReader(&buf)

	err := en.WriteTime(now)
	if err != nil {
		t.Fatal(err)
	}
	err = en.Flush()
	if err != nil {
		t.Fatal(err)
	}

	out, err := dc.ReadTime()
	if err != nil {
		t.Fatal(err)
	}

	// check for equivalence
	if !now.Equal(out) {
		t.Fatalf("%s in; %s out", now, out)
	}

	// check for time.Local zone
	if now != out {
		t.Error("returned time.Time not set to time.Local")
	}
}

func BenchmarkReadTime(b *testing.B) {
	t := time.Now()
	data := AppendTime(nil, t)
	rd := NewReader(NewEndlessReader(data, b))
	b.SetBytes(int64(len(data)))
	b.ReportAllocs()
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, err := rd.ReadTime()
		if err != nil {
			b.Fatal(err)
		}
	}
}

func TestSkip(t *testing.T) {
	var buf bytes.Buffer
	wr := NewWriter(&buf)
	rd := NewReader(&buf)

	wr.WriteMapHeader(4)
	wr.WriteString("key_1")
	wr.WriteBytes([]byte("value_1"))
	wr.WriteString("key_2")
	wr.WriteFloat64(2.0)
	wr.WriteString("key_3")
	wr.WriteComplex128(3.0i)
	wr.WriteString("key_4")
	wr.WriteInt64(49080432189)
	wr.Flush()

	// this should skip the whole map
	err := rd.Skip()
	if err != nil {
		t.Fatal(err)
	}

	tp, err := rd.NextType()
	if err != io.EOF {
		t.Errorf("expected %q; got %q", io.EOF, err)
		t.Errorf("returned type %q", tp)
	}

}

func BenchmarkSkip(b *testing.B) {
	var buf bytes.Buffer
	en := NewWriter(&buf)
	en.WriteMapHeader(6)

	en.WriteString("thing_one")
	en.WriteString("value_one")

	en.WriteString("thing_two")
	en.WriteFloat64(3.14159)

	en.WriteString("some_bytes")
	en.WriteBytes([]byte("nkl4321rqw908vxzpojnlk2314rqew098-s09123rdscasd"))

	en.WriteString("the_time")
	en.WriteTime(time.Now())

	en.WriteString("what?")
	en.WriteBool(true)

	en.WriteString("ext")
	en.WriteExtension(&RawExtension{Type: 55, Data: []byte("raw data!!!")})
	en.Flush()

	bts := buf.Bytes()
	b.SetBytes(int64(len(bts)))
	b.ReportAllocs()
	b.ResetTimer()

	rd := NewReader(NewEndlessReader(bts, b))
	for i := 0; i < b.N; i++ {
		err := rd.Skip()
		if err != nil {
			b.Fatal(err)
		}
	}
}
