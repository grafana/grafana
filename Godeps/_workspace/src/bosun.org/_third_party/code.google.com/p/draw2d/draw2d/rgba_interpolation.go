// Copyright 2010 The draw2d Authors. All rights reserved.
// created: 21/11/2010 by Laurent Le Goff
// see http://pippin.gimp.org/image_processing/chap_resampling.html

package draw2d

import (
	"image"
	"image/color"
	"image/draw"
	"math"
)

type ImageFilter int

const (
	LinearFilter ImageFilter = iota
	BilinearFilter
	BicubicFilter
)

//see http://pippin.gimp.org/image_processing/chap_resampling.html
func getColorLinear(img image.Image, x, y float64) color.Color {
	return img.At(int(x), int(y))
}

func getColorBilinear(img image.Image, x, y float64) color.Color {
	x0 := math.Floor(x)
	y0 := math.Floor(y)
	dx := x - x0
	dy := y - y0

	rt, gt, bt, at := img.At(int(x0), int(y0)).RGBA()
	r0, g0, b0, a0 := float64(rt), float64(gt), float64(bt), float64(at)
	rt, gt, bt, at = img.At(int(x0+1), int(y0)).RGBA()
	r1, g1, b1, a1 := float64(rt), float64(gt), float64(bt), float64(at)
	rt, gt, bt, at = img.At(int(x0+1), int(y0+1)).RGBA()
	r2, g2, b2, a2 := float64(rt), float64(gt), float64(bt), float64(at)
	rt, gt, bt, at = img.At(int(x0), int(y0+1)).RGBA()
	r3, g3, b3, a3 := float64(rt), float64(gt), float64(bt), float64(at)

	r := int(lerp(lerp(r0, r1, dx), lerp(r3, r2, dx), dy))
	g := int(lerp(lerp(g0, g1, dx), lerp(g3, g2, dx), dy))
	b := int(lerp(lerp(b0, b1, dx), lerp(b3, b2, dx), dy))
	a := int(lerp(lerp(a0, a1, dx), lerp(a3, a2, dx), dy))
	return color.RGBA{uint8(r >> 8), uint8(g >> 8), uint8(b >> 8), uint8(a >> 8)}
}

/**
-- LERP
-- /lerp/, vi.,n.
--
-- Quasi-acronym for Linear Interpolation, used as a verb or noun for
-- the operation. "Bresenham's algorithm lerps incrementally between the
-- two endpoints of the line." (From Jargon File (4.4.4, 14 Aug 2003)
*/
func lerp(v1, v2, ratio float64) float64 {
	return v1*(1-ratio) + v2*ratio
}

func getColorCubicRow(img image.Image, x, y, offset float64) color.Color {
	c0 := img.At(int(x), int(y))
	c1 := img.At(int(x+1), int(y))
	c2 := img.At(int(x+2), int(y))
	c3 := img.At(int(x+3), int(y))
	rt, gt, bt, at := c0.RGBA()
	r0, g0, b0, a0 := float64(rt), float64(gt), float64(bt), float64(at)
	rt, gt, bt, at = c1.RGBA()
	r1, g1, b1, a1 := float64(rt), float64(gt), float64(bt), float64(at)
	rt, gt, bt, at = c2.RGBA()
	r2, g2, b2, a2 := float64(rt), float64(gt), float64(bt), float64(at)
	rt, gt, bt, at = c3.RGBA()
	r3, g3, b3, a3 := float64(rt), float64(gt), float64(bt), float64(at)
	r, g, b, a := cubic(offset, r0, r1, r2, r3), cubic(offset, g0, g1, g2, g3), cubic(offset, b0, b1, b2, b3), cubic(offset, a0, a1, a2, a3)
	return color.RGBA{uint8(r >> 8), uint8(g >> 8), uint8(b >> 8), uint8(a >> 8)}
}

func getColorBicubic(img image.Image, x, y float64) color.Color {
	x0 := math.Floor(x)
	y0 := math.Floor(y)
	dx := x - x0
	dy := y - y0
	c0 := getColorCubicRow(img, x0-1, y0-1, dx)
	c1 := getColorCubicRow(img, x0-1, y0, dx)
	c2 := getColorCubicRow(img, x0-1, y0+1, dx)
	c3 := getColorCubicRow(img, x0-1, y0+2, dx)
	rt, gt, bt, at := c0.RGBA()
	r0, g0, b0, a0 := float64(rt), float64(gt), float64(bt), float64(at)
	rt, gt, bt, at = c1.RGBA()
	r1, g1, b1, a1 := float64(rt), float64(gt), float64(bt), float64(at)
	rt, gt, bt, at = c2.RGBA()
	r2, g2, b2, a2 := float64(rt), float64(gt), float64(bt), float64(at)
	rt, gt, bt, at = c3.RGBA()
	r3, g3, b3, a3 := float64(rt), float64(gt), float64(bt), float64(at)
	r, g, b, a := cubic(dy, r0, r1, r2, r3), cubic(dy, g0, g1, g2, g3), cubic(dy, b0, b1, b2, b3), cubic(dy, a0, a1, a2, a3)
	return color.RGBA{uint8(r >> 8), uint8(g >> 8), uint8(b >> 8), uint8(a >> 8)}
}

func cubic(offset, v0, v1, v2, v3 float64) uint32 {
	// offset is the offset of the sampled value between v1 and v2
	return uint32(((((-7*v0+21*v1-21*v2+7*v3)*offset+
		(15*v0-36*v1+27*v2-6*v3))*offset+
		(-9*v0+9*v2))*offset + (v0 + 16*v1 + v2)) / 18.0)
}

func DrawImage(src image.Image, dest draw.Image, tr MatrixTransform, op draw.Op, filter ImageFilter) {
	bounds := src.Bounds()
	x0, y0, x1, y1 := float64(bounds.Min.X), float64(bounds.Min.Y), float64(bounds.Max.X), float64(bounds.Max.Y)
	tr.TransformRectangle(&x0, &y0, &x1, &y1)
	var x, y, u, v float64
	var c1, c2, cr color.Color
	var r, g, b, a, ia, r1, g1, b1, a1, r2, g2, b2, a2 uint32
	var color color.RGBA
	for x = x0; x < x1; x++ {
		for y = y0; y < y1; y++ {
			u = x
			v = y
			tr.InverseTransform(&u, &v)
			if bounds.Min.X <= int(u) && bounds.Max.X > int(u) && bounds.Min.Y <= int(v) && bounds.Max.Y > int(v) {
				c1 = dest.At(int(x), int(y))
				switch filter {
				case LinearFilter:
					c2 = src.At(int(u), int(v))
				case BilinearFilter:
					c2 = getColorBilinear(src, u, v)
				case BicubicFilter:
					c2 = getColorBicubic(src, u, v)
				}
				switch op {
				case draw.Over:
					r1, g1, b1, a1 = c1.RGBA()
					r2, g2, b2, a2 = c2.RGBA()
					ia = M - a2
					r = ((r1 * ia) / M) + r2
					g = ((g1 * ia) / M) + g2
					b = ((b1 * ia) / M) + b2
					a = ((a1 * ia) / M) + a2
					color.R = uint8(r >> 8)
					color.G = uint8(g >> 8)
					color.B = uint8(b >> 8)
					color.A = uint8(a >> 8)
					cr = color
				default:
					cr = c2
				}
				dest.Set(int(x), int(y), cr)
			}
		}
	}
}
