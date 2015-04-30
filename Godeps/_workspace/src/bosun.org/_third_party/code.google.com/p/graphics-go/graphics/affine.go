// Copyright 2011 The Graphics-Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package graphics

import (
	"bosun.org/_third_party/code.google.com/p/graphics-go/graphics/interp"
	"errors"
	"image"
	"image/draw"
	"math"
)

// I is the identity Affine transform matrix.
var I = Affine{
	1, 0, 0,
	0, 1, 0,
	0, 0, 1,
}

// Affine is a 3x3 2D affine transform matrix.
// M(i,j) is Affine[i*3+j].
type Affine [9]float64

// Mul returns the multiplication of two affine transform matrices.
func (a Affine) Mul(b Affine) Affine {
	return Affine{
		a[0]*b[0] + a[1]*b[3] + a[2]*b[6],
		a[0]*b[1] + a[1]*b[4] + a[2]*b[7],
		a[0]*b[2] + a[1]*b[5] + a[2]*b[8],
		a[3]*b[0] + a[4]*b[3] + a[5]*b[6],
		a[3]*b[1] + a[4]*b[4] + a[5]*b[7],
		a[3]*b[2] + a[4]*b[5] + a[5]*b[8],
		a[6]*b[0] + a[7]*b[3] + a[8]*b[6],
		a[6]*b[1] + a[7]*b[4] + a[8]*b[7],
		a[6]*b[2] + a[7]*b[5] + a[8]*b[8],
	}
}

func (a Affine) transformRGBA(dst *image.RGBA, src *image.RGBA, i interp.RGBA) error {
	srcb := src.Bounds()
	b := dst.Bounds()
	for y := b.Min.Y; y < b.Max.Y; y++ {
		for x := b.Min.X; x < b.Max.X; x++ {
			sx, sy := a.pt(x, y)
			if inBounds(srcb, sx, sy) {
				c := i.RGBA(src, sx, sy)
				off := (y-dst.Rect.Min.Y)*dst.Stride + (x-dst.Rect.Min.X)*4
				dst.Pix[off+0] = c.R
				dst.Pix[off+1] = c.G
				dst.Pix[off+2] = c.B
				dst.Pix[off+3] = c.A
			}
		}
	}
	return nil
}

// Transform applies the affine transform to src and produces dst.
func (a Affine) Transform(dst draw.Image, src image.Image, i interp.Interp) error {
	if dst == nil {
		return errors.New("graphics: dst is nil")
	}
	if src == nil {
		return errors.New("graphics: src is nil")
	}

	// RGBA fast path.
	dstRGBA, dstOk := dst.(*image.RGBA)
	srcRGBA, srcOk := src.(*image.RGBA)
	interpRGBA, interpOk := i.(interp.RGBA)
	if dstOk && srcOk && interpOk {
		return a.transformRGBA(dstRGBA, srcRGBA, interpRGBA)
	}

	srcb := src.Bounds()
	b := dst.Bounds()
	for y := b.Min.Y; y < b.Max.Y; y++ {
		for x := b.Min.X; x < b.Max.X; x++ {
			sx, sy := a.pt(x, y)
			if inBounds(srcb, sx, sy) {
				dst.Set(x, y, i.Interp(src, sx, sy))
			}
		}
	}
	return nil
}

func inBounds(b image.Rectangle, x, y float64) bool {
	if x < float64(b.Min.X) || x >= float64(b.Max.X) {
		return false
	}
	if y < float64(b.Min.Y) || y >= float64(b.Max.Y) {
		return false
	}
	return true
}

func (a Affine) pt(x0, y0 int) (x1, y1 float64) {
	fx := float64(x0) + 0.5
	fy := float64(y0) + 0.5
	x1 = fx*a[0] + fy*a[1] + a[2]
	y1 = fx*a[3] + fy*a[4] + a[5]
	return x1, y1
}

// TransformCenter applies the affine transform to src and produces dst.
// Equivalent to
//   a.CenterFit(dst, src).Transform(dst, src, i).
func (a Affine) TransformCenter(dst draw.Image, src image.Image, i interp.Interp) error {
	if dst == nil {
		return errors.New("graphics: dst is nil")
	}
	if src == nil {
		return errors.New("graphics: src is nil")
	}

	return a.CenterFit(dst.Bounds(), src.Bounds()).Transform(dst, src, i)
}

// Scale produces a scaling transform of factors x and y.
func (a Affine) Scale(x, y float64) Affine {
	return a.Mul(Affine{
		1 / x, 0, 0,
		0, 1 / y, 0,
		0, 0, 1,
	})
}

// Rotate produces a clockwise rotation transform of angle, in radians.
func (a Affine) Rotate(angle float64) Affine {
	s, c := math.Sincos(angle)
	return a.Mul(Affine{
		+c, +s, +0,
		-s, +c, +0,
		+0, +0, +1,
	})
}

// Shear produces a shear transform by the slopes x and y.
func (a Affine) Shear(x, y float64) Affine {
	d := 1 - x*y
	return a.Mul(Affine{
		+1 / d, -x / d, 0,
		-y / d, +1 / d, 0,
		0, 0, 1,
	})
}

// Translate produces a translation transform with pixel distances x and y.
func (a Affine) Translate(x, y float64) Affine {
	return a.Mul(Affine{
		1, 0, -x,
		0, 1, -y,
		0, 0, +1,
	})
}

// Center produces the affine transform, centered around the provided point.
func (a Affine) Center(x, y float64) Affine {
	return I.Translate(-x, -y).Mul(a).Translate(x, y)
}

// CenterFit produces the affine transform, centered around the rectangles.
// It is equivalent to
//   I.Translate(-<center of src>).Mul(a).Translate(<center of dst>)
func (a Affine) CenterFit(dst, src image.Rectangle) Affine {
	dx := float64(dst.Min.X) + float64(dst.Dx())/2
	dy := float64(dst.Min.Y) + float64(dst.Dy())/2
	sx := float64(src.Min.X) + float64(src.Dx())/2
	sy := float64(src.Min.Y) + float64(src.Dy())/2
	return I.Translate(-sx, -sy).Mul(a).Translate(dx, dy)
}
