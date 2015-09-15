package fwd

import (
	"bytes"
	"io"
	"io/ioutil"
	"math/rand"
	"testing"
	"unsafe"
)

// partialReader reads into only
// part of the supplied byte slice
// to the underlying reader
type partialReader struct {
	r io.Reader
}

func (p partialReader) Read(b []byte) (int, error) {
	n := max(1, rand.Intn(len(b)))
	return p.r.Read(b[:n])
}

func randomBts(sz int) []byte {
	o := make([]byte, sz)
	for i := 0; i < len(o); i += 8 {
		j := (*int64)(unsafe.Pointer(&o[i]))
		*j = rand.Int63()
	}
	return o
}

func TestRead(t *testing.T) {
	bts := randomBts(512)

	// make the buffer much
	// smaller than the underlying
	// bytes to incur multiple fills
	rd := NewReaderSize(partialReader{bytes.NewReader(bts)}, 128)

	if rd.BufferSize() != cap(rd.data) {
		t.Errorf("BufferSize() returned %d; should return %d", rd.BufferSize(), cap(rd.data))
	}

	// starting Buffered() should be 0
	if rd.Buffered() != 0 {
		t.Errorf("Buffered() should return 0 at initialization; got %d", rd.Buffered())
	}

	some := make([]byte, 32)
	n, err := rd.Read(some)
	if err != nil {
		t.Fatal(err)
	}
	if n == 0 {
		t.Fatal("read 0 bytes w/ a non-nil error!")
	}
	some = some[:n]

	more := make([]byte, 64)
	j, err := rd.Read(more)
	if err != nil {
		t.Fatal(err)
	}
	if j == 0 {
		t.Fatal("read 0 bytes w/ a non-nil error")
	}
	more = more[:j]

	out, err := ioutil.ReadAll(rd)
	if err != nil {
		t.Fatal(err)
	}

	all := append(some, more...)
	all = append(all, out...)

	if !bytes.Equal(bts, all) {
		t.Errorf("bytes not equal; %d bytes in and %d bytes out", len(bts), len(out))
	}
}

func TestReadByte(t *testing.T) {
	bts := randomBts(512)
	rd := NewReaderSize(partialReader{bytes.NewReader(bts)}, 98)

	var (
		err error
		i   int
		b   byte
	)

	// scan through the whole
	// array byte-by-byte
	for err != io.EOF {
		b, err = rd.ReadByte()
		if err == nil {
			if b != bts[i] {
				t.Fatalf("offset %d: %d in; %d out", i, b, bts[i])
			}
		}
		i++
	}
	if err != io.EOF {
		t.Fatal(err)
	}
}

func TestSkipNoSeek(t *testing.T) {
	bts := randomBts(1024)
	rd := NewReaderSize(partialReader{bytes.NewReader(bts)}, 200)

	n, err := rd.Skip(512)
	if err != nil {
		t.Fatal(err)
	}
	if n != 512 {
		t.Fatalf("Skip() returned a nil error, but skipped %d bytes instead of %d", n, 512)
	}

	var b byte
	b, err = rd.ReadByte()
	if err != nil {
		t.Fatal(err)
	}

	if b != bts[512] {
		t.Fatalf("at index %d: %d in; %d out", 512, bts[512], b)
	}

	n, err = rd.Skip(10)
	if err != nil {
		t.Fatal(err)
	}
	if n != 10 {
		t.Fatalf("Skip() returned a nil error, but skipped %d bytes instead of %d", n, 10)
	}

	// now try to skip past the end
	rd = NewReaderSize(partialReader{bytes.NewReader(bts)}, 200)

	n, err = rd.Skip(2000)
	if err != io.ErrUnexpectedEOF {
		t.Fatalf("expected error %q; got %q", io.EOF, err)
	}
	if n != 1024 {
		t.Fatalf("expected to skip only 1024 bytes; skipped %d", n)
	}
}

