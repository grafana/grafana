// Copyright 2010 The Freetype-Go Authors. All rights reserved.
// Use of this source code is governed by your choice of either the
// FreeType License or the GNU General Public License version 2 (or
// any later version), both of which can be found in the LICENSE file.

package truetype

// Hinting is the policy for snapping a glyph's contours to pixel boundaries.
type Hinting int32

const (
	// NoHinting means to not perform any hinting.
	NoHinting Hinting = iota
	// FullHinting means to use the font's hinting instructions.
	FullHinting

	// TODO: implement VerticalHinting.
)

// A Point is a co-ordinate pair plus whether it is ``on'' a contour or an
// ``off'' control point.
type Point struct {
	X, Y int32
	// The Flags' LSB means whether or not this Point is ``on'' the contour.
	// Other bits are reserved for internal use.
	Flags uint32
}

// A GlyphBuf holds a glyph's contours. A GlyphBuf can be re-used to load a
// series of glyphs from a Font.
type GlyphBuf struct {
	// AdvanceWidth is the glyph's advance width.
	AdvanceWidth int32
	// B is the glyph's bounding box.
	B Bounds
	// Point contains all Points from all contours of the glyph. If
	// hinting was used to load a glyph then Unhinted contains those
	// Points before they were hinted, and InFontUnits contains those
	// Points before they were hinted and scaled.
	Point, Unhinted, InFontUnits []Point
	// End is the point indexes of the end point of each countour. The
	// length of End is the number of contours in the glyph. The i'th
	// contour consists of points Point[End[i-1]:End[i]], where End[-1]
	// is interpreted to mean zero.
	End []int

	font    *Font
	scale   int32
	hinting Hinting
	hinter  hinter
	// phantomPoints are the co-ordinates of the synthetic phantom points
	// used for hinting and bounding box calculations.
	phantomPoints [4]Point
	// pp1x is the X co-ordinate of the first phantom point. The '1' is
	// using 1-based indexing; pp1x is almost always phantomPoints[0].X.
	// TODO: eliminate this and consistently use phantomPoints[0].X.
	pp1x int32
	// metricsSet is whether the glyph's metrics have been set yet. For a
	// compound glyph, a sub-glyph may override the outer glyph's metrics.
	metricsSet bool
	// tmp is a scratch buffer.
	tmp []Point
}

// Flags for decoding a glyph's contours. These flags are documented at
// http://developer.apple.com/fonts/TTRefMan/RM06/Chap6glyf.html.
const (
	flagOnCurve = 1 << iota
	flagXShortVector
	flagYShortVector
	flagRepeat
	flagPositiveXShortVector
	flagPositiveYShortVector

	// The remaining flags are for internal use.
	flagTouchedX
	flagTouchedY
)

// The same flag bits (0x10 and 0x20) are overloaded to have two meanings,
// dependent on the value of the flag{X,Y}ShortVector bits.
const (
	flagThisXIsSame = flagPositiveXShortVector
	flagThisYIsSame = flagPositiveYShortVector
)

