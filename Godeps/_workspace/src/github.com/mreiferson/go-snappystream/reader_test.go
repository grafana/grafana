package snappystream

import (
	"bytes"
	"crypto/rand"
	"fmt"
	"io"
	"io/ioutil"
	"strings"
	"testing"

	"github.com/mreiferson/go-snappystream/snappy-go"
)

// This test checks that padding and reserved skippable blocks are ignored by
// the reader.
func TestReader_skippable(t *testing.T) {
	var buf bytes.Buffer
	// write some blocks with injected padding/skippable blocks
	w := NewWriter(&buf)
	write := func(p []byte) (int, error) {
		return w.Write(p)
	}
	writepad := func(b byte, n int) (int, error) {
		return buf.Write(opaqueChunk(b, n))
	}
	_, err := write([]byte("hello"))
	if err != nil {
		t.Fatalf("write error: %v", err)
	}
	_, err = writepad(0xfe, 100) // normal padding
	if err != nil {
		t.Fatalf("write error: %v", err)
	}
	_, err = write([]byte(" "))
	if err != nil {
		t.Fatalf("write error: %v", err)
	}
	_, err = writepad(0xa0, 100) // reserved skippable block
	if err != nil {
		t.Fatalf("write error: %v", err)
	}
	_, err = writepad(0xfe, MaxBlockSize) // normal padding
	if err != nil {
		t.Fatalf("write error: %v", err)
	}
	_, err = write([]byte("padding"))
	if err != nil {
		t.Fatalf("write error: %v", err)
	}

	p, err := ioutil.ReadAll(NewReader(&buf, true))
	if err != nil {
		t.Fatalf("read error: %v", err)
	}
	if string(p) != "hello padding" {
		t.Fatalf("read: unexpected content %q", string(p))
	}
}

// This test checks that reserved unskippable blocks are cause decoder errors.
func TestReader_unskippable(t *testing.T) {
	var buf bytes.Buffer
	// write some blocks with injected padding/skippable blocks
	w := NewWriter(&buf)
	write := func(p []byte) (int, error) {
		return w.Write(p)
	}
	writepad := func(b byte, n int) (int, error) {
		return buf.Write(opaqueChunk(b, n))
	}
	_, err := write([]byte("unskippable"))
	if err != nil {
		t.Fatalf("write error: %v", err)
	}
	_, err = writepad(0x50, 100) // unskippable reserved block
	if err != nil {
		t.Fatalf("write error: %v", err)
	}
	_, err = write([]byte(" blocks"))
	if err != nil {
		t.Fatalf("write error: %v", err)
	}

	_, err = ioutil.ReadAll(NewReader(&buf, true))
	if err == nil {
		t.Fatalf("read success")
	}
}

func TestReaderStreamID(t *testing.T) {
	data := []byte("a snappy-framed data stream")
	var buf bytes.Buffer
	w := NewWriter(&buf)
	_, err := w.Write(data)
	if err != nil {
		t.Fatal(err)
	}

	stream := buf.Bytes()

	// sanity check: the stream can be decoded and starts with streamID
	r := NewReader(bytes.NewReader(stream), true)
	_, err = ioutil.ReadAll(r)
	if err != nil {
		t.Fatalf("read: %v", err)
	}
	if !bytes.HasPrefix(stream, streamID) {
		t.Fatal("missing stream id")
	}

	// streamNoID is valid except for a missing the streamID block
	streamNoID := bytes.TrimPrefix(stream, streamID)
	r = NewReader(bytes.NewReader(streamNoID), true)
	n, err := r.Read(make([]byte, 1))
	if err == nil {
		t.Fatalf("read: expected an error reading input missing a stream identifier block")
	}
	if n != 0 {
		t.Fatalf("read: read non-zero number of bytes %d", n)
	}
	n, err = r.Read(make([]byte, 1))
	if err == nil {
		t.Fatalf("read: successful read after missing stream id error")
	}
	if n != 0 {
		t.Fatalf("read: read non-zero number of bytes %d after missing stream id error", n)
	}
}

