package snappystream

import (
	"bytes"
	"crypto/rand"
	"io"
	"io/ioutil"
	"testing"
)

const TestFileSize = 10 << 20 // 10MB

// dummyBytesReader returns an io.Reader that avoids buffering optimizations
// in io.Copy. This can be considered a 'worst-case' io.Reader as far as writer
// frame alignment goes.
//
// Note: io.Copy uses a 32KB buffer internally as of Go 1.3, but that isn't
// part of its public API (undocumented).
func dummyBytesReader(p []byte) io.Reader {
	return ioutil.NopCloser(bytes.NewReader(p))
}

func testWriteThenRead(t *testing.T, name string, bs []byte) {
	var buf bytes.Buffer
	w := NewWriter(&buf)
	n, err := io.Copy(w, dummyBytesReader(bs))
	if err != nil {
		t.Errorf("write %v: %v", name, err)
		return
	}
	if n != int64(len(bs)) {
		t.Errorf("write %v: wrote %d bytes (!= %d)", name, n, len(bs))
		return
	}

	enclen := buf.Len()

	r := NewReader(&buf, true)
	gotbs, err := ioutil.ReadAll(r)
	if err != nil {
		t.Errorf("read %v: %v", name, err)
		return
	}
	n = int64(len(gotbs))
	if n != int64(len(bs)) {
		t.Errorf("read %v: read %d bytes (!= %d)", name, n, len(bs))
		return
	}

	if !bytes.Equal(gotbs, bs) {
		t.Errorf("%v: unequal decompressed content", name)
		return
	}

	c := float64(len(bs)) / float64(enclen)
	t.Logf("%v compression ratio %.03g (%d byte reduction)", name, c, len(bs)-enclen)
}

func testBufferedWriteThenRead(t *testing.T, name string, bs []byte) {
	var buf bytes.Buffer
	w := NewBufferedWriter(&buf)
	n, err := io.Copy(w, dummyBytesReader(bs))
	if err != nil {
		t.Errorf("write %v: %v", name, err)
		return
	}
	if n != int64(len(bs)) {
		t.Errorf("write %v: wrote %d bytes (!= %d)", name, n, len(bs))
		return
	}
	err = w.Close()
	if err != nil {
		t.Errorf("close %v: %v", name, err)
		return
	}

	enclen := buf.Len()

	r := NewReader(&buf, true)
	gotbs, err := ioutil.ReadAll(r)
	if err != nil {
		t.Errorf("read %v: %v", name, err)
		return
	}
	n = int64(len(gotbs))
	if n != int64(len(bs)) {
		t.Errorf("read %v: read %d bytes (!= %d)", name, n, len(bs))
		return
	}

	if !bytes.Equal(gotbs, bs) {
		t.Errorf("%v: unequal decompressed content", name)
		return
	}

	c := float64(len(bs)) / float64(enclen)
	t.Logf("%v compression ratio %.03g (%d byte reduction)", name, c, len(bs)-enclen)
}

func TestWriterReader(t *testing.T) {
	testWriteThenRead(t, "simple", []byte("test"))
	testWriteThenRead(t, "manpage", testDataMan)
	testWriteThenRead(t, "json", testDataJSON)

	p := make([]byte, TestFileSize)
	testWriteThenRead(t, "constant", p)

	_, err := rand.Read(p)
	if err != nil {
		t.Fatal(err)
	}
	testWriteThenRead(t, "random", p)

}

func TestBufferedWriterReader(t *testing.T) {
	testBufferedWriteThenRead(t, "simple", []byte("test"))
	testBufferedWriteThenRead(t, "manpage", testDataMan)
	testBufferedWriteThenRead(t, "json", testDataJSON)

	p := make([]byte, TestFileSize)
	testBufferedWriteThenRead(t, "constant", p)

	_, err := rand.Read(p)
	if err != nil {
		t.Fatal(err)
	}
	testBufferedWriteThenRead(t, "random", p)

}

func TestWriterChunk(t *testing.T) {
	var buf bytes.Buffer

	in := make([]byte, 128000)

	w := NewWriter(&buf)
	r := NewReader(&buf, VerifyChecksum)

	n, err := w.Write(in)
	if err != nil {
		t.Fatalf(err.Error())
	}
	if n != len(in) {
		t.Fatalf("wrote wrong amount %d != %d", n, len(in))
	}

	out := make([]byte, len(in))
	n, err = io.ReadFull(r, out)
	if err != nil {
		t.Fatal(err)
	}
	if n != len(in) {
		t.Fatalf("read wrong amount %d != %d", n, len(in))
	}

	if !bytes.Equal(out, in) {
		t.Fatalf("bytes not equal %v != %v", out, in)
	}
}

func BenchmarkWriterManpage(b *testing.B) {
	benchmarkWriterBytes(b, testDataMan)
}
func BenchmarkBufferedWriterManpage(b *testing.B) {
	benchmarkBufferedWriterBytes(b, testDataMan)
}
func BenchmarkBufferedWriterManpageNoCopy(b *testing.B) {
	benchmarkBufferedWriterBytesNoCopy(b, testDataMan)
}

