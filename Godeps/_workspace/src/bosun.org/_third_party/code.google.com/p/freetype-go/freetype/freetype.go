// Copyright 2010 The Freetype-Go Authors. All rights reserved.
// Use of this source code is governed by your choice of either the
// FreeType License or the GNU General Public License version 2 (or
// any later version), both of which can be found in the LICENSE file.

// The freetype package provides a convenient API to draw text onto an image.
// Use the freetype/raster and freetype/truetype packages for lower level
// control over rasterization and TrueType parsing.
package freetype

import (
	"errors"
	"image"
	"image/draw"

	"bosun.org/_third_party/code.google.com/p/freetype-go/freetype/raster"
	"bosun.org/_third_party/code.google.com/p/freetype-go/freetype/truetype"
)

// These constants determine the size of the glyph cache. The cache is keyed
// primarily by the glyph index modulo nGlyphs, and secondarily by sub-pixel
// position for the mask image. Sub-pixel positions are quantized to
// nXFractions possible values in both the x and y directions.
const (
	nGlyphs     = 256
	nXFractions = 4
	nYFractions = 1
)

// An entry in the glyph cache is keyed explicitly by the glyph index and
// implicitly by the quantized x and y fractional offset. It maps to a mask
// image and an offset.
type cacheEntry struct {
	valid        bool
	glyph        truetype.Index
	advanceWidth raster.Fix32
	mask         *image.Alpha
	offset       image.Point
}

// ParseFont just calls the Parse function from the freetype/truetype package.
// It is provided here so that code that imports this package doesn't need
// to also include the freetype/truetype package.
func ParseFont(b []byte) (*truetype.Font, error) {
	return truetype.Parse(b)
}

// Pt converts from a co-ordinate pair measured in pixels to a raster.Point
// co-ordinate pair measured in raster.Fix32 units.
func Pt(x, y int) raster.Point {
	return raster.Point{
		X: raster.Fix32(x << 8),
		Y: raster.Fix32(y << 8),
	}
}

// Hinting is the policy for snapping a glyph's contours to pixel boundaries.
type Hinting int32

const (
	// NoHinting means to not perform any hinting.
	NoHinting = Hinting(truetype.NoHinting)
	// FullHinting means to use the font's hinting instructions.
	FullHinting = Hinting(truetype.FullHinting)
)

// A Context holds the state for drawing text in a given font and size.
type Context struct {
	r        *raster.Rasterizer
	font     *truetype.Font
	glyphBuf *truetype.GlyphBuf
	// clip is the clip rectangle for drawing.
	clip image.Rectangle
	// dst and src are the destination and source images for drawing.
	dst draw.Image
	src image.Image
	// fontSize and dpi are used to calculate scale. scale is the number of
	// 26.6 fixed point units in 1 em. hinting is the hinting policy.
	fontSize, dpi float64
	scale         int32
	hinting       Hinting
	// cache is the glyph cache.
	cache [nGlyphs * nXFractions * nYFractions]cacheEntry
}

// PointToFix32 converts the given number of points (as in ``a 12 point font'')
// into fixed point units.
func (c *Context) PointToFix32(x float64) raster.Fix32 {
	return raster.Fix32(x * float64(c.dpi) * (256.0 / 72.0))
}

