package snappystream

import (
	"bytes"
	"fmt"
	"hash/crc32"
	"io"
	"io/ioutil"

	"github.com/mreiferson/go-snappystream/snappy-go"
)

// errMssingStreamID is returned from a reader when the source stream does not
// begin with a stream identifier block (4.1 Stream identifier).  Its occurance
// signifies that the source byte stream is not snappy framed.
var errMissingStreamID = fmt.Errorf("missing stream identifier")

type reader struct {
	reader io.Reader

	err error

	seenStreamID   bool
	verifyChecksum bool

	buf bytes.Buffer
	hdr []byte
	src []byte
	dst []byte
}

// NewReader returns an io.Reader interface to the snappy framed stream format.
//
// It transparently handles reading the stream identifier (but does not proxy this
// to the caller), decompresses blocks, and (optionally) validates checksums.
//
// Internally, three buffers are maintained.  The first two are for reading
// off the wrapped io.Reader and for holding the decompressed block (both are grown
// automatically and re-used and will never exceed the largest block size, 65536). The
// last buffer contains the *unread* decompressed bytes (and can grow indefinitely).
//
// The second param determines whether or not the reader will verify block
// checksums and can be enabled/disabled with the constants VerifyChecksum and SkipVerifyChecksum
//
// For each Read, the returned length will be up to the lesser of len(b) or 65536
// decompressed bytes, regardless of the length of *compressed* bytes read
// from the wrapped io.Reader.
func NewReader(r io.Reader, verifyChecksum bool) io.Reader {
	return &reader{
		reader: r,

		verifyChecksum: verifyChecksum,

		hdr: make([]byte, 4),
		src: make([]byte, 4096),
		dst: make([]byte, 4096),
	}
}

// WriteTo implements the io.WriterTo interface used by io.Copy.  It writes
// decoded data from the underlying reader to w.  WriteTo returns the number of
// bytes written along with any error encountered.
func (r *reader) WriteTo(w io.Writer) (int64, error) {
	if r.err != nil {
		return 0, r.err
	}

	n, err := r.buf.WriteTo(w)
	if err != nil {
		// r.err doesn't need to be set because a write error occurred and the
		// stream hasn't been corrupted.
		return n, err
	}

	// pass a bufferFallbackWriter to nextFrame so that write errors may be
	// recovered from, allowing the unwritten stream to be read successfully.
	wfallback := &bufferFallbackWriter{
		w:   w,
		buf: &r.buf,
	}
	for {
		var m int
		m, err = r.nextFrame(wfallback)
		if wfallback.writerErr != nil && err == nil {
			// a partial write was made before an error occurred and not all m
			// bytes were writen to w.  but decoded bytes were successfully
			// buffered and reading can resume later.
			n += wfallback.n
			return n, wfallback.writerErr
		}
		n += int64(m)
		if err == io.EOF {
			return n, nil
		}
		if err != nil {
			r.err = err
			return n, err
		}
	}
	panic("unreachable")
}

// bufferFallbackWriter writes to an underlying io.Writer until an error
// occurs.  If a error occurs in the underlying io.Writer the value is saved
// for later inspection while the bufferFallbackWriter silently starts
// buffering all data written to it. From the caller's perspective
// bufferFallbackWriter has the same Write behavior has a bytes.Buffer.
//
// bufferFallbackWriter is useful for the reader.WriteTo method because it
// allows internal decoding routines to avoid interruption (and subsequent
// stream corruption) due to writing errors.
type bufferFallbackWriter struct {
	w         io.Writer
	buf       *bytes.Buffer
	n         int64 // number of bytes successfully written to w
	writerErr error // any error that ocurred writing to w
}

// Write attempts to write b to the underlying io.Writer.  If the underlying
// writer fails or has failed previously unwritten bytes are buffered
// internally.  Write never returns an error but may panic with
// bytes.ErrTooLarge if the buffer grows too large.
func (w *bufferFallbackWriter) Write(b []byte) (int, error) {
	if w.writerErr != nil {
		return w.buf.Write(b)
	}
	n, err := w.w.Write(b)
	w.n += int64(n)
	if err != nil {
		// begin buffering input. bytes.Buffer does not return errors and so we
		// do not need complex error handling here.
		w.writerErr = err
		w.Write(b[n:])
		return len(b), nil
	}
	return n, nil
}

func (r *reader) read(b []byte) (int, error) {
	n, err := r.buf.Read(b)
	r.err = err
	return n, err
}

func (r *reader) Read(b []byte) (int, error) {
	if r.err != nil {
		return 0, r.err
	}

	if r.buf.Len() < len(b) {
		_, r.err = r.nextFrame(&r.buf)
		if r.err == io.EOF {
			// fill b with any remaining bytes in the buffer.
			return r.read(b)
		}
		if r.err != nil {
			return 0, r.err
		}
	}

	return r.read(b)
}

