package snappystream

import (
	"bufio"
	"errors"
	"fmt"
	"hash/crc32"
	"io"

	"github.com/mreiferson/go-snappystream/snappy-go"
)

var errClosed = fmt.Errorf("closed")

// BufferedWriter is an io.WriteCloser with behavior similar to writers
// returned by NewWriter but it buffers written data, maximizing block size (to
// improve the output compression ratio) at the cost of speed. Benefits over
// NewWriter are most noticible when individual writes are small and when
// streams are long.
//
// Failure to call a BufferedWriter's Close or Flush methods after it is done
// being written to will likely result in missing data frames which will be
// undetectable in the decoding process.
//
// NOTE: BufferedWriter cannot be instantiated via struct literal and must
// use NewBufferedWriter (i.e. its zero value is not usable).
type BufferedWriter struct {
	err error
	w   *writer
	bw  *bufio.Writer
}

// NewBufferedWriter allocates and returns a BufferedWriter with an internal
// buffer of MaxBlockSize bytes.  If an error occurs writing a block to w, all
// future writes will fail with the same error.  After all data has been
// written, the client should call the Flush method to guarantee all data has
// been forwarded to the underlying io.Writer.
func NewBufferedWriter(w io.Writer) *BufferedWriter {
	_w := NewWriter(w).(*writer)
	return &BufferedWriter{
		w:  _w,
		bw: bufio.NewWriterSize(_w, MaxBlockSize),
	}
}

// ReadFrom implements the io.ReaderFrom interface used by io.Copy. It encodes
// data read from r as a snappy framed stream that is written to the underlying
// writer.  ReadFrom returns the number number of bytes read, along with any
// error encountered (other than io.EOF).
func (w *BufferedWriter) ReadFrom(r io.Reader) (int64, error) {
	if w.err != nil {
		return 0, w.err
	}

	var n int64
	n, w.err = w.bw.ReadFrom(r)
	return n, w.err
}

// Write buffers p internally, encoding and writing a block to the underlying
// buffer if the buffer grows beyond MaxBlockSize bytes.  The returned int
// will be 0 if there was an error and len(p) otherwise.
func (w *BufferedWriter) Write(p []byte) (int, error) {
	if w.err != nil {
		return 0, w.err
	}

	_, w.err = w.bw.Write(p)
	if w.err != nil {
		return 0, w.err
	}

	return len(p), nil
}

// Flush encodes and writes a block with the contents of w's internal buffer to
// the underlying writer even if the buffer does not contain a full block of
// data (MaxBlockSize bytes).
func (w *BufferedWriter) Flush() error {
	if w.err == nil {
		w.err = w.bw.Flush()
	}

	return w.err
}

// Close flushes w's internal buffer and tears down internal data structures.
// After a successful call to Close method calls on w return an error.  Close
// makes no attempt to close the underlying writer.
func (w *BufferedWriter) Close() error {
	if w.err != nil {
		return w.err
	}

	w.err = w.bw.Flush()
	w.w = nil
	w.bw = nil

	if w.err != nil {
		return w.err
	}

	w.err = errClosed
	return nil
}

type writer struct {
	writer io.Writer
	err    error

	hdr []byte
	dst []byte

	sentStreamID bool
}

// NewWriter returns an io.Writer that writes its input to an underlying
// io.Writer encoded as a snappy framed stream.  A stream identifier block is
// written to w preceding the first data block.  The returned writer will never
// emit a block with length in bytes greater than MaxBlockSize+4 nor one
// containing more than MaxBlockSize bytes of (uncompressed) data.
//
// For each Write, the returned length will only ever be len(p) or 0,
// regardless of the length of *compressed* bytes written to the wrapped
// io.Writer.  If the returned length is 0 then error will be non-nil.  If
// len(p) exceeds 65536, the slice will be automatically chunked into smaller
// blocks which are all emitted before the call returns.
func NewWriter(w io.Writer) io.Writer {
	return &writer{
		writer: w,

		hdr: make([]byte, 8),
		dst: make([]byte, 4096),
	}
}

func (w *writer) Write(p []byte) (int, error) {
	if w.err != nil {
		return 0, w.err
	}

	total := 0
	sz := MaxBlockSize
	var n int
	for i := 0; i < len(p); i += n {
		if i+sz > len(p) {
			sz = len(p) - i
		}

		n, w.err = w.write(p[i : i+sz])
		if w.err != nil {
			return 0, w.err
		}
		total += n
	}
	return total, nil
}

// write attempts to encode p as a block and write it to the underlying writer.
// The returned int may not equal p's length if compression below
// MaxBlockSize-4 could not be achieved.
func (w *writer) write(p []byte) (int, error) {
	var err error

	if len(p) > MaxBlockSize {
		return 0, errors.New(fmt.Sprintf("block too large %d > %d", len(p), MaxBlockSize))
	}

	w.dst = w.dst[:cap(w.dst)] // Encode does dumb resize w/o context. reslice avoids alloc.
	w.dst, err = snappy.Encode(w.dst, p)
	if err != nil {
		return 0, err
	}
	block := w.dst
	n := len(p)
	compressed := true

	// check for data which is better left uncompressed.  this is determined if
	// the encoded content is longer than the source.
	if len(w.dst) >= len(p) {
		compressed = false
		block = p[:n]
	}

	if !w.sentStreamID {
		_, err := w.writer.Write(streamID)
		if err != nil {
			return 0, err
		}
		w.sentStreamID = true
	}

	// set the block type
	if compressed {
		writeHeader(w.hdr, blockCompressed, block, p[:n])
	} else {
		writeHeader(w.hdr, blockUncompressed, block, p[:n])
	}

	_, err = w.writer.Write(w.hdr)
	if err != nil {
		return 0, err
	}

	_, err = w.writer.Write(block)
	if err != nil {
		return 0, err
	}

	return n, nil
}

// writeHeader panics if len(hdr) is less than 8.
func writeHeader(hdr []byte, btype byte, enc, dec []byte) {
	hdr[0] = btype

	// 3 byte little endian length of encoded content
	length := uint32(len(enc)) + 4 // +4 for checksum
	hdr[1] = byte(length)
	hdr[2] = byte(length >> 8)
	hdr[3] = byte(length >> 16)

	// 4 byte little endian CRC32 checksum of decoded content
	checksum := maskChecksum(crc32.Checksum(dec, crcTable))
	hdr[4] = byte(checksum)
	hdr[5] = byte(checksum >> 8)
	hdr[6] = byte(checksum >> 16)
	hdr[7] = byte(checksum >> 24)
}