func TestSkipSeek(t *testing.T) {
	bts := randomBts(1024)

	// bytes.Reader implements io.Seeker
	rd := NewReaderSize(bytes.NewReader(bts), 200)

	n, err := rd.Skip(512)
	if err != nil {
		t.Fatal(err)
	}
	if n != 512 {
		t.Fatalf("Skip() returned a nil error, but skipped %d bytes instead of %d", n, 512)
	}

	var b byte
	b, err = rd.ReadByte()
	if err != nil {
		t.Fatal(err)
	}

	if b != bts[512] {
		t.Fatalf("at index %d: %d in; %d out", 512, bts[512], b)
	}

	n, err = rd.Skip(10)
	if err != nil {
		t.Fatal(err)
	}
	if n != 10 {
		t.Fatalf("Skip() returned a nil error, but skipped %d bytes instead of %d", n, 10)
	}

	// now try to skip past the end
	rd.Reset(bytes.NewReader(bts))

	// because of how bytes.Reader
	// implements Seek, this should
	// return (2000, nil)
	n, err = rd.Skip(2000)
	if err != nil {
		t.Fatal(err)
	}
	if n != 2000 {
		t.Fatalf("should have returned %d bytes; returned %d", 2000, n)
	}

	// the next call to Read()
	// should return io.EOF
	n, err = rd.Read([]byte{0, 0, 0})
	if err != io.EOF {
		t.Errorf("expected %q; got %q", io.EOF, err)
	}
	if n != 0 {
		t.Errorf("expected 0 bytes read; got %d", n)
	}

}

func TestPeek(t *testing.T) {
	bts := randomBts(1024)
	rd := NewReaderSize(partialReader{bytes.NewReader(bts)}, 200)

	// first, a peek < buffer size
	var (
		peek []byte
		err  error
	)
	peek, err = rd.Peek(100)
	if err != nil {
		t.Fatal(err)
	}
	if len(peek) != 100 {
		t.Fatalf("asked for %d bytes; got %d", 100, len(peek))
	}
	if !bytes.Equal(peek, bts[:100]) {
		t.Fatal("peeked bytes not equal")
	}

	// now, a peek > buffer size
	peek, err = rd.Peek(256)
	if err != nil {
		t.Fatal(err)
	}
	if len(peek) != 256 {
		t.Fatalf("asked for %d bytes; got %d", 100, len(peek))
	}
	if !bytes.Equal(peek, bts[:256]) {
		t.Fatal("peeked bytes not equal")
	}

	// now try to peek past EOF
	peek, err = rd.Peek(2048)
	if err != io.EOF {
		t.Fatalf("expected error %q; got %q", io.EOF, err)
	}
	if len(peek) != 1024 {
		t.Fatalf("expected %d bytes peek-able; got %d", 1024, len(peek))
	}
}

func TestNext(t *testing.T) {
	size := 1024
	bts := randomBts(size)
	rd := NewReaderSize(partialReader{bytes.NewReader(bts)}, 200)

	chunksize := 256
	chunks := size / chunksize

	for i := 0; i < chunks; i++ {
		out, err := rd.Next(chunksize)
		if err != nil {
			t.Fatal(err)
		}
		start := chunksize * i
		if !bytes.Equal(bts[start:start+chunksize], out) {
			t.Fatalf("chunk %d: chunks not equal", i+1)
		}
	}
}

func TestWriteTo(t *testing.T) {
	bts := randomBts(2048)
	rd := NewReaderSize(partialReader{bytes.NewReader(bts)}, 200)

	// cause the buffer
	// to fill a little, just
	// to complicate things
	rd.Peek(25)

	var out bytes.Buffer
	n, err := rd.WriteTo(&out)
	if err != nil {
		t.Fatal(err)
	}
	if n != 2048 {
		t.Fatalf("should have written %d bytes; wrote %d", 2048, n)
	}
	if !bytes.Equal(out.Bytes(), bts) {
		t.Fatal("bytes not equal")
	}
}

func TestReadFull(t *testing.T) {
	bts := randomBts(1024)
	rd := NewReaderSize(partialReader{bytes.NewReader(bts)}, 256)

	// try to ReadFull() the whole thing
	out := make([]byte, 1024)
	n, err := rd.ReadFull(out)
	if err != nil {
		t.Fatal(err)
	}
	if n != 1024 {
		t.Fatalf("expected to read %d bytes; read %d", 1024, n)
	}
	if !bytes.Equal(bts, out) {
		t.Fatal("bytes not equal")
	}

	rd.Reset(partialReader{bytes.NewReader(bts)})

	// now try to read *past* EOF
	out = make([]byte, 1500)
	n, err = rd.ReadFull(out)
	if err != io.ErrUnexpectedEOF {
		t.Fatalf("expected error %q; got %q", io.EOF, err)
	}
	if n != 1024 {
		t.Fatalf("expected to read %d bytes; read %d", 1024, n)
	}
}