// This test validates the reader successfully decods a padding of maximal
// size, 2^24 - 1.
func TestReader_maxPad(t *testing.T) {
	buf := bytes.NewReader(bytes.Join([][]byte{
		streamID,
		compressedChunk(t, []byte("a maximal padding chunk")),
		opaqueChunk(0xfe, (1<<24)-1), // normal padding
		compressedChunk(t, []byte(" is decoded successfully")),
	}, nil))
	r := NewReader(buf, true)
	p, err := ioutil.ReadAll(r)
	if err != nil {
		t.Fatalf("read error: %v", err)
	}
	if string(p) != "a maximal padding chunk is decoded successfully" {
		t.Fatalf("read: unexpected content %q", string(p))
	}
}

// This test validates the reader successfully decodes a skippable chunk of
// maximal size, 2^24 - 1.
func TestReader_maxSkippable(t *testing.T) {
	buf := bytes.NewReader(bytes.Join([][]byte{
		streamID,
		compressedChunk(t, []byte("a maximal skippable chunk")),
		opaqueChunk(0xce, (1<<24)-1), // reserved skippable chunk
		compressedChunk(t, []byte(" is decoded successfully")),
	}, nil))
	r := NewReader(buf, true)
	p, err := ioutil.ReadAll(r)
	if err != nil {
		t.Fatalf("read error: %v", err)
	}
	if string(p) != "a maximal skippable chunk is decoded successfully" {
		t.Fatalf("read: unexpected content %q", string(p))
	}
}

// TestReader_maxBlock validates bounds checking on encoded and decoded data
// (4.2 Compressed Data).
func TestReader_maxBlock(t *testing.T) {
	// decompressing a block with compressed length greater than MaxBlockSize
	// should succeed.
	buf := bytes.NewReader(bytes.Join([][]byte{
		streamID,
		compressedChunkGreaterN(t, MaxBlockSize),
	}, nil))
	r := NewReader(buf, true)
	b, err := ioutil.ReadAll(r)
	if err != nil {
		t.Fatal(err)
	}
	if len(b) != MaxBlockSize {
		t.Fatalf("bad read (%d bytes)", len(b))
	}

	// decompressing should fail if the block with decompressed length greater
	// than MaxBlockSize.
	buf = bytes.NewReader(bytes.Join([][]byte{
		streamID,
		compressedChunk(t, make([]byte, MaxBlockSize+1)),
	}, nil))
	r = NewReader(buf, true)
	b, err = ioutil.ReadAll(r)
	if err == nil {
		t.Fatal("unexpected success")
	}
	if len(b) > 0 {
		t.Fatalf("unexpected read %q", b)
	}
}

// This test validates the reader's behavior encountering unskippable chunks of
// maximal size, 2^24 - 1.  The desired error to in this case is one reporting
// an unskippable chunk, not a length error.
func TestReader_maxUnskippable(t *testing.T) {
	// the first block should be decoded successfully.
	prefix := "a maximal unskippable chunk"
	buf := bytes.NewReader(bytes.Join([][]byte{
		streamID,
		compressedChunk(t, []byte(prefix)),
		opaqueChunk(0x03, (1<<24)-1), // low end of the unskippable range
		compressedChunk(t, []byte(" failure must be reported as such")),
	}, nil))
	p := make([]byte, len(prefix))
	r := NewReader(buf, true)
	n, err := r.Read(p)
	if err != nil {
		t.Fatalf("read error: %v", err)
	}
	if n != len(p) {
		t.Fatalf("read: short read %d", n)
	}
	if string(p) != prefix {
		t.Fatalf("read: bad value %q", p)
	}

	n, err = r.Read(p)
	if err == nil {
		t.Fatalf("read: expected error")
	}
	if n > 0 {
		t.Fatalf("read: read %d more bytes than expected", n)
	}
	if !strings.Contains(err.Error(), "unskippable") {
		t.Fatalf("read error: %v", err)
	}
}