// drawContour draws the given closed contour with the given offset.
func (c *Context) drawContour(ps []truetype.Point, dx, dy raster.Fix32) {
	if len(ps) == 0 {
		return
	}

	// The low bit of each point's Flags value is whether the point is on the
	// curve. Truetype fonts only have quadratic Bézier curves, not cubics.
	// Thus, two consecutive off-curve points imply an on-curve point in the
	// middle of those two.
	//
	// See http://chanae.walon.org/pub/ttf/ttf_glyphs.htm for more details.

	// ps[0] is a truetype.Point measured in FUnits and positive Y going
	// upwards. start is the same thing measured in fixed point units and
	// positive Y going downwards, and offset by (dx, dy).
	start := raster.Point{
		X: dx + raster.Fix32(ps[0].X<<2),
		Y: dy - raster.Fix32(ps[0].Y<<2),
	}
	others := []truetype.Point(nil)
	if ps[0].Flags&0x01 != 0 {
		others = ps[1:]
	} else {
		last := raster.Point{
			X: dx + raster.Fix32(ps[len(ps)-1].X<<2),
			Y: dy - raster.Fix32(ps[len(ps)-1].Y<<2),
		}
		if ps[len(ps)-1].Flags&0x01 != 0 {
			start = last
			others = ps[:len(ps)-1]
		} else {
			start = raster.Point{
				X: (start.X + last.X) / 2,
				Y: (start.Y + last.Y) / 2,
			}
			others = ps
		}
	}
	c.r.Start(start)
	q0, on0 := start, true
	for _, p := range others {
		q := raster.Point{
			X: dx + raster.Fix32(p.X<<2),
			Y: dy - raster.Fix32(p.Y<<2),
		}
		on := p.Flags&0x01 != 0
		if on {
			if on0 {
				c.r.Add1(q)
			} else {
				c.r.Add2(q0, q)
			}
		} else {
			if on0 {
				// No-op.
			} else {
				mid := raster.Point{
					X: (q0.X + q.X) / 2,
					Y: (q0.Y + q.Y) / 2,
				}
				c.r.Add2(q0, mid)
			}
		}
		q0, on0 = q, on
	}
	// Close the curve.
	if on0 {
		c.r.Add1(start)
	} else {
		c.r.Add2(q0, start)
	}
}

// rasterize returns the advance width, glyph mask and integer-pixel offset
// to render the given glyph at the given sub-pixel offsets.
// The 24.8 fixed point arguments fx and fy must be in the range [0, 1).
func (c *Context) rasterize(glyph truetype.Index, fx, fy raster.Fix32) (
	raster.Fix32, *image.Alpha, image.Point, error) {

	if err := c.glyphBuf.Load(c.font, c.scale, glyph, truetype.Hinting(c.hinting)); err != nil {
		return 0, nil, image.Point{}, err
	}
	// Calculate the integer-pixel bounds for the glyph.
	xmin := int(fx+raster.Fix32(c.glyphBuf.B.XMin<<2)) >> 8
	ymin := int(fy-raster.Fix32(c.glyphBuf.B.YMax<<2)) >> 8
	xmax := int(fx+raster.Fix32(c.glyphBuf.B.XMax<<2)+0xff) >> 8
	ymax := int(fy-raster.Fix32(c.glyphBuf.B.YMin<<2)+0xff) >> 8
	if xmin > xmax || ymin > ymax {
		return 0, nil, image.Point{}, errors.New("freetype: negative sized glyph")
	}
	// A TrueType's glyph's nodes can have negative co-ordinates, but the
	// rasterizer clips anything left of x=0 or above y=0. xmin and ymin
	// are the pixel offsets, based on the font's FUnit metrics, that let
	// a negative co-ordinate in TrueType space be non-negative in
	// rasterizer space. xmin and ymin are typically <= 0.
	fx += raster.Fix32(-xmin << 8)
	fy += raster.Fix32(-ymin << 8)
	// Rasterize the glyph's vectors.
	c.r.Clear()
	e0 := 0
	for _, e1 := range c.glyphBuf.End {
		c.drawContour(c.glyphBuf.Point[e0:e1], fx, fy)
		e0 = e1
	}
	a := image.NewAlpha(image.Rect(0, 0, xmax-xmin, ymax-ymin))
	c.r.Rasterize(raster.NewAlphaSrcPainter(a))
	return raster.Fix32(c.glyphBuf.AdvanceWidth << 2), a, image.Point{xmin, ymin}, nil
}

// glyph returns the advance width, glyph mask and integer-pixel offset to
// render the given glyph at the given sub-pixel point. It is a cache for the
// rasterize method. Unlike rasterize, p's co-ordinates do not have to be in
// the range [0, 1).
func (c *Context) glyph(glyph truetype.Index, p raster.Point) (
	raster.Fix32, *image.Alpha, image.Point, error) {

	// Split p.X and p.Y into their integer and fractional parts.
	ix, fx := int(p.X>>8), p.X&0xff
	iy, fy := int(p.Y>>8), p.Y&0xff
	// Calculate the index t into the cache array.
	tg := int(glyph) % nGlyphs
	tx := int(fx) / (256 / nXFractions)
	ty := int(fy) / (256 / nYFractions)
	t := ((tg*nXFractions)+tx)*nYFractions + ty
	// Check for a cache hit.
	if e := c.cache[t]; e.valid && e.glyph == glyph {
		return e.advanceWidth, e.mask, e.offset.Add(image.Point{ix, iy}), nil
	}
	// Rasterize the glyph and put the result into the cache.
	advanceWidth, mask, offset, err := c.rasterize(glyph, fx, fy)
	if err != nil {
		return 0, nil, image.Point{}, err
	}
	c.cache[t] = cacheEntry{true, glyph, advanceWidth, mask, offset}
	return advanceWidth, mask, offset.Add(image.Point{ix, iy}), nil
}