// Load loads a glyph's contours from a Font, overwriting any previously
// loaded contours for this GlyphBuf. scale is the number of 26.6 fixed point
// units in 1 em, i is the glyph index, and h is the hinting policy.
func (g *GlyphBuf) Load(f *Font, scale int32, i Index, h Hinting) error {
	g.Point = g.Point[:0]
	g.Unhinted = g.Unhinted[:0]
	g.InFontUnits = g.InFontUnits[:0]
	g.End = g.End[:0]
	g.font = f
	g.hinting = h
	g.scale = scale
	g.pp1x = 0
	g.phantomPoints = [4]Point{}
	g.metricsSet = false

	if h != NoHinting {
		if err := g.hinter.init(f, scale); err != nil {
			return err
		}
	}
	if err := g.load(0, i, true); err != nil {
		return err
	}
	// TODO: this selection of either g.pp1x or g.phantomPoints[0].X isn't ideal,
	// and should be cleaned up once we have all the testScaling tests passing,
	// plus additional tests for Freetype-Go's bounding boxes matching C Freetype's.
	pp1x := g.pp1x
	if h != NoHinting {
		pp1x = g.phantomPoints[0].X
	}
	if pp1x != 0 {
		for i := range g.Point {
			g.Point[i].X -= pp1x
		}
	}

	advanceWidth := g.phantomPoints[1].X - g.phantomPoints[0].X
	if h != NoHinting {
		if len(f.hdmx) >= 8 {
			if n := u32(f.hdmx, 4); n > 3+uint32(i) {
				for hdmx := f.hdmx[8:]; uint32(len(hdmx)) >= n; hdmx = hdmx[n:] {
					if int32(hdmx[0]) == scale>>6 {
						advanceWidth = int32(hdmx[2+i]) << 6
						break
					}
				}
			}
		}
		advanceWidth = (advanceWidth + 32) &^ 63
	}
	g.AdvanceWidth = advanceWidth

	// Set g.B to the 'control box', which is the bounding box of the Bézier
	// curves' control points. This is easier to calculate, no smaller than
	// and often equal to the tightest possible bounding box of the curves
	// themselves. This approach is what C Freetype does. We can't just scale
	// the nominal bounding box in the glyf data as the hinting process and
	// phantom point adjustment may move points outside of that box.
	if len(g.Point) == 0 {
		g.B = Bounds{}
	} else {
		p := g.Point[0]
		g.B.XMin = p.X
		g.B.XMax = p.X
		g.B.YMin = p.Y
		g.B.YMax = p.Y
		for _, p := range g.Point[1:] {
			if g.B.XMin > p.X {
				g.B.XMin = p.X
			} else if g.B.XMax < p.X {
				g.B.XMax = p.X
			}
			if g.B.YMin > p.Y {
				g.B.YMin = p.Y
			} else if g.B.YMax < p.Y {
				g.B.YMax = p.Y
			}
		}
		// Snap the box to the grid, if hinting is on.
		if h != NoHinting {
			g.B.XMin &^= 63
			g.B.YMin &^= 63
			g.B.XMax += 63
			g.B.XMax &^= 63
			g.B.YMax += 63
			g.B.YMax &^= 63
		}
	}
	return nil
}