// This test validates errors returned when data blocks exceed size limits.
func TestReader_blockTooLarge(t *testing.T) {
	// the compressed chunk size is within the allowed encoding size
	// (maxEncodedBlockSize). but the uncompressed data is larger than allowed.
	badstream := bytes.Join([][]byte{
		streamID,
		compressedChunk(t, make([]byte, (1<<24)-5)),
	}, nil)
	r := NewReader(bytes.NewBuffer(badstream), true)
	p := make([]byte, 1)
	n, err := r.Read(p)
	if err == nil {
		t.Fatalf("read: expected error")
	}
	if n != 0 {
		t.Fatalf("read: read data from the stream")
	}

	// the compressed chunk size is within the allowed encoding size
	// (maxEncodedBlockSize). but the uncompressed data is larger than allowed.
	badstream = bytes.Join([][]byte{
		streamID,
		uncompressedChunk(t, make([]byte, (1<<24)-5)),
	}, nil)
	r = NewReader(bytes.NewBuffer(badstream), true)
	p = make([]byte, 1)
	n, err = r.Read(p)
	if err == nil {
		t.Fatalf("read: expected error")
	}
	if n != 0 {
		t.Fatalf("read: read data from the stream")
	}
}

// This test validates the reader's handling of corrupt chunks.
func TestReader_corruption(t *testing.T) {
	// corruptID is a corrupt stream identifier
	corruptID := append([]byte(nil), streamID...)
	corruptID = bytes.Replace(streamID, []byte("p"), []byte("P"), -1) // corrupt "sNaPpY" data
	badstream := corruptID

	r := NewReader(bytes.NewBuffer(badstream), true)
	p := make([]byte, 1)
	n, err := r.Read(p)
	if err == nil {
		t.Fatalf("read: expected error")
	}
	if err == io.EOF {
		t.Fatalf("read: unexpected eof")
	}
	if n != 0 {
		t.Fatalf("read: read data from the stream")
	}

	corruptID = append([]byte(nil), streamID...) // corrupt the length
	corruptID[1] = 0x00
	badstream = corruptID

	r = NewReader(bytes.NewBuffer(badstream), true)
	p = make([]byte, 1)
	n, err = r.Read(p)
	if err == nil {
		t.Fatalf("read: expected error")
	}
	if err == io.EOF {
		t.Fatalf("read: unexpected eof")
	}
	if n != 0 {
		t.Fatalf("read: read data from the stream")
	}

	// chunk is a valid compressed block
	chunk := compressedChunk(t, []byte("a data block"))

	// corrupt is a corrupt chunk
	corrupt := append([]byte(nil), chunk...)
	copy(corrupt[8:], make([]byte, 10)) // corrupt snappy-encoded data
	badstream = bytes.Join([][]byte{
		streamID,
		corrupt,
	}, nil)

	r = NewReader(bytes.NewBuffer(badstream), true)
	p = make([]byte, 1)
	n, err = r.Read(p)
	if err == nil {
		t.Fatalf("read: expected error")
	}
	if err == io.EOF {
		t.Fatalf("read: unexpected eof")
	}
	if n != 0 {
		t.Fatalf("read: read data from the stream")
	}

	corrupt = append([]byte(nil), chunk...)
	copy(corrupt[4:8], make([]byte, 4)) // crc checksum failure
	badstream = bytes.Join([][]byte{
		streamID,
		corrupt,
	}, nil)

	r = NewReader(bytes.NewBuffer(badstream), true)
	p = make([]byte, 1)
	n, err = r.Read(p)
	if err == nil {
		t.Fatalf("read: expected error")
	}
	if err == io.EOF {
		t.Fatalf("read: unexpected eof")
	}
	if n != 0 {
		t.Fatalf("read: read data from the stream")
	}
}

