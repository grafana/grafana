// snappystream wraps snappy-go and supplies a Reader and Writer
// for the snappy framed stream format:
//     https://snappy.googlecode.com/svn/trunk/framing_format.txt
package snappystream

import (
	"hash/crc32"

	"github.com/mreiferson/go-snappystream/snappy-go"
)

// Ext is the file extension for files whose content is a snappy framed stream.
const Ext = ".sz"

// MediaType is the MIME type used to represent snappy framed content.
const MediaType = "application/x-snappy-framed"

// ContentEncoding is the appropriate HTTP Content-Encoding header value for
// requests containing a snappy framed entity body.
const ContentEncoding = "x-snappy-framed"

// MaxBlockSize is the maximum number of decoded bytes allowed to be
// represented in a snappy framed block (sections 4.2 and 4.3).
const MaxBlockSize = 65536

// maxEncodedBlockSize is the maximum number of encoded bytes in a framed
// block.
var maxEncodedBlockSize = uint32(snappy.MaxEncodedLen(MaxBlockSize))

const VerifyChecksum = true
const SkipVerifyChecksum = false

// Block types defined by the snappy framed format specification.
const (
	blockCompressed       = 0x00
	blockUncompressed     = 0x01
	blockPadding          = 0xfe
	blockStreamIdentifier = 0xff
)

// streamID is the stream identifier block that begins a valid snappy framed
// stream.
var streamID = []byte{0xff, 0x06, 0x00, 0x00, 0x73, 0x4e, 0x61, 0x50, 0x70, 0x59}

// maskChecksum implements the checksum masking algorithm described by the spec.
func maskChecksum(c uint32) uint32 {
	return ((c >> 15) | (c << 17)) + 0xa282ead8
}

var crcTable *crc32.Table

func init() {
	crcTable = crc32.MakeTable(crc32.Castagnoli)
}
