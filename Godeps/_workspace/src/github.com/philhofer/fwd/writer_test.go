package fwd

import (
	"bytes"
	"io"
	"math/rand"
	"testing"
)

type chunkedWriter struct {
	w *Writer
}

// writes 'p' in randomly-sized chunks
func (c chunkedWriter) Write(p []byte) (int, error) {
	l := len(p)
	n := 0
	for n < l {
		amt := max(rand.Intn(l-n), 1)      // number of bytes to write; at least 1
		nn, err := c.w.Write(p[n : n+amt]) //
		n += nn
		if err == nil && nn < amt {
			err = io.ErrShortWrite
		}
		if err != nil {
			return n, err
		}
	}
	return n, nil
}

// analagous to Write(), but w/ str
func (c chunkedWriter) WriteString(s string) (int, error) {
	l := len(s)
	n := 0
	for n < l {
		amt := max(rand.Intn(l-n), 1)            // number of bytes to write; at least 1
		nn, err := c.w.WriteString(s[n : n+amt]) //
		n += nn
		if err == nil && nn < amt {
			err = io.ErrShortWrite
		}
		if err != nil {
			return n, err
		}
	}
	return n, nil
}

// writes via random calls to Next()
type nextWriter struct {
	wr *Writer
}

func (c nextWriter) Write(p []byte) (int, error) {
	l := len(p)
	n := 0
	for n < l {
		amt := max(rand.Intn(l-n), 1) // at least 1 byte
		fwd, err := c.wr.Next(amt)    // get next (amt) bytes
		if err != nil {

			// this may happen occasionally
			if err == io.ErrShortBuffer {
				if cap(c.wr.buf) >= amt {
					panic("bad io.ErrShortBuffer")
				}
				continue
			}

			return n, err
		}
		if len(fwd) != amt {
			panic("bad Next() len")
		}
		n += copy(fwd, p[n:])
	}
	return n, nil
}

func TestWrite(t *testing.T) {
	nbts := 4096
	bts := randomBts(nbts)
	var buf bytes.Buffer
	wr := NewWriterSize(&buf, 512)

	if wr.BufferSize() != 512 {
		t.Fatalf("expected BufferSize() to be %d; found %d", 512, wr.BufferSize())
	}

	cwr := chunkedWriter{wr}
	nb, err := cwr.Write(bts)
	if err != nil {
		t.Fatal(err)
	}
	if nb != nbts {
		t.Fatalf("expected to write %d bytes; wrote %d bytes", nbts, nb)
	}
	err = wr.Flush()
	if err != nil {
		t.Fatal(err)
	}

	if wr.Buffered() != 0 {
		t.Fatalf("expected 0 buffered bytes; found %d", wr.Buffered())
	}

	if buf.Len() != nbts {
		t.Fatalf("wrote %d bytes, but buffer is %d bytes long", nbts, buf.Len())
	}
	if !bytes.Equal(bts, buf.Bytes()) {
		t.Fatal("buf.Bytes() is not the same as the input bytes")
	}
}

func TestWriteString(t *testing.T) {
	nbts := 3998
	str := string(randomBts(nbts))
	var buf bytes.Buffer
	wr := NewWriterSize(&buf, 1137)

	if wr.BufferSize() != 1137 {
		t.Fatalf("expected BufferSize() to return %d; returned %d", 1137, wr.BufferSize())
	}

	cwr := chunkedWriter{wr}
	nb, err := cwr.WriteString(str)
	if err != nil {
		t.Fatal(err)
	}
	if nb != nbts {
		t.Fatalf("expected to write %d bytes; wrote %d bytes", nbts, nb)
	}

	err = wr.Flush()
	if err != nil {
		t.Fatal(err)
	}

	if wr.Buffered() != 0 {
		t.Fatalf("expected 0 buffered bytes; found %d", wr.Buffered())
	}

	if buf.Len() != nbts {
		t.Fatalf("wrote %d bytes, buf buffer is %d bytes long", nbts, buf.Len())
	}
	if buf.String() != str {
		t.Fatal("buf.String() is not the same as input string")
	}
}

func TestWriteByte(t *testing.T) {
	nbts := 3200
	bts := randomBts(nbts)
	var buf bytes.Buffer
	wr := NewWriter(&buf)

	if wr.BufferSize() != DefaultWriterSize {
		t.Fatalf("expected BufferSize() to return %d; returned %d", DefaultWriterSize, wr.BufferSize())
	}

	// write byte-by-byte
	for _, b := range bts {
		if err := wr.WriteByte(b); err != nil {
			t.Fatal(err)
		}
	}

	err := wr.Flush()
	if err != nil {
		t.Fatal(err)
	}

	if buf.Len() != nbts {
		t.Fatalf("expected buf.Len() to be %d; got %d", nbts, buf.Len())
	}

	if !bytes.Equal(buf.Bytes(), bts) {
		t.Fatal("buf.Bytes() and input are not equal")
	}
}

func TestWriterNext(t *testing.T) {
	nbts := 1871
	bts := randomBts(nbts)
	var buf bytes.Buffer
	wr := NewWriterSize(&buf, 500)
	nwr := nextWriter{wr}

	nb, err := nwr.Write(bts)
	if err != nil {
		t.Fatal(err)
	}

	if nb != nbts {
		t.Fatalf("expected to write %d bytes; wrote %d", nbts, nb)
	}

	err = wr.Flush()
	if err != nil {
		t.Fatal(err)
	}

	if buf.Len() != nbts {
		t.Fatalf("expected buf.Len() to be %d; got %d", nbts, buf.Len())
	}

	if !bytes.Equal(buf.Bytes(), bts) {
		t.Fatal("buf.Bytes() and input are not equal")
	}
}

func TestReadFrom(t *testing.T) {
	nbts := 2139
	bts := randomBts(nbts)
	var buf bytes.Buffer
	wr := NewWriterSize(&buf, 987)

	rd := partialReader{bytes.NewReader(bts)}

	nb, err := wr.ReadFrom(rd)
	if err != nil {
		t.Fatal(err)
	}
	if nb != int64(nbts) {
		t.Fatalf("expeted to write %d bytes; wrote %d", nbts, nb)
	}
	err = wr.Flush()
	if err != nil {
		t.Fatal(err)
	}
	if buf.Len() != nbts {
		t.Fatalf("expected buf.Len() to be %d; got %d", nbts, buf.Len())
	}
	if !bytes.Equal(buf.Bytes(), bts) {
		t.Fatal("buf.Bytes() and input are not equal")
	}

}