func (g *GlyphBuf) load(recursion int32, i Index, useMyMetrics bool) (err error) {
	// The recursion limit here is arbitrary, but defends against malformed glyphs.
	if recursion >= 32 {
		return UnsupportedError("excessive compound glyph recursion")
	}
	// Find the relevant slice of g.font.glyf.
	var g0, g1 uint32
	if g.font.locaOffsetFormat == locaOffsetFormatShort {
		g0 = 2 * uint32(u16(g.font.loca, 2*int(i)))
		g1 = 2 * uint32(u16(g.font.loca, 2*int(i)+2))
	} else {
		g0 = u32(g.font.loca, 4*int(i))
		g1 = u32(g.font.loca, 4*int(i)+4)
	}

	// Decode the contour count and nominal bounding box, from the first
	// 10 bytes of the glyf data. boundsYMin and boundsXMax, at offsets 4
	// and 6, are unused.
	glyf, ne, boundsXMin, boundsYMax := []byte(nil), 0, int32(0), int32(0)
	if g0+10 <= g1 {
		glyf = g.font.glyf[g0:g1]
		ne = int(int16(u16(glyf, 0)))
		boundsXMin = int32(int16(u16(glyf, 2)))
		boundsYMax = int32(int16(u16(glyf, 8)))
	}

	// Create the phantom points.
	uhm, pp1x := g.font.unscaledHMetric(i), int32(0)
	uvm := g.font.unscaledVMetric(i, boundsYMax)
	g.phantomPoints = [4]Point{
		{X: boundsXMin - uhm.LeftSideBearing},
		{X: boundsXMin - uhm.LeftSideBearing + uhm.AdvanceWidth},
		{X: uhm.AdvanceWidth / 2, Y: boundsYMax + uvm.TopSideBearing},
		{X: uhm.AdvanceWidth / 2, Y: boundsYMax + uvm.TopSideBearing - uvm.AdvanceHeight},
	}
	if len(glyf) == 0 {
		g.addPhantomsAndScale(len(g.Point), len(g.Point), true, true)
		copy(g.phantomPoints[:], g.Point[len(g.Point)-4:])
		g.Point = g.Point[:len(g.Point)-4]
		return nil
	}

	// Load and hint the contours.
	if ne < 0 {
		if ne != -1 {
			// http://developer.apple.com/fonts/TTRefMan/RM06/Chap6glyf.html says that
			// "the values -2, -3, and so forth, are reserved for future use."
			return UnsupportedError("negative number of contours")
		}
		pp1x = g.font.scale(g.scale * (boundsXMin - uhm.LeftSideBearing))
		if err := g.loadCompound(recursion, uhm, i, glyf, useMyMetrics); err != nil {
			return err
		}
	} else {
		np0, ne0 := len(g.Point), len(g.End)
		program := g.loadSimple(glyf, ne)
		g.addPhantomsAndScale(np0, np0, true, true)
		pp1x = g.Point[len(g.Point)-4].X
		if g.hinting != NoHinting {
			if len(program) != 0 {
				err := g.hinter.run(
					program,
					g.Point[np0:],
					g.Unhinted[np0:],
					g.InFontUnits[np0:],
					g.End[ne0:],
				)
				if err != nil {
					return err
				}
			}
			// Drop the four phantom points.
			g.InFontUnits = g.InFontUnits[:len(g.InFontUnits)-4]
			g.Unhinted = g.Unhinted[:len(g.Unhinted)-4]
		}
		if useMyMetrics {
			copy(g.phantomPoints[:], g.Point[len(g.Point)-4:])
		}
		g.Point = g.Point[:len(g.Point)-4]
		if np0 != 0 {
			// The hinting program expects the []End values to be indexed relative
			// to the inner glyph, not the outer glyph, so we delay adding np0 until
			// after the hinting program (if any) has run.
			for i := ne0; i < len(g.End); i++ {
				g.End[i] += np0
			}
		}
	}
	if useMyMetrics && !g.metricsSet {
		g.metricsSet = true
		g.pp1x = pp1x
	}
	return nil
}

// loadOffset is the initial offset for loadSimple and loadCompound. The first
// 10 bytes are the number of contours and the bounding box.
const loadOffset = 10

func (g *GlyphBuf) loadSimple(glyf []byte, ne int) (program []byte) {
	offset := loadOffset
	for i := 0; i < ne; i++ {
		g.End = append(g.End, 1+int(u16(glyf, offset)))
		offset += 2
	}

	// Note the TrueType hinting instructions.
	instrLen := int(u16(glyf, offset))
	offset += 2
	program = glyf[offset : offset+instrLen]
	offset += instrLen

	np0 := len(g.Point)
	np1 := np0 + int(g.End[len(g.End)-1])

	// Decode the flags.
	for i := np0; i < np1; {
		c := uint32(glyf[offset])
		offset++
		g.Point = append(g.Point, Point{Flags: c})
		i++
		if c&flagRepeat != 0 {
			count := glyf[offset]
			offset++
			for ; count > 0; count-- {
				g.Point = append(g.Point, Point{Flags: c})
				i++
			}
		}
	}

	// Decode the co-ordinates.
	var x int16
	for i := np0; i < np1; i++ {
		f := g.Point[i].Flags
		if f&flagXShortVector != 0 {
			dx := int16(glyf[offset])
			offset++
			if f&flagPositiveXShortVector == 0 {
				x -= dx
			} else {
				x += dx
			}
		} else if f&flagThisXIsSame == 0 {
			x += int16(u16(glyf, offset))
			offset += 2
		}
		g.Point[i].X = int32(x)
	}
	var y int16
	for i := np0; i < np1; i++ {
		f := g.Point[i].Flags
		if f&flagYShortVector != 0 {
			dy := int16(glyf[offset])
			offset++
			if f&flagPositiveYShortVector == 0 {
				y -= dy
			} else {
				y += dy
			}
		} else if f&flagThisYIsSame == 0 {
			y += int16(u16(glyf, offset))
			offset += 2
		}
		g.Point[i].Y = int32(y)
	}

	return program
}