// This test ensures that reader returns io.ErrUnexpectedEOF at the appropriate
// times. io.EOF must be reserved for the case when all data has been
// successfully decoded.
func TestReader_unexpectedEOF(t *testing.T) {
	var decodeBuffer [64 << 10]byte

	for _, test := range [][]byte{
		// truncated streamIDs
		streamID[:4],
		streamID[:len(streamID)-1],

		// truncated data blocks
		bytes.Join([][]byte{
			streamID,
			compressedChunk(t, bytes.Repeat([]byte("abc"), 100))[:2],
		}, nil),
		bytes.Join([][]byte{
			streamID,
			compressedChunk(t, bytes.Repeat([]byte("abc"), 100))[:7],
		}, nil),

		// truncated padding
		bytes.Join([][]byte{
			streamID,
			opaqueChunk(0xfe, 100)[:1],
		}, nil),
		bytes.Join([][]byte{
			streamID,
			opaqueChunk(0xfe, 100)[:8],
		}, nil),

		// truncated skippable chunk
		bytes.Join([][]byte{
			streamID,
			opaqueChunk(0xcf, 100)[:3],
		}, nil),
		bytes.Join([][]byte{
			streamID,
			opaqueChunk(0xcf, 100)[:7],
		}, nil),

		// truncated unskippable chunk
		bytes.Join([][]byte{
			streamID,
			opaqueChunk(0x03, 100)[:3],
		}, nil),
		bytes.Join([][]byte{
			streamID,
			opaqueChunk(0x03, 100)[:5],
		}, nil),
	} {
		r := NewReader(bytes.NewReader(test), true)
		n, err := r.Read(decodeBuffer[:])
		if err == nil {
			t.Errorf("read bad streamID: expected error")
		}
		if err != io.ErrUnexpectedEOF {
			t.Errorf("read bad streamID: %v", err)
		}
		if n != 0 {
			t.Errorf("read bad streamID: expected read length %d", n)
		}
	}
}

var errNotEnoughEntropy = fmt.Errorf("inadequate entropy in PRNG")

// compressedChunkGreaterN like compressedChunk produces a single, compressed,
// snappy-framed block. The returned block will have decoded length at most n
// and encoded length greater than n.
func compressedChunkGreaterN(t *testing.T, n int) []byte {
	decoded := make([]byte, n)
	var numTries int
	var encoded []byte
	for len(encoded) <= n && numTries < 3 {
		numTries++
		nrd, err := io.ReadFull(rand.Reader, decoded)
		if err != nil {
			t.Errorf("crypto/rand: %v", err)
			return nil
		}
		if nrd != n {
			t.Errorf("crypto/rand: bad read (%d bytes)", nrd)
			return nil
		}
		encoded, err = snappy.Encode(encoded[:cap(encoded)], decoded)
		if err != nil {
			t.Errorf("snappy: %v", err)
			return nil
		}
	}
	if len(encoded) <= n {
		t.Error(errNotEnoughEntropy)
		return nil
	}

	return compressedChunk(t, decoded)
}

// compressedChunk encodes b returning a single, compressed, snappy-framed
// block. compressedChunk can encode source data larger than allowed in the
// specification.
func compressedChunk(t *testing.T, src []byte) []byte {
	encoded, err := snappy.Encode(nil, src)
	if err != nil {
		t.Errorf("snappy: %v", err)
		return nil
	}

	if len(encoded) > (1<<24)-5 { // account for the 4-byte checksum
		t.Errorf("block data too large %d", len(src))
		return nil
	}

	chunk := make([]byte, len(encoded)+8)
	writeHeader(chunk[:8], blockCompressed, encoded, src)
	copy(chunk[8:], encoded)
	return chunk
}

// uncompressedChunk encodes b returning a single, uncompressed, snappy-framed
// block. uncompressedChunk can encode chunks larger than allowed by the
// specification.
func uncompressedChunk(t *testing.T, src []byte) []byte {
	if len(src) > (1<<24)-5 { // account for the 4-byte checksum
		t.Errorf("block data too large %d", len(src))
		return nil
	}

	chunk := make([]byte, len(src)+8)
	writeHeader(chunk[:8], blockUncompressed, src, src)
	copy(chunk[8:], src)
	return chunk
}

// opaqueChunk returns an opaque b chunk (e.g. padding 0xfe) with length n
// (total length, n+4 bytes).  practically useless but good enough for testing.
// the first 4-bytes of data are random to ensure checksums are not being
// verified.
func opaqueChunk(b byte, n int) []byte {
	if b == 0 {
		b = 0xfe
	}

	length := uint32(n)
	lengthle := []byte{byte(length), byte(length >> 8), byte(length >> 16)}
	checksum := make([]byte, 4)
	_, err := rand.Read(checksum)
	if err != nil {
		panic(err)
	}
	padbytes := make([]byte, n-4) // let this panic if n < 4
	_, err = rand.Read(padbytes)
	if err != nil {
		panic(err)
	}

	var h []byte
	h = append(h, b)
	h = append(h, lengthle...)
	h = append(h, checksum...)
	h = append(h, padbytes...)
	return h
}