// DrawString draws s at p and returns p advanced by the text extent. The text
// is placed so that the left edge of the em square of the first character of s
// and the baseline intersect at p. The majority of the affected pixels will be
// above and to the right of the point, but some may be below or to the left.
// For example, drawing a string that starts with a 'J' in an italic font may
// affect pixels below and left of the point.
// p is a raster.Point and can therefore represent sub-pixel positions.
func (c *Context) DrawString(s string, p raster.Point) (raster.Point, error) {
	if c.font == nil {
		return raster.Point{}, errors.New("freetype: DrawText called with a nil font")
	}
	prev, hasPrev := truetype.Index(0), false
	for _, rune := range s {
		index := c.font.Index(rune)
		if hasPrev {
			kern := raster.Fix32(c.font.Kerning(c.scale, prev, index)) << 2
			if c.hinting != NoHinting {
				kern = (kern + 128) &^ 255
			}
			p.X += kern
		}
		advanceWidth, mask, offset, err := c.glyph(index, p)
		if err != nil {
			return raster.Point{}, err
		}
		p.X += advanceWidth
		glyphRect := mask.Bounds().Add(offset)
		dr := c.clip.Intersect(glyphRect)
		if !dr.Empty() {
			mp := image.Point{0, dr.Min.Y - glyphRect.Min.Y}
			draw.DrawMask(c.dst, dr, c.src, image.ZP, mask, mp, draw.Over)
		}
		prev, hasPrev = index, true
	}
	return p, nil
}

// recalc recalculates scale and bounds values from the font size, screen
// resolution and font metrics, and invalidates the glyph cache.
func (c *Context) recalc() {
	c.scale = int32(c.fontSize * c.dpi * (64.0 / 72.0))
	if c.font == nil {
		c.r.SetBounds(0, 0)
	} else {
		// Set the rasterizer's bounds to be big enough to handle the largest glyph.
		b := c.font.Bounds(c.scale)
		xmin := +int(b.XMin) >> 6
		ymin := -int(b.YMax) >> 6
		xmax := +int(b.XMax+63) >> 6
		ymax := -int(b.YMin-63) >> 6
		c.r.SetBounds(xmax-xmin, ymax-ymin)
	}
	for i := range c.cache {
		c.cache[i] = cacheEntry{}
	}
}

// SetDPI sets the screen resolution in dots per inch.
func (c *Context) SetDPI(dpi float64) {
	if c.dpi == dpi {
		return
	}
	c.dpi = dpi
	c.recalc()
}

// SetFont sets the font used to draw text.
func (c *Context) SetFont(font *truetype.Font) {
	if c.font == font {
		return
	}
	c.font = font
	c.recalc()
}

// SetFontSize sets the font size in points (as in ``a 12 point font'').
func (c *Context) SetFontSize(fontSize float64) {
	if c.fontSize == fontSize {
		return
	}
	c.fontSize = fontSize
	c.recalc()
}

// SetHinting sets the hinting policy.
func (c *Context) SetHinting(hinting Hinting) {
	c.hinting = hinting
	for i := range c.cache {
		c.cache[i] = cacheEntry{}
	}
}

// SetDst sets the destination image for draw operations.
func (c *Context) SetDst(dst draw.Image) {
	c.dst = dst
}

// SetSrc sets the source image for draw operations. This is typically an
// image.Uniform.
func (c *Context) SetSrc(src image.Image) {
	c.src = src
}

// SetClip sets the clip rectangle for drawing.
func (c *Context) SetClip(clip image.Rectangle) {
	c.clip = clip
}

// TODO(nigeltao): implement Context.SetGamma.

// NewContext creates a new Context.
func NewContext() *Context {
	return &Context{
		r:        raster.NewRasterizer(0, 0),
		glyphBuf: truetype.NewGlyphBuf(),
		fontSize: 12,
		dpi:      72,
		scale:    12 << 6,
	}
}