func BenchmarkWriterJSON(b *testing.B) {
	benchmarkWriterBytes(b, testDataJSON)
}
func BenchmarkBufferedWriterJSON(b *testing.B) {
	benchmarkBufferedWriterBytes(b, testDataJSON)
}
func BenchmarkBufferedWriterJSONNoCopy(b *testing.B) {
	benchmarkBufferedWriterBytesNoCopy(b, testDataJSON)
}

// BenchmarkWriterRandom tests performance encoding effectively uncompressable
// data.
func BenchmarkWriterRandom(b *testing.B) {
	benchmarkWriterBytes(b, randBytes(b, TestFileSize))
}
func BenchmarkBufferedWriterRandom(b *testing.B) {
	benchmarkBufferedWriterBytes(b, randBytes(b, TestFileSize))
}
func BenchmarkBufferedWriterRandomNoCopy(b *testing.B) {
	benchmarkBufferedWriterBytesNoCopy(b, randBytes(b, TestFileSize))
}

// BenchmarkWriterConstant tests performance encoding maximally compressible
// data.
func BenchmarkWriterConstant(b *testing.B) {
	benchmarkWriterBytes(b, make([]byte, TestFileSize))
}
func BenchmarkBufferedWriterConstant(b *testing.B) {
	benchmarkBufferedWriterBytes(b, make([]byte, TestFileSize))
}
func BenchmarkBufferedWriterConstantNoCopy(b *testing.B) {
	benchmarkBufferedWriterBytesNoCopy(b, make([]byte, TestFileSize))
}

func benchmarkWriterBytes(b *testing.B, p []byte) {
	enc := func() io.WriteCloser {
		// wrap the normal writer so that it has a noop Close method.  writer
		// does not implement ReaderFrom so this does not impact performance.
		return &nopWriteCloser{NewWriter(ioutil.Discard)}
	}
	benchmarkEncode(b, enc, p)
}
func benchmarkBufferedWriterBytes(b *testing.B, p []byte) {
	enc := func() io.WriteCloser {
		// the writer's ReaderFrom implemention will be used in the benchmark.
		return NewBufferedWriter(ioutil.Discard)
	}
	benchmarkEncode(b, enc, p)
}
func benchmarkBufferedWriterBytesNoCopy(b *testing.B, p []byte) {
	enc := func() io.WriteCloser {
		// the writer is wrapped as to hide it's ReaderFrom implemention.
		return &writeCloserNoCopy{NewBufferedWriter(ioutil.Discard)}
	}
	benchmarkEncode(b, enc, p)
}

// benchmarkEncode benchmarks the speed at which bytes can be copied from
// bs into writers created by enc.
func benchmarkEncode(b *testing.B, enc func() io.WriteCloser, bs []byte) {
	size := int64(len(bs))
	b.SetBytes(size)
	b.StartTimer()
	for i := 0; i < b.N; i++ {
		w := enc()
		n, err := io.Copy(w, dummyBytesReader(bs))
		if err != nil {
			b.Fatal(err)
		}
		if n != size {
			b.Fatalf("wrote wrong amount %d != %d", n, size)
		}
		err = w.Close()
		if err != nil {
			b.Fatalf("close: %v", err)
		}
	}
	b.StopTimer()
}

func BenchmarkReaderManpage(b *testing.B) {
	encodeAndBenchmarkReader(b, testDataMan)
}
func BenchmarkReaderManpage_buffered(b *testing.B) {
	encodeAndBenchmarkReader_buffered(b, testDataMan)
}
func BenchmarkReaderManpageNoCopy(b *testing.B) {
	encodeAndBenchmarkReaderNoCopy(b, testDataMan)
}

func BenchmarkReaderJSON(b *testing.B) {
	encodeAndBenchmarkReader(b, testDataJSON)
}
func BenchmarkReaderJSON_buffered(b *testing.B) {
	encodeAndBenchmarkReader_buffered(b, testDataJSON)
}
func BenchmarkReaderJSONNoCopy(b *testing.B) {
	encodeAndBenchmarkReaderNoCopy(b, testDataJSON)
}

// BenchmarkReaderRandom tests decoding of effectively uncompressable data.
func BenchmarkReaderRandom(b *testing.B) {
	encodeAndBenchmarkReader(b, randBytes(b, TestFileSize))
}
func BenchmarkReaderRandom_buffered(b *testing.B) {
	encodeAndBenchmarkReader_buffered(b, randBytes(b, TestFileSize))
}
func BenchmarkReaderRandomNoCopy(b *testing.B) {
	encodeAndBenchmarkReaderNoCopy(b, randBytes(b, TestFileSize))
}