func (g *GlyphBuf) loadCompound(recursion int32, uhm HMetric, i Index,
	glyf []byte, useMyMetrics bool) error {

	// Flags for decoding a compound glyph. These flags are documented at
	// http://developer.apple.com/fonts/TTRefMan/RM06/Chap6glyf.html.
	const (
		flagArg1And2AreWords = 1 << iota
		flagArgsAreXYValues
		flagRoundXYToGrid
		flagWeHaveAScale
		flagUnused
		flagMoreComponents
		flagWeHaveAnXAndYScale
		flagWeHaveATwoByTwo
		flagWeHaveInstructions
		flagUseMyMetrics
		flagOverlapCompound
	)
	np0, ne0 := len(g.Point), len(g.End)
	offset := loadOffset
	for {
		flags := u16(glyf, offset)
		component := Index(u16(glyf, offset+2))
		dx, dy, transform, hasTransform := int32(0), int32(0), [4]int32{}, false
		if flags&flagArg1And2AreWords != 0 {
			dx = int32(int16(u16(glyf, offset+4)))
			dy = int32(int16(u16(glyf, offset+6)))
			offset += 8
		} else {
			dx = int32(int16(int8(glyf[offset+4])))
			dy = int32(int16(int8(glyf[offset+5])))
			offset += 6
		}
		if flags&flagArgsAreXYValues == 0 {
			return UnsupportedError("compound glyph transform vector")
		}
		if flags&(flagWeHaveAScale|flagWeHaveAnXAndYScale|flagWeHaveATwoByTwo) != 0 {
			hasTransform = true
			switch {
			case flags&flagWeHaveAScale != 0:
				transform[0] = int32(int16(u16(glyf, offset+0)))
				transform[3] = transform[0]
				offset += 2
			case flags&flagWeHaveAnXAndYScale != 0:
				transform[0] = int32(int16(u16(glyf, offset+0)))
				transform[3] = int32(int16(u16(glyf, offset+2)))
				offset += 4
			case flags&flagWeHaveATwoByTwo != 0:
				transform[0] = int32(int16(u16(glyf, offset+0)))
				transform[1] = int32(int16(u16(glyf, offset+2)))
				transform[2] = int32(int16(u16(glyf, offset+4)))
				transform[3] = int32(int16(u16(glyf, offset+6)))
				offset += 8
			}
		}
		savedPP := g.phantomPoints
		np0 := len(g.Point)
		componentUMM := useMyMetrics && (flags&flagUseMyMetrics != 0)
		if err := g.load(recursion+1, component, componentUMM); err != nil {
			return err
		}
		if flags&flagUseMyMetrics == 0 {
			g.phantomPoints = savedPP
		}
		if hasTransform {
			for j := np0; j < len(g.Point); j++ {
				p := &g.Point[j]
				newX := int32((int64(p.X)*int64(transform[0])+1<<13)>>14) +
					int32((int64(p.Y)*int64(transform[2])+1<<13)>>14)
				newY := int32((int64(p.X)*int64(transform[1])+1<<13)>>14) +
					int32((int64(p.Y)*int64(transform[3])+1<<13)>>14)
				p.X, p.Y = newX, newY
			}
		}
		dx = g.font.scale(g.scale * dx)
		dy = g.font.scale(g.scale * dy)
		if flags&flagRoundXYToGrid != 0 {
			dx = (dx + 32) &^ 63
			dy = (dy + 32) &^ 63
		}
		for j := np0; j < len(g.Point); j++ {
			p := &g.Point[j]
			p.X += dx
			p.Y += dy
		}
		// TODO: also adjust g.InFontUnits and g.Unhinted?
		if flags&flagMoreComponents == 0 {
			break
		}
	}

	instrLen := 0
	if g.hinting != NoHinting && offset+2 <= len(glyf) {
		instrLen = int(u16(glyf, offset))
		offset += 2
	}

	g.addPhantomsAndScale(np0, len(g.Point), false, instrLen > 0)
	points, ends := g.Point[np0:], g.End[ne0:]
	g.Point = g.Point[:len(g.Point)-4]
	for j := range points {
		points[j].Flags &^= flagTouchedX | flagTouchedY
	}

	if instrLen == 0 {
		if !g.metricsSet {
			copy(g.phantomPoints[:], points[len(points)-4:])
		}
		return nil
	}

	// Hint the compound glyph.
	program := glyf[offset : offset+instrLen]
	// Temporarily adjust the ends to be relative to this compound glyph.
	if np0 != 0 {
		for i := range ends {
			ends[i] -= np0
		}
	}
	// Hinting instructions of a composite glyph completely refer to the
	// (already) hinted subglyphs.
	g.tmp = append(g.tmp[:0], points...)
	if err := g.hinter.run(program, points, g.tmp, g.tmp, ends); err != nil {
		return err
	}
	if np0 != 0 {
		for i := range ends {
			ends[i] += np0
		}
	}
	if !g.metricsSet {
		copy(g.phantomPoints[:], points[len(points)-4:])
	}
	return nil
}

