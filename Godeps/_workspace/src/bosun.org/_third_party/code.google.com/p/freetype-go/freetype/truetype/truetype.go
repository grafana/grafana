// Copyright 2010 The Freetype-Go Authors. All rights reserved.
// Use of this source code is governed by your choice of either the
// FreeType License or the GNU General Public License version 2 (or
// any later version), both of which can be found in the LICENSE file.

// Package truetype provides a parser for the TTF and TTC file formats.
// Those formats are documented at http://developer.apple.com/fonts/TTRefMan/
// and http://www.microsoft.com/typography/otspec/
//
// Some of a font's methods provide lengths or co-ordinates, e.g. bounds, font
// metrics and control points. All these methods take a scale parameter, which
// is the number of device units in 1 em. For example, if 1 em is 10 pixels and
// 1 pixel is 64 units, then scale is 640. If the device space involves pixels,
// 64 units per pixel is recommended, since that is what the bytecode hinter
// uses when snapping point co-ordinates to the pixel grid.
//
// To measure a TrueType font in ideal FUnit space, use scale equal to
// font.FUnitsPerEm().
package truetype

import (
	"fmt"
)

// An Index is a Font's index of a rune.
type Index uint16

// A Bounds holds the co-ordinate range of one or more glyphs.
// The endpoints are inclusive.
type Bounds struct {
	XMin, YMin, XMax, YMax int32
}

// An HMetric holds the horizontal metrics of a single glyph.
type HMetric struct {
	AdvanceWidth, LeftSideBearing int32
}

// A VMetric holds the vertical metrics of a single glyph.
type VMetric struct {
	AdvanceHeight, TopSideBearing int32
}

// A FormatError reports that the input is not a valid TrueType font.
type FormatError string

func (e FormatError) Error() string {
	return "freetype: invalid TrueType format: " + string(e)
}

// An UnsupportedError reports that the input uses a valid but unimplemented
// TrueType feature.
type UnsupportedError string

func (e UnsupportedError) Error() string {
	return "freetype: unsupported TrueType feature: " + string(e)
}

// u32 returns the big-endian uint32 at b[i:].
func u32(b []byte, i int) uint32 {
	return uint32(b[i])<<24 | uint32(b[i+1])<<16 | uint32(b[i+2])<<8 | uint32(b[i+3])
}

// u16 returns the big-endian uint16 at b[i:].
func u16(b []byte, i int) uint16 {
	return uint16(b[i])<<8 | uint16(b[i+1])
}

// readTable returns a slice of the TTF data given by a table's directory entry.
func readTable(ttf []byte, offsetLength []byte) ([]byte, error) {
	offset := int(u32(offsetLength, 0))
	if offset < 0 {
		return nil, FormatError(fmt.Sprintf("offset too large: %d", uint32(offset)))
	}
	length := int(u32(offsetLength, 4))
	if length < 0 {
		return nil, FormatError(fmt.Sprintf("length too large: %d", uint32(length)))
	}
	end := offset + length
	if end < 0 || end > len(ttf) {
		return nil, FormatError(fmt.Sprintf("offset + length too large: %d", uint32(offset)+uint32(length)))
	}
	return ttf[offset:end], nil
}

const (
	locaOffsetFormatUnknown int = iota
	locaOffsetFormatShort
	locaOffsetFormatLong
)

// A cm holds a parsed cmap entry.
type cm struct {
	start, end, delta, offset uint32
}

// A Font represents a Truetype font.
type Font struct {
	// Tables sliced from the TTF data. The different tables are documented
	// at http://developer.apple.com/fonts/TTRefMan/RM06/Chap6.html
	cmap, cvt, fpgm, glyf, hdmx, head, hhea, hmtx, kern, loca, maxp, os2, prep, vmtx []byte

	cmapIndexes []byte

	// Cached values derived from the raw ttf data.
	cm                      []cm
	locaOffsetFormat        int
	nGlyph, nHMetric, nKern int
	fUnitsPerEm             int32
	bounds                  Bounds
	// Values from the maxp section.
	maxTwilightPoints, maxStorage, maxFunctionDefs, maxStackElements uint16
}

