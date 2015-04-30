// Copyright 2010 The draw2d Authors. All rights reserved.
// created: 21/11/2010 by Laurent Le Goff

package draw2d

/*
import (
	"image/draw"
	"image"
	"freetype-go.googlecode.com/hg/freetype/raster"
)*/

const M = 1<<16 - 1

/*
type NRGBAPainter struct {
	// The image to compose onto.
	Image *image.NRGBA
	// The Porter-Duff composition operator.
	Op draw.Op
	// The 16-bit color to paint the spans.
	cr, cg, cb, ca uint32
}

// Paint satisfies the Painter interface by painting ss onto an image.RGBA.
func (r *NRGBAPainter) Paint(ss []raster.Span, done bool) {
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
		base := s.Y * r.Image.Stride
		p := r.Image.Pix[base+s.X0 : base+s.X1]
		// This code is duplicated from drawGlyphOver in $GOROOT/src/pkg/image/draw/draw.go.
		// TODO(nigeltao): Factor out common code into a utility function, once the compiler
		// can inline such function calls.
		ma := s.A >> 16
		if r.Op == draw.Over {
			for i, nrgba := range p {
				dr, dg, db, da := nrgba.
				a := M - (r.ca*ma)/M
				da = (da*a + r.ca*ma) / M
				if da != 0 {
					dr = minUint32(M, (dr*a+r.cr*ma)/da)
					dg = minUint32(M, (dg*a+r.cg*ma)/da)
					db = minUint32(M, (db*a+r.cb*ma)/da)
				} else {
					dr, dg, db = 0, 0, 0
				}
				p[i] = image.NRGBAColor{uint8(dr >> 8), uint8(dg >> 8), uint8(db >> 8), uint8(da >> 8)}
			}
		} else {
			for i, nrgba := range p {
				dr, dg, db, da := nrgba.RGBA()
				a := M - ma
				da = (da*a + r.ca*ma) / M
				if da != 0 {
					dr = minUint32(M, (dr*a+r.cr*ma)/da)
					dg = minUint32(M, (dg*a+r.cg*ma)/da)
					db = minUint32(M, (db*a+r.cb*ma)/da)
				} else {
					dr, dg, db = 0, 0, 0
				}
				p[i] = image.NRGBAColor{uint8(dr >> 8), uint8(dg >> 8), uint8(db >> 8), uint8(da >> 8)}
			}
		}
	}

}

// SetColor sets the color to paint the spans.
func (r *NRGBAPainter) SetColor(c image.Color) {
	r.cr, r.cg, r.cb, r.ca = c.RGBA()
}

// NewRGBAPainter creates a new RGBAPainter for the given image.
func NewNRGBAPainter(m *image.NRGBA) *NRGBAPainter {
	return &NRGBAPainter{Image: m}
}
*/