func (g *GlyphBuf) addPhantomsAndScale(np0, np1 int, simple, adjust bool) {
	// Add the four phantom points.
	g.Point = append(g.Point, g.phantomPoints[:]...)
	// Scale the points.
	if simple && g.hinting != NoHinting {
		g.InFontUnits = append(g.InFontUnits, g.Point[np1:]...)
	}
	for i := np1; i < len(g.Point); i++ {
		p := &g.Point[i]
		p.X = g.font.scale(g.scale * p.X)
		p.Y = g.font.scale(g.scale * p.Y)
	}
	if g.hinting == NoHinting {
		return
	}
	// Round the 1st phantom point to the grid, shifting all other points equally.
	// Note that "all other points" starts from np0, not np1.
	// TODO: delete this adjustment and the np0/np1 distinction, when
	// we update the compatibility tests to C Freetype 2.5.3.
	// See http://git.savannah.gnu.org/cgit/freetype/freetype2.git/commit/?id=05c786d990390a7ca18e62962641dac740bacb06
	if adjust {
		pp1x := g.Point[len(g.Point)-4].X
		if dx := ((pp1x + 32) &^ 63) - pp1x; dx != 0 {
			for i := np0; i < len(g.Point); i++ {
				g.Point[i].X += dx
			}
		}
	}
	if simple {
		g.Unhinted = append(g.Unhinted, g.Point[np1:]...)
	}
	// Round the 2nd and 4th phantom point to the grid.
	p := &g.Point[len(g.Point)-3]
	p.X = (p.X + 32) &^ 63
	p = &g.Point[len(g.Point)-1]
	p.Y = (p.Y + 32) &^ 63
}

// TODO: is this necessary? The zero-valued GlyphBuf is perfectly usable.

// NewGlyphBuf returns a newly allocated GlyphBuf.
func NewGlyphBuf() *GlyphBuf {
	return &GlyphBuf{
		Point: make([]Point, 0, 256),
		End:   make([]int, 0, 32),
	}
}