func (f *Font) parseCmap() error {
	const (
		cmapFormat4         = 4
		cmapFormat12        = 12
		languageIndependent = 0

		// A 32-bit encoding consists of a most-significant 16-bit Platform ID and a
		// least-significant 16-bit Platform Specific ID. The magic numbers are
		// specified at https://www.microsoft.com/typography/otspec/name.htm
		unicodeEncoding         = 0x00000003 // PID = 0 (Unicode), PSID = 3 (Unicode 2.0)
		microsoftSymbolEncoding = 0x00030000 // PID = 3 (Microsoft), PSID = 0 (Symbol)
		microsoftUCS2Encoding   = 0x00030001 // PID = 3 (Microsoft), PSID = 1 (UCS-2)
		microsoftUCS4Encoding   = 0x0003000a // PID = 3 (Microsoft), PSID = 10 (UCS-4)
	)

	if len(f.cmap) < 4 {
		return FormatError("cmap too short")
	}
	nsubtab := int(u16(f.cmap, 2))
	if len(f.cmap) < 8*nsubtab+4 {
		return FormatError("cmap too short")
	}
	offset, found, x := 0, false, 4
	for i := 0; i < nsubtab; i++ {
		// We read the 16-bit Platform ID and 16-bit Platform Specific ID as a single uint32.
		// All values are big-endian.
		pidPsid, o := u32(f.cmap, x), u32(f.cmap, x+4)
		x += 8
		// We prefer the Unicode cmap encoding. Failing to find that, we fall
		// back onto the Microsoft cmap encoding.
		if pidPsid == unicodeEncoding {
			offset, found = int(o), true
			break

		} else if pidPsid == microsoftSymbolEncoding ||
			pidPsid == microsoftUCS2Encoding ||
			pidPsid == microsoftUCS4Encoding {

			offset, found = int(o), true
			// We don't break out of the for loop, so that Unicode can override Microsoft.
		}
	}
	if !found {
		return UnsupportedError("cmap encoding")
	}
	if offset <= 0 || offset > len(f.cmap) {
		return FormatError("bad cmap offset")
	}

	cmapFormat := u16(f.cmap, offset)
	switch cmapFormat {
	case cmapFormat4:
		language := u16(f.cmap, offset+4)
		if language != languageIndependent {
			return UnsupportedError(fmt.Sprintf("language: %d", language))
		}
		segCountX2 := int(u16(f.cmap, offset+6))
		if segCountX2%2 == 1 {
			return FormatError(fmt.Sprintf("bad segCountX2: %d", segCountX2))
		}
		segCount := segCountX2 / 2
		offset += 14
		f.cm = make([]cm, segCount)
		for i := 0; i < segCount; i++ {
			f.cm[i].end = uint32(u16(f.cmap, offset))
			offset += 2
		}
		offset += 2
		for i := 0; i < segCount; i++ {
			f.cm[i].start = uint32(u16(f.cmap, offset))
			offset += 2
		}
		for i := 0; i < segCount; i++ {
			f.cm[i].delta = uint32(u16(f.cmap, offset))
			offset += 2
		}
		for i := 0; i < segCount; i++ {
			f.cm[i].offset = uint32(u16(f.cmap, offset))
			offset += 2
		}
		f.cmapIndexes = f.cmap[offset:]
		return nil

	case cmapFormat12:
		if u16(f.cmap, offset+2) != 0 {
			return FormatError(fmt.Sprintf("cmap format: % x", f.cmap[offset:offset+4]))
		}
		length := u32(f.cmap, offset+4)
		language := u32(f.cmap, offset+8)
		if language != languageIndependent {
			return UnsupportedError(fmt.Sprintf("language: %d", language))
		}
		nGroups := u32(f.cmap, offset+12)
		if length != 12*nGroups+16 {
			return FormatError("inconsistent cmap length")
		}
		offset += 16
		f.cm = make([]cm, nGroups)
		for i := uint32(0); i < nGroups; i++ {
			f.cm[i].start = u32(f.cmap, offset+0)
			f.cm[i].end = u32(f.cmap, offset+4)
			f.cm[i].delta = u32(f.cmap, offset+8) - f.cm[i].start
			offset += 12
		}
		return nil
	}
	return UnsupportedError(fmt.Sprintf("cmap format: %d", cmapFormat))
}

