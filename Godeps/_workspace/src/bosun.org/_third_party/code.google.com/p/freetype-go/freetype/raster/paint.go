// Copyright 2010 The Freetype-Go Authors. All rights reserved.
// Use of this source code is governed by your choice of either the
// FreeType License or the GNU General Public License version 2 (or
// any later version), both of which can be found in the LICENSE file.

package raster

import (
	"image"
	"image/color"
	"image/draw"
	"math"
)

// A Span is a horizontal segment of pixels with constant alpha. X0 is an
// inclusive bound and X1 is exclusive, the same as for slices. A fully
// opaque Span has A == 1<<32 - 1.
type Span struct {
	Y, X0, X1 int
	A         uint32
}

// A Painter knows how to paint a batch of Spans. Rasterization may involve
// Painting multiple batches, and done will be true for the final batch.
// The Spans' Y values are monotonically increasing during a rasterization.
// Paint may use all of ss as scratch space during the call.
type Painter interface {
	Paint(ss []Span, done bool)
}

// The PainterFunc type adapts an ordinary function to the Painter interface.
type PainterFunc func(ss []Span, done bool)

// Paint just delegates the call to f.
func (f PainterFunc) Paint(ss []Span, done bool) { f(ss, done) }

// An AlphaOverPainter is a Painter that paints Spans onto an image.Alpha
// using the Over Porter-Duff composition operator.
type AlphaOverPainter struct {
	Image *image.Alpha
}

// Paint satisfies the Painter interface by painting ss onto an image.Alpha.
func (r AlphaOverPainter) Paint(ss []Span, done bool) {
	b := r.Image.Bounds()
	for _, s := range ss {
		if s.Y < b.Min.Y {
			continue
		}
		if s.Y >= b.Max.Y {
			return
		}
		if s.X0 < b.Min.X {
			s.X0 = b.Min.X
		}
		if s.X1 > b.Max.X {
			s.X1 = b.Max.X
		}
		if s.X0 >= s.X1 {
			continue
		}
		base := (s.Y-r.Image.Rect.Min.Y)*r.Image.Stride - r.Image.Rect.Min.X
		p := r.Image.Pix[base+s.X0 : base+s.X1]
		a := int(s.A >> 24)
		for i, c := range p {
			v := int(c)
			p[i] = uint8((v*255 + (255-v)*a) / 255)
		}
	}
}

// NewAlphaOverPainter creates a new AlphaOverPainter for the given image.
func NewAlphaOverPainter(m *image.Alpha) AlphaOverPainter {
	return AlphaOverPainter{m}
}

// An AlphaSrcPainter is a Painter that paints Spans onto an image.Alpha
// using the Src Porter-Duff composition operator.
type AlphaSrcPainter struct {
	Image *image.Alpha
}

// Paint satisfies the Painter interface by painting ss onto an image.Alpha.
func (r AlphaSrcPainter) Paint(ss []Span, done bool) {
	b := r.Image.Bounds()
	for _, s := range ss {
		if s.Y < b.Min.Y {
			continue
		}
		if s.Y >= b.Max.Y {
			return
		}
		if s.X0 < b.Min.X {
			s.X0 = b.Min.X
		}
		if s.X1 > b.Max.X {
			s.X1 = b.Max.X
		}
		if s.X0 >= s.X1 {
			continue
		}
		base := (s.Y-r.Image.Rect.Min.Y)*r.Image.Stride - r.Image.Rect.Min.X
		p := r.Image.Pix[base+s.X0 : base+s.X1]
		color := uint8(s.A >> 24)
		for i := range p {
			p[i] = color
		}
	}
}

// NewAlphaSrcPainter creates a new AlphaSrcPainter for the given image.
func NewAlphaSrcPainter(m *image.Alpha) AlphaSrcPainter {
	return AlphaSrcPainter{m}
}

type RGBAPainter struct {
	// The image to compose onto.
	Image *image.RGBA
	// The Porter-Duff composition operator.
	Op draw.Op
	// The 16-bit color to paint the spans.
	cr, cg, cb, ca uint32
}

// Paint satisfies the Painter interface by painting ss onto an image.RGBA.
func (r *RGBAPainter) Paint(ss []Span, done bool) {
	b := r.Image.Bounds()
	for _, s := range ss {
		if s.Y < b.Min.Y {
			continue
		}
		if s.Y >= b.Max.Y {
			return
		}
		if s.X0 < b.Min.X {
			s.X0 = b.Min.X
		}
		if s.X1 > b.Max.X {
			s.X1 = b.Max.X
		}
		if s.X0 >= s.X1 {
			continue
		}
		// This code is similar to drawGlyphOver in $GOROOT/src/pkg/image/draw/draw.go.
		ma := s.A >> 16
		const m = 1<<16 - 1
		i0 := (s.Y-r.Image.Rect.Min.Y)*r.Image.Stride + (s.X0-r.Image.Rect.Min.X)*4
		i1 := i0 + (s.X1-s.X0)*4
		if r.Op == draw.Over {
			for i := i0; i < i1; i += 4 {
				dr := uint32(r.Image.Pix[i+0])
				dg := uint32(r.Image.Pix[i+1])
				db := uint32(r.Image.Pix[i+2])
				da := uint32(r.Image.Pix[i+3])
				a := (m - (r.ca * ma / m)) * 0x101
				r.Image.Pix[i+0] = uint8((dr*a + r.cr*ma) / m >> 8)
				r.Image.Pix[i+1] = uint8((dg*a + r.cg*ma) / m >> 8)
				r.Image.Pix[i+2] = uint8((db*a + r.cb*ma) / m >> 8)
				r.Image.Pix[i+3] = uint8((da*a + r.ca*ma) / m >> 8)
			}
		} else {
			for i := i0; i < i1; i += 4 {
				r.Image.Pix[i+0] = uint8(r.cr * ma / m >> 8)
				r.Image.Pix[i+1] = uint8(r.cg * ma / m >> 8)
				r.Image.Pix[i+2] = uint8(r.cb * ma / m >> 8)
				r.Image.Pix[i+3] = uint8(r.ca * ma / m >> 8)
			}
		}
	}
}