func TestReaderWriteTo(t *testing.T) {
	var encbuf bytes.Buffer
	var decbuf bytes.Buffer
	msg := "hello copy interface"

	w := NewWriter(&encbuf)
	n, err := io.WriteString(w, msg)
	if err != nil {
		t.Fatalf("encode: %v", err)
	}
	if n != len(msg) {
		t.Fatalf("encode: %v", err)
	}

	r := NewReader(&encbuf, true)
	n64, err := r.(*reader).WriteTo(&decbuf)
	if err != nil {
		t.Fatalf("decode: %v", err)
	}
	if n64 != int64(len(msg)) {
		t.Fatalf("decode: decoded %d bytes %q", n64, decbuf.Bytes())
	}

	decmsg := decbuf.String()
	if decmsg != msg {
		t.Fatalf("decode: %q", decmsg)
	}
}

func TestReaderWriteToPreviousError(t *testing.T) {
	// construct an io.Reader that returns an error on the first read and a
	// valid snappy-framed stream on subsequent reads.
	var stream io.Reader
	stream = encodedString("hello")
	stream = readErrorFirst(stream, fmt.Errorf("one time error"))
	stream = NewReader(stream, true)

	var buf bytes.Buffer

	// attempt the first read from the stream.
	n, err := stream.(*reader).WriteTo(&buf)
	if err == nil {
		t.Fatalf("error expected")
	}
	if n != 0 {
		t.Fatalf("bytes written to buffer: %q", buf.Bytes())
	}

	// attempt a second read from the stream.
	n, err = stream.(*reader).WriteTo(&buf)
	if err == nil {
		t.Fatalf("error expected")
	}
	if n != 0 {
		t.Fatalf("bytes written to buffer: %q", buf.Bytes())
	}
}

// readerErrorFirst is an io.Reader that returns an error on the first read.
// readerErrorFirst is used to test that a reader does not attempt to read
// after a read error occurs.
type readerErrorFirst struct {
	r     io.Reader
	err   error
	count int
}

func readErrorFirst(r io.Reader, err error) io.Reader {
	return &readerErrorFirst{
		r:   r,
		err: err,
	}
}

func (r *readerErrorFirst) Read(b []byte) (int, error) {
	r.count++
	if r.count == 1 {
		return 0, r.err
	}
	return r.r.Read(b)
}

func TestReaderWriteToWriteError(t *testing.T) {
	origmsg := "hello"
	stream := NewReader(encodedString(origmsg), true)

	// attempt to write the stream to an io.Writer that will not accept input.
	n, err := stream.(*reader).WriteTo(unwritable(fmt.Errorf("cannot write to this writer")))
	if err == nil {
		t.Fatalf("error expected")
	}
	if n != 0 {
		t.Fatalf("reported %d written to an unwritable writer", n)
	}

	// the decoded message can still be read successfully because the encoded
	// stream was not corrupt/broken.
	var buf bytes.Buffer
	n, err = stream.(*reader).WriteTo(&buf)
	if err != nil {
		t.Errorf("unexpected error: %v", err)
	}
	if n != int64(len(origmsg)) {
		t.Errorf("read %d bytes", n)
	}
	if buf.String() != origmsg {
		t.Errorf("read %q", buf)
	}
}

// writerUnwritable is an io.Writer that always returns an error.
type writerUnwritable struct {
	err error
}

func (w *writerUnwritable) Write([]byte) (int, error) {
	return 0, w.err
}

func unwritable(err error) io.Writer {
	return &writerUnwritable{err}
}

func encodedString(s string) io.Reader {
	var buf bytes.Buffer
	w := NewWriter(&buf)
	io.WriteString(w, s)
	return &buf
}