func (f *Font) parseHead() error {
	if len(f.head) != 54 {
		return FormatError(fmt.Sprintf("bad head length: %d", len(f.head)))
	}
	f.fUnitsPerEm = int32(u16(f.head, 18))
	f.bounds.XMin = int32(int16(u16(f.head, 36)))
	f.bounds.YMin = int32(int16(u16(f.head, 38)))
	f.bounds.XMax = int32(int16(u16(f.head, 40)))
	f.bounds.YMax = int32(int16(u16(f.head, 42)))
	switch i := u16(f.head, 50); i {
	case 0:
		f.locaOffsetFormat = locaOffsetFormatShort
	case 1:
		f.locaOffsetFormat = locaOffsetFormatLong
	default:
		return FormatError(fmt.Sprintf("bad indexToLocFormat: %d", i))
	}
	return nil
}

func (f *Font) parseHhea() error {
	if len(f.hhea) != 36 {
		return FormatError(fmt.Sprintf("bad hhea length: %d", len(f.hhea)))
	}
	f.nHMetric = int(u16(f.hhea, 34))
	if 4*f.nHMetric+2*(f.nGlyph-f.nHMetric) != len(f.hmtx) {
		return FormatError(fmt.Sprintf("bad hmtx length: %d", len(f.hmtx)))
	}
	return nil
}

func (f *Font) parseKern() error {
	// Apple's TrueType documentation (http://developer.apple.com/fonts/TTRefMan/RM06/Chap6kern.html) says:
	// "Previous versions of the 'kern' table defined both the version and nTables fields in the header
	// as UInt16 values and not UInt32 values. Use of the older format on the Mac OS is discouraged
	// (although AAT can sense an old kerning table and still make correct use of it). Microsoft
	// Windows still uses the older format for the 'kern' table and will not recognize the newer one.
	// Fonts targeted for the Mac OS only should use the new format; fonts targeted for both the Mac OS
	// and Windows should use the old format."
	// Since we expect that almost all fonts aim to be Windows-compatible, we only parse the "older" format,
	// just like the C Freetype implementation.
	if len(f.kern) == 0 {
		if f.nKern != 0 {
			return FormatError("bad kern table length")
		}
		return nil
	}
	if len(f.kern) < 18 {
		return FormatError("kern data too short")
	}
	version, offset := u16(f.kern, 0), 2
	if version != 0 {
		return UnsupportedError(fmt.Sprintf("kern version: %d", version))
	}
	n, offset := u16(f.kern, offset), offset+2
	if n != 1 {
		return UnsupportedError(fmt.Sprintf("kern nTables: %d", n))
	}
	offset += 2
	length, offset := int(u16(f.kern, offset)), offset+2
	coverage, offset := u16(f.kern, offset), offset+2
	if coverage != 0x0001 {
		// We only support horizontal kerning.
		return UnsupportedError(fmt.Sprintf("kern coverage: 0x%04x", coverage))
	}
	f.nKern, offset = int(u16(f.kern, offset)), offset+2
	if 6*f.nKern != length-14 {
		return FormatError("bad kern table length")
	}
	return nil
}

func (f *Font) parseMaxp() error {
	if len(f.maxp) != 32 {
		return FormatError(fmt.Sprintf("bad maxp length: %d", len(f.maxp)))
	}
	f.nGlyph = int(u16(f.maxp, 4))
	f.maxTwilightPoints = u16(f.maxp, 16)
	f.maxStorage = u16(f.maxp, 18)
	f.maxFunctionDefs = u16(f.maxp, 20)
	f.maxStackElements = u16(f.maxp, 24)
	return nil
}

// scale returns x divided by f.fUnitsPerEm, rounded to the nearest integer.
func (f *Font) scale(x int32) int32 {
	if x >= 0 {
		x += f.fUnitsPerEm / 2
	} else {
		x -= f.fUnitsPerEm / 2
	}
	return x / f.fUnitsPerEm
}