// BenchmarkReaderConstant tests decoding of maximally compressible data.
func BenchmarkReaderConstant(b *testing.B) {
	encodeAndBenchmarkReader(b, make([]byte, TestFileSize))
}
func BenchmarkReaderConstant_buffered(b *testing.B) {
	encodeAndBenchmarkReader_buffered(b, make([]byte, TestFileSize))
}
func BenchmarkReaderConstantNoCopy(b *testing.B) {
	encodeAndBenchmarkReaderNoCopy(b, make([]byte, TestFileSize))
}

// encodeAndBenchmarkReader is a helper that benchmarks the package
// reader's performance given p encoded as a snappy framed stream.
//
// encodeAndBenchmarkReader benchmarks decoding of streams containing
// (multiple) short frames.
func encodeAndBenchmarkReader(b *testing.B, p []byte) {
	enc, err := encodeStreamBytes(p, false)
	if err != nil {
		b.Fatalf("pre-benchmark compression: %v", err)
	}
	dec := func(r io.Reader) io.Reader {
		return NewReader(r, VerifyChecksum)
	}
	benchmarkDecode(b, dec, int64(len(p)), enc)
}

// encodeAndBenchmarkReader_buffered is a helper that benchmarks the
// package reader's performance given p encoded as a snappy framed stream.
//
// encodeAndBenchmarkReader_buffered benchmarks decoding of streams that
// contain at most one short frame (at the end).
func encodeAndBenchmarkReader_buffered(b *testing.B, p []byte) {
	enc, err := encodeStreamBytes(p, true)
	if err != nil {
		b.Fatalf("pre-benchmark compression: %v", err)
	}
	dec := func(r io.Reader) io.Reader {
		return NewReader(r, VerifyChecksum)
	}
	benchmarkDecode(b, dec, int64(len(p)), enc)
}

// encodeAndBenchmarkReaderNoCopy is a helper that benchmarks the
// package reader's performance given p encoded as a snappy framed stream.
// encodeAndBenchmarReaderNoCopy avoids use of the reader's io.WriterTo
// interface.
//
// encodeAndBenchmarkReaderNoCopy benchmarks decoding of streams that
// contain at most one short frame (at the end).
func encodeAndBenchmarkReaderNoCopy(b *testing.B, p []byte) {
	enc, err := encodeStreamBytes(p, true)
	if err != nil {
		b.Fatalf("pre-benchmark compression: %v", err)
	}
	dec := func(r io.Reader) io.Reader {
		return ioutil.NopCloser(NewReader(r, VerifyChecksum))
	}
	benchmarkDecode(b, dec, int64(len(p)), enc)
}

// benchmarkDecode runs a benchmark that repeatedly decoded snappy
// framed bytes enc.  The length of the decoded result in each iteration must
// equal size.
func benchmarkDecode(b *testing.B, dec func(io.Reader) io.Reader, size int64, enc []byte) {
	b.SetBytes(int64(len(enc))) // BUG this is probably wrong
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		r := dec(bytes.NewReader(enc))
		n, err := io.Copy(ioutil.Discard, r)
		if err != nil {
			b.Fatalf(err.Error())
		}
		if n != size {
			b.Fatalf("read wrong amount %d != %d", n, size)
		}
	}
	b.StopTimer()
}

// encodeStreamBytes is like encodeStream but operates on a byte slice.
// encodeStreamBytes ensures that long streams are not maximally compressed if
// buffer is false.
func encodeStreamBytes(b []byte, buffer bool) ([]byte, error) {
	return encodeStream(dummyBytesReader(b), buffer)
}

// encodeStream encodes data read from r as a snappy framed stream and returns
// the result as a byte slice.  if buffer is true the bytes from r are buffered
// to improve the resulting slice's compression ratio.
func encodeStream(r io.Reader, buffer bool) ([]byte, error) {
	var buf bytes.Buffer
	if !buffer {
		w := NewWriter(&buf)
		_, err := io.Copy(w, r)
		if err != nil {
			return nil, err
		}
		return buf.Bytes(), nil
	}

	w := NewBufferedWriter(&buf)
	_, err := io.Copy(w, r)
	if err != nil {
		return nil, err
	}
	err = w.Close()
	if err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

// randBytes reads size bytes from the computer's cryptographic random source.
// the resulting bytes have approximately maximal entropy and are effectively
// uncompressible with any algorithm.
func randBytes(b *testing.B, size int) []byte {
	randp := make([]byte, size)
	_, err := io.ReadFull(rand.Reader, randp)
	if err != nil {
		b.Fatal(err)
	}
	return randp
}

// writeCloserNoCopy is an io.WriteCloser that simply wraps another
// io.WriteCloser.  This is useful for masking implementations for interfaces
// like ReaderFrom which may be opted into use inside functions like io.Copy.
type writeCloserNoCopy struct {
	io.WriteCloser
}

// nopWriteCloser is an io.WriteCloser that has a noop Close method.  This type
// has the effect of masking the underlying writer's Close implementation if it
// has one, or satisfying interface implementations for writers that do not
// need to be closing.
type nopWriteCloser struct {
	io.Writer
}

func (w *nopWriteCloser) Close() error {
	return nil
}