func (r *reader) nextFrame(w io.Writer) (int, error) {
	for {
		// read the 4-byte snappy frame header
		_, err := io.ReadFull(r.reader, r.hdr)
		if err != nil {
			return 0, err
		}

		// a stream identifier may appear anywhere and contains no information.
		// it must appear at the beginning of the stream.  when found, validate
		// it and continue to the next block.
		if r.hdr[0] == blockStreamIdentifier {
			err := r.readStreamID()
			if err != nil {
				return 0, err
			}
			r.seenStreamID = true
			continue
		}
		if !r.seenStreamID {
			return 0, errMissingStreamID
		}

		switch typ := r.hdr[0]; {
		case typ == blockCompressed || typ == blockUncompressed:
			return r.decodeBlock(w)
		case typ == blockPadding || (0x80 <= typ && typ <= 0xfd):
			// skip blocks whose data must not be inspected (4.4 Padding, and 4.6
			// Reserved skippable chunks).
			err := r.discardBlock()
			if err != nil {
				return 0, err
			}
			continue
		default:
			// typ must be unskippable range 0x02-0x7f.  Read the block in full
			// and return an error (4.5 Reserved unskippable chunks).
			err = r.discardBlock()
			if err != nil {
				return 0, err
			}
			return 0, fmt.Errorf("unrecognized unskippable frame %#x", r.hdr[0])
		}
	}
	panic("unreachable")
}

// decodeDataBlock assumes r.hdr[0] to be either blockCompressed or
// blockUncompressed.
func (r *reader) decodeBlock(w io.Writer) (int, error) {
	// read compressed block data and determine if uncompressed data is too
	// large.
	buf, err := r.readBlock()
	if err != nil {
		return 0, err
	}
	declen := len(buf[4:])
	if r.hdr[0] == blockCompressed {
		declen, err = snappy.DecodedLen(buf[4:])
		if err != nil {
			return 0, err
		}
	}
	if declen > MaxBlockSize {
		return 0, fmt.Errorf("decoded block data too large %d > %d", declen, MaxBlockSize)
	}

	// decode data and verify its integrity using the little-endian crc32
	// preceding encoded data
	crc32le, blockdata := buf[:4], buf[4:]
	if r.hdr[0] == blockCompressed {
		r.dst, err = snappy.Decode(r.dst, blockdata)
		if err != nil {
			return 0, err
		}
		blockdata = r.dst
	}
	if r.verifyChecksum {
		checksum := unmaskChecksum(uint32(crc32le[0]) | uint32(crc32le[1])<<8 | uint32(crc32le[2])<<16 | uint32(crc32le[3])<<24)
		actualChecksum := crc32.Checksum(blockdata, crcTable)
		if checksum != actualChecksum {
			return 0, fmt.Errorf("checksum does not match %x != %x", checksum, actualChecksum)
		}
	}
	return w.Write(blockdata)
}

func (r *reader) readStreamID() error {
	// the length of the block is fixed so don't decode it from the header.
	if !bytes.Equal(r.hdr, streamID[:4]) {
		return fmt.Errorf("invalid stream identifier length")
	}

	// read the identifier block data "sNaPpY"
	block := r.src[:6]
	_, err := noeof(io.ReadFull(r.reader, block))
	if err != nil {
		return err
	}
	if !bytes.Equal(block, streamID[4:]) {
		return fmt.Errorf("invalid stream identifier block")
	}
	return nil
}

func (r *reader) discardBlock() error {
	length := uint64(decodeLength(r.hdr[1:]))
	_, err := noeof64(io.CopyN(ioutil.Discard, r.reader, int64(length)))
	return err
}

func (r *reader) readBlock() ([]byte, error) {
	// check bounds on encoded length (+4 for checksum)
	length := decodeLength(r.hdr[1:])
	if length > (maxEncodedBlockSize + 4) {
		return nil, fmt.Errorf("encoded block data too large %d > %d", length, (maxEncodedBlockSize + 4))
	}

	if int(length) > len(r.src) {
		r.src = make([]byte, length)
	}

	buf := r.src[:length]
	_, err := noeof(io.ReadFull(r.reader, buf))
	if err != nil {
		return nil, err
	}

	return buf, nil
}

// decodeLength decodes a 24-bit (3-byte) little-endian length from b.
func decodeLength(b []byte) uint32 {
	return uint32(b[0]) | uint32(b[1])<<8 | uint32(b[2])<<16
}

func unmaskChecksum(c uint32) uint32 {
	x := c - 0xa282ead8
	return ((x >> 17) | (x << 15))
}

// noeof is used after reads in situations where EOF signifies invalid
// formatting or corruption.
func noeof(n int, err error) (int, error) {
	if err == io.EOF {
		return n, io.ErrUnexpectedEOF
	}
	return n, err
}

// noeof64 is used after long reads (e.g. io.Copy) in situations where io.EOF
// signifies invalid formatting or corruption.
func noeof64(n int64, err error) (int64, error) {
	if err == io.EOF {
		return n, io.ErrUnexpectedEOF
	}
	return n, err
}