// Bounds returns the union of a Font's glyphs' bounds.
func (f *Font) Bounds(scale int32) Bounds {
	b := f.bounds
	b.XMin = f.scale(scale * b.XMin)
	b.YMin = f.scale(scale * b.YMin)
	b.XMax = f.scale(scale * b.XMax)
	b.YMax = f.scale(scale * b.YMax)
	return b
}

// FUnitsPerEm returns the number of FUnits in a Font's em-square's side.
func (f *Font) FUnitsPerEm() int32 {
	return f.fUnitsPerEm
}

// Index returns a Font's index for the given rune.
func (f *Font) Index(x rune) Index {
	c := uint32(x)
	for i, j := 0, len(f.cm); i < j; {
		h := i + (j-i)/2
		cm := &f.cm[h]
		if c < cm.start {
			j = h
		} else if cm.end < c {
			i = h + 1
		} else if cm.offset == 0 {
			return Index(c + cm.delta)
		} else {
			offset := int(cm.offset) + 2*(h-len(f.cm)+int(c-cm.start))
			return Index(u16(f.cmapIndexes, offset))
		}
	}
	return 0
}

// unscaledHMetric returns the unscaled horizontal metrics for the glyph with
// the given index.
func (f *Font) unscaledHMetric(i Index) (h HMetric) {
	j := int(i)
	if j < 0 || f.nGlyph <= j {
		return HMetric{}
	}
	if j >= f.nHMetric {
		p := 4 * (f.nHMetric - 1)
		return HMetric{
			AdvanceWidth:    int32(u16(f.hmtx, p)),
			LeftSideBearing: int32(int16(u16(f.hmtx, p+2*(j-f.nHMetric)+4))),
		}
	}
	return HMetric{
		AdvanceWidth:    int32(u16(f.hmtx, 4*j)),
		LeftSideBearing: int32(int16(u16(f.hmtx, 4*j+2))),
	}
}

// HMetric returns the horizontal metrics for the glyph with the given index.
func (f *Font) HMetric(scale int32, i Index) HMetric {
	h := f.unscaledHMetric(i)
	h.AdvanceWidth = f.scale(scale * h.AdvanceWidth)
	h.LeftSideBearing = f.scale(scale * h.LeftSideBearing)
	return h
}

// unscaledVMetric returns the unscaled vertical metrics for the glyph with
// the given index. yMax is the top of the glyph's bounding box.
func (f *Font) unscaledVMetric(i Index, yMax int32) (v VMetric) {
	j := int(i)
	if j < 0 || f.nGlyph <= j {
		return VMetric{}
	}
	if 4*j+4 <= len(f.vmtx) {
		return VMetric{
			AdvanceHeight:  int32(u16(f.vmtx, 4*j)),
			TopSideBearing: int32(int16(u16(f.vmtx, 4*j+2))),
		}
	}
	// The OS/2 table has grown over time.
	// https://developer.apple.com/fonts/TTRefMan/RM06/Chap6OS2.html
	// says that it was originally 68 bytes. Optional fields, including
	// the ascender and descender, are described at
	// http://www.microsoft.com/typography/otspec/os2.htm
	if len(f.os2) >= 72 {
		sTypoAscender := int32(int16(u16(f.os2, 68)))
		sTypoDescender := int32(int16(u16(f.os2, 70)))
		return VMetric{
			AdvanceHeight:  sTypoAscender - sTypoDescender,
			TopSideBearing: sTypoAscender - yMax,
		}
	}
	return VMetric{
		AdvanceHeight:  f.fUnitsPerEm,
		TopSideBearing: 0,
	}
}

// VMetric returns the vertical metrics for the glyph with the given index.
func (f *Font) VMetric(scale int32, i Index) VMetric {
	// TODO: should 0 be bounds.YMax?
	v := f.unscaledVMetric(i, 0)
	v.AdvanceHeight = f.scale(scale * v.AdvanceHeight)
	v.TopSideBearing = f.scale(scale * v.TopSideBearing)
	return v
}