// SetColor sets the color to paint the spans.
func (r *RGBAPainter) SetColor(c color.Color) {
	r.cr, r.cg, r.cb, r.ca = c.RGBA()
}

// NewRGBAPainter creates a new RGBAPainter for the given image.
func NewRGBAPainter(m *image.RGBA) *RGBAPainter {
	return &RGBAPainter{Image: m}
}

// A MonochromePainter wraps another Painter, quantizing each Span's alpha to
// be either fully opaque or fully transparent.
type MonochromePainter struct {
	Painter   Painter
	y, x0, x1 int
}

// Paint delegates to the wrapped Painter after quantizing each Span's alpha
// value and merging adjacent fully opaque Spans.
func (m *MonochromePainter) Paint(ss []Span, done bool) {
	// We compact the ss slice, discarding any Spans whose alpha quantizes to zero.
	j := 0
	for _, s := range ss {
		if s.A >= 1<<31 {
			if m.y == s.Y && m.x1 == s.X0 {
				m.x1 = s.X1
			} else {
				ss[j] = Span{m.y, m.x0, m.x1, 1<<32 - 1}
				j++
				m.y, m.x0, m.x1 = s.Y, s.X0, s.X1
			}
		}
	}
	if done {
		// Flush the accumulated Span.
		finalSpan := Span{m.y, m.x0, m.x1, 1<<32 - 1}
		if j < len(ss) {
			ss[j] = finalSpan
			j++
			m.Painter.Paint(ss[:j], true)
		} else if j == len(ss) {
			m.Painter.Paint(ss, false)
			if cap(ss) > 0 {
				ss = ss[:1]
			} else {
				ss = make([]Span, 1)
			}
			ss[0] = finalSpan
			m.Painter.Paint(ss, true)
		} else {
			panic("unreachable")
		}
		// Reset the accumulator, so that this Painter can be re-used.
		m.y, m.x0, m.x1 = 0, 0, 0
	} else {
		m.Painter.Paint(ss[:j], false)
	}
}

// NewMonochromePainter creates a new MonochromePainter that wraps the given
// Painter.
func NewMonochromePainter(p Painter) *MonochromePainter {
	return &MonochromePainter{Painter: p}
}

// A GammaCorrectionPainter wraps another Painter, performing gamma-correction
// on each Span's alpha value.
type GammaCorrectionPainter struct {
	// The wrapped Painter.
	Painter Painter
	// Precomputed alpha values for linear interpolation, with fully opaque == 1<<16-1.
	a [256]uint16
	// Whether gamma correction is a no-op.
	gammaIsOne bool
}

// Paint delegates to the wrapped Painter after performing gamma-correction
// on each Span.
func (g *GammaCorrectionPainter) Paint(ss []Span, done bool) {
	if !g.gammaIsOne {
		const (
			M = 0x1010101 // 255*M == 1<<32-1
			N = 0x8080    // N = M>>9, and N < 1<<16-1
		)
		for i, s := range ss {
			if s.A == 0 || s.A == 1<<32-1 {
				continue
			}
			p, q := s.A/M, (s.A%M)>>9
			// The resultant alpha is a linear interpolation of g.a[p] and g.a[p+1].
			a := uint32(g.a[p])*(N-q) + uint32(g.a[p+1])*q
			a = (a + N/2) / N
			// Convert the alpha from 16-bit (which is g.a's range) to 32-bit.
			a |= a << 16
			ss[i].A = a
		}
	}
	g.Painter.Paint(ss, done)
}

// SetGamma sets the gamma value.
func (g *GammaCorrectionPainter) SetGamma(gamma float64) {
	if gamma == 1.0 {
		g.gammaIsOne = true
		return
	}
	g.gammaIsOne = false
	for i := 0; i < 256; i++ {
		a := float64(i) / 0xff
		a = math.Pow(a, gamma)
		g.a[i] = uint16(0xffff * a)
	}
}

// NewGammaCorrectionPainter creates a new GammaCorrectionPainter that wraps
// the given Painter.
func NewGammaCorrectionPainter(p Painter, gamma float64) *GammaCorrectionPainter {
	g := &GammaCorrectionPainter{Painter: p}
	g.SetGamma(gamma)
	return g
}
