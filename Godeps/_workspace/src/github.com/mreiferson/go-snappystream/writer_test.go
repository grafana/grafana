package snappystream

import (
	"bytes"
	"io/ioutil"
	"log"
	"testing"
)

// This test ensures that all BufferedWriter methods fail after Close has been
// called.
func TestBufferedWriterClose(t *testing.T) {
	w := NewBufferedWriter(ioutil.Discard)
	err := w.Close()
	if err != nil {
		log.Fatalf("closing empty BufferedWriter: %v", err)
	}
	err = w.Close()
	if err == nil {
		log.Fatalf("successful close after close")
	}
	err = w.Flush()
	if err == nil {
		log.Fatalf("successful flush after close")
	}
	_, err = w.Write([]byte("abc"))
	if err == nil {
		log.Fatalf("successful write after close")
	}
}

// This test simply checks that buffering has an effect in a situation where it
// is know it should.
func TestBufferedWriter_compression(t *testing.T) {
	p := []byte("hello snappystream!")
	n := 10

	var shortbuf bytes.Buffer
	w := NewWriter(&shortbuf)
	for i := 0; i < n; i++ {
		n, err := w.Write(p)
		if err != nil {
			t.Fatalf("writer error: %v", err)
		}
		if n != len(p) {
			t.Fatalf("short write: %d", n)
		}
	}

	var buf bytes.Buffer
	bw := NewBufferedWriter(&buf)
	for i := 0; i < n; i++ {
		n, err := bw.Write(p)
		if err != nil {
			t.Fatalf("buffered writer error: %v", err)
		}
		if n != len(p) {
			t.Fatalf("short write: %d", n)
		}
	}
	err := bw.Close()
	if err != nil {
		t.Fatalf("closing buffer: %v", err)
	}

	uncompressed := int64(n) * int64(len(p))
	compressed := shortbuf.Len()
	bufcompressed := buf.Len()

	if compressed <= bufcompressed {
		t.Fatalf("no benefit from buffering (%d <= %d)", shortbuf.Len(), buf.Len())
	}

	c := float64(uncompressed) / float64(compressed)
	bufc := float64(uncompressed) / float64(bufcompressed)
	improved := bufc / c

	t.Logf("BufferedWriter compression ratio %g (%.03g factor improvement over %g)", bufc, improved, c)
}

// This tests ensures flushing after every write is equivalent to using
// NewWriter directly.
func TestBufferedWriterFlush(t *testing.T) {
	p := []byte("hello snappystream!")
	n := 10

	var shortbuf bytes.Buffer
	w := NewWriter(&shortbuf)
	for i := 0; i < n; i++ {
		n, err := w.Write(p)
		if err != nil {
			t.Fatalf("writer error: %v", err)
		}
		if n != len(p) {
			t.Fatalf("short write: %d", n)
		}
	}

	var buf bytes.Buffer
	bw := NewBufferedWriter(&buf)
	for i := 0; i < n; i++ {
		n, err := bw.Write(p)
		if err != nil {
			t.Fatalf("buffered writer error: %v", err)
		}
		if n != len(p) {
			t.Fatalf("short write: %d", n)
		}
		err = bw.Flush()
		if err != nil {
			t.Fatalf("flush: %v", err)
		}
	}
	err := bw.Close()
	if err != nil {
		t.Fatalf("closing buffer: %v", err)
	}

	if shortbuf.Len() != buf.Len() {
		t.Fatalf("unexpected size: %d != %d", shortbuf.Len(), buf.Len())
	}

	if !bytes.Equal(shortbuf.Bytes(), buf.Bytes()) {
		t.Fatalf("unexpected bytes")
	}
}