// Kerning returns the kerning for the given glyph pair.
func (f *Font) Kerning(scale int32, i0, i1 Index) int32 {
	if f.nKern == 0 {
		return 0
	}
	g := uint32(i0)<<16 | uint32(i1)
	lo, hi := 0, f.nKern
	for lo < hi {
		i := (lo + hi) / 2
		ig := u32(f.kern, 18+6*i)
		if ig < g {
			lo = i + 1
		} else if ig > g {
			hi = i
		} else {
			return f.scale(scale * int32(int16(u16(f.kern, 22+6*i))))
		}
	}
	return 0
}

// Parse returns a new Font for the given TTF or TTC data.
//
// For TrueType Collections, the first font in the collection is parsed.
func Parse(ttf []byte) (font *Font, err error) {
	return parse(ttf, 0)
}

func parse(ttf []byte, offset int) (font *Font, err error) {
	if len(ttf)-offset < 12 {
		err = FormatError("TTF data is too short")
		return
	}
	originalOffset := offset
	magic, offset := u32(ttf, offset), offset+4
	switch magic {
	case 0x00010000:
		// No-op.
	case 0x74746366: // "ttcf" as a big-endian uint32.
		if originalOffset != 0 {
			err = FormatError("recursive TTC")
			return
		}
		ttcVersion, offset := u32(ttf, offset), offset+4
		if ttcVersion != 0x00010000 {
			// TODO: support TTC version 2.0, once I have such a .ttc file to test with.
			err = FormatError("bad TTC version")
			return
		}
		numFonts, offset := int(u32(ttf, offset)), offset+4
		if numFonts <= 0 {
			err = FormatError("bad number of TTC fonts")
			return
		}
		if len(ttf[offset:])/4 < numFonts {
			err = FormatError("TTC offset table is too short")
			return
		}
		// TODO: provide an API to select which font in a TrueType collection to return,
		// not just the first one. This may require an API to parse a TTC's name tables,
		// so users of this package can select the font in a TTC by name.
		offset = int(u32(ttf, offset))
		if offset <= 0 || offset > len(ttf) {
			err = FormatError("bad TTC offset")
			return
		}
		return parse(ttf, offset)
	default:
		err = FormatError("bad TTF version")
		return
	}
	n, offset := int(u16(ttf, offset)), offset+2
	if len(ttf) < 16*n+12 {
		err = FormatError("TTF data is too short")
		return
	}
	f := new(Font)
	// Assign the table slices.
	for i := 0; i < n; i++ {
		x := 16*i + 12
		switch string(ttf[x : x+4]) {
		case "cmap":
			f.cmap, err = readTable(ttf, ttf[x+8:x+16])
		case "cvt ":
			f.cvt, err = readTable(ttf, ttf[x+8:x+16])
		case "fpgm":
			f.fpgm, err = readTable(ttf, ttf[x+8:x+16])
		case "glyf":
			f.glyf, err = readTable(ttf, ttf[x+8:x+16])
		case "hdmx":
			f.hdmx, err = readTable(ttf, ttf[x+8:x+16])
		case "head":
			f.head, err = readTable(ttf, ttf[x+8:x+16])
		case "hhea":
			f.hhea, err = readTable(ttf, ttf[x+8:x+16])
		case "hmtx":
			f.hmtx, err = readTable(ttf, ttf[x+8:x+16])
		case "kern":
			f.kern, err = readTable(ttf, ttf[x+8:x+16])
		case "loca":
			f.loca, err = readTable(ttf, ttf[x+8:x+16])
		case "maxp":
			f.maxp, err = readTable(ttf, ttf[x+8:x+16])
		case "OS/2":
			f.os2, err = readTable(ttf, ttf[x+8:x+16])
		case "prep":
			f.prep, err = readTable(ttf, ttf[x+8:x+16])
		case "vmtx":
			f.vmtx, err = readTable(ttf, ttf[x+8:x+16])
		}
		if err != nil {
			return
		}
	}
	// Parse and sanity-check the TTF data.
	if err = f.parseHead(); err != nil {
		return
	}
	if err = f.parseMaxp(); err != nil {
		return
	}
	if err = f.parseCmap(); err != nil {
		return
	}
	if err = f.parseKern(); err != nil {
		return
	}
	if err = f.parseHhea(); err != nil {
		return
	}
	font = f
	return
}
