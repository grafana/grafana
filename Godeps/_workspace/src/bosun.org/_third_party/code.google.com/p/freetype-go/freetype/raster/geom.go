// Copyright 2010 The Freetype-Go Authors. All rights reserved.
// Use of this source code is governed by your choice of either the
// FreeType License or the GNU General Public License version 2 (or
// any later version), both of which can be found in the LICENSE file.

package raster

import (
	"fmt"
	"math"
)

// A Fix32 is a 24.8 fixed point number.
type Fix32 int32

// A Fix64 is a 48.16 fixed point number.
type Fix64 int64

// String returns a human-readable representation of a 24.8 fixed point number.
// For example, the number one-and-a-quarter becomes "1:064".
func (x Fix32) String() string {
	if x < 0 {
		x = -x
		return fmt.Sprintf("-%d:%03d", int32(x/256), int32(x%256))
	}
	return fmt.Sprintf("%d:%03d", int32(x/256), int32(x%256))
}

// String returns a human-readable representation of a 48.16 fixed point number.
// For example, the number one-and-a-quarter becomes "1:16384".
func (x Fix64) String() string {
	if x < 0 {
		x = -x
		return fmt.Sprintf("-%d:%05d", int64(x/65536), int64(x%65536))
	}
	return fmt.Sprintf("%d:%05d", int64(x/65536), int64(x%65536))
}

// maxAbs returns the maximum of abs(a) and abs(b).
func maxAbs(a, b Fix32) Fix32 {
	if a < 0 {
		a = -a
	}
	if b < 0 {
		b = -b
	}
	if a < b {
		return b
	}
	return a
}

// A Point represents a two-dimensional point or vector, in 24.8 fixed point
// format.
type Point struct {
	X, Y Fix32
}

// String returns a human-readable representation of a Point.
func (p Point) String() string {
	return "(" + p.X.String() + ", " + p.Y.String() + ")"
}

// Add returns the vector p + q.
func (p Point) Add(q Point) Point {
	return Point{p.X + q.X, p.Y + q.Y}
}

// Sub returns the vector p - q.
func (p Point) Sub(q Point) Point {
	return Point{p.X - q.X, p.Y - q.Y}
}

// Mul returns the vector k * p.
func (p Point) Mul(k Fix32) Point {
	return Point{p.X * k / 256, p.Y * k / 256}
}

// Neg returns the vector -p, or equivalently p rotated by 180 degrees.
func (p Point) Neg() Point {
	return Point{-p.X, -p.Y}
}

// Dot returns the dot product p·q.
func (p Point) Dot(q Point) Fix64 {
	px, py := int64(p.X), int64(p.Y)
	qx, qy := int64(q.X), int64(q.Y)
	return Fix64(px*qx + py*qy)
}

// Len returns the length of the vector p.
func (p Point) Len() Fix32 {
	// TODO(nigeltao): use fixed point math.
	x := float64(p.X)
	y := float64(p.Y)
	return Fix32(math.Sqrt(x*x + y*y))
}

// Norm returns the vector p normalized to the given length, or the zero Point
// if p is degenerate.
func (p Point) Norm(length Fix32) Point {
	d := p.Len()
	if d == 0 {
		return Point{}
	}
	s, t := int64(length), int64(d)
	x := int64(p.X) * s / t
	y := int64(p.Y) * s / t
	return Point{Fix32(x), Fix32(y)}
}

// Rot45CW returns the vector p rotated clockwise by 45 degrees.
// Note that the Y-axis grows downwards, so {1, 0}.Rot45CW is {1/√2, 1/√2}.
func (p Point) Rot45CW() Point {
	// 181/256 is approximately 1/√2, or sin(π/4).
	px, py := int64(p.X), int64(p.Y)
	qx := (+px - py) * 181 / 256
	qy := (+px + py) * 181 / 256
	return Point{Fix32(qx), Fix32(qy)}
}

// Rot90CW returns the vector p rotated clockwise by 90 degrees.
// Note that the Y-axis grows downwards, so {1, 0}.Rot90CW is {0, 1}.
func (p Point) Rot90CW() Point {
	return Point{-p.Y, p.X}
}

// Rot135CW returns the vector p rotated clockwise by 135 degrees.
// Note that the Y-axis grows downwards, so {1, 0}.Rot135CW is {-1/√2, 1/√2}.
func (p Point) Rot135CW() Point {
	// 181/256 is approximately 1/√2, or sin(π/4).
	px, py := int64(p.X), int64(p.Y)
	qx := (-px - py) * 181 / 256
	qy := (+px - py) * 181 / 256
	return Point{Fix32(qx), Fix32(qy)}
}

// Rot45CCW returns the vector p rotated counter-clockwise by 45 degrees.
// Note that the Y-axis grows downwards, so {1, 0}.Rot45CCW is {1/√2, -1/√2}.
func (p Point) Rot45CCW() Point {
	// 181/256 is approximately 1/√2, or sin(π/4).
	px, py := int64(p.X), int64(p.Y)
	qx := (+px + py) * 181 / 256
	qy := (-px + py) * 181 / 256
	return Point{Fix32(qx), Fix32(qy)}
}

// Rot90CCW returns the vector p rotated counter-clockwise by 90 degrees.
// Note that the Y-axis grows downwards, so {1, 0}.Rot90CCW is {0, -1}.
func (p Point) Rot90CCW() Point {
	return Point{p.Y, -p.X}
}

// Rot135CCW returns the vector p rotated counter-clockwise by 135 degrees.
// Note that the Y-axis grows downwards, so {1, 0}.Rot135CCW is {-1/√2, -1/√2}.
func (p Point) Rot135CCW() Point {
	// 181/256 is approximately 1/√2, or sin(π/4).
	px, py := int64(p.X), int64(p.Y)
	qx := (-px + py) * 181 / 256
	qy := (-px - py) * 181 / 256
	return Point{Fix32(qx), Fix32(qy)}
}

// An Adder accumulates points on a curve.
type Adder interface {
	// Start starts a new curve at the given point.
	Start(a Point)
	// Add1 adds a linear segment to the current curve.
	Add1(b Point)
	// Add2 adds a quadratic segment to the current curve.
	Add2(b, c Point)
	// Add3 adds a cubic segment to the current curve.
	Add3(b, c, d Point)
}

// A Path is a sequence of curves, and a curve is a start point followed by a
// sequence of linear, quadratic or cubic segments.
type Path []Fix32

// String returns a human-readable representation of a Path.
func (p Path) String() string {
	s := ""
	for i := 0; i < len(p); {
		if i != 0 {
			s += " "
		}
		switch p[i] {
		case 0:
			s += "S0" + fmt.Sprint([]Fix32(p[i+1:i+3]))
			i += 4
		case 1:
			s += "A1" + fmt.Sprint([]Fix32(p[i+1:i+3]))
			i += 4
		case 2:
			s += "A2" + fmt.Sprint([]Fix32(p[i+1:i+5]))
			i += 6
		case 3:
			s += "A3" + fmt.Sprint([]Fix32(p[i+1:i+7]))
			i += 8
		default:
			panic("freetype/raster: bad path")
		}
	}
	return s
}

// Clear cancels any previous calls to p.Start or p.AddXxx.
func (p *Path) Clear() {
	*p = (*p)[:0]
}

// Start starts a new curve at the given point.
func (p *Path) Start(a Point) {
	*p = append(*p, 0, a.X, a.Y, 0)
}

// Add1 adds a linear segment to the current curve.
func (p *Path) Add1(b Point) {
	*p = append(*p, 1, b.X, b.Y, 1)
}

// Add2 adds a quadratic segment to the current curve.
func (p *Path) Add2(b, c Point) {
	*p = append(*p, 2, b.X, b.Y, c.X, c.Y, 2)
}

// Add3 adds a cubic segment to the current curve.
func (p *Path) Add3(b, c, d Point) {
	*p = append(*p, 3, b.X, b.Y, c.X, c.Y, d.X, d.Y, 3)
}

// AddPath adds the Path q to p.
func (p *Path) AddPath(q Path) {
	*p = append(*p, q...)
}

// AddStroke adds a stroked Path.
func (p *Path) AddStroke(q Path, width Fix32, cr Capper, jr Joiner) {
	Stroke(p, q, width, cr, jr)
}

// firstPoint returns the first point in a non-empty Path.
func (p Path) firstPoint() Point {
	return Point{p[1], p[2]}
}

// lastPoint returns the last point in a non-empty Path.
func (p Path) lastPoint() Point {
	return Point{p[len(p)-3], p[len(p)-2]}
}

// addPathReversed adds q reversed to p.
// For example, if q consists of a linear segment from A to B followed by a
// quadratic segment from B to C to D, then the values of q looks like:
// index: 01234567890123
// value: 0AA01BB12CCDD2
// So, when adding q backwards to p, we want to Add2(C, B) followed by Add1(A).
func addPathReversed(p Adder, q Path) {
	if len(q) == 0 {
		return
	}
	i := len(q) - 1
	for {
		switch q[i] {
		case 0:
			return
		case 1:
			i -= 4
			p.Add1(Point{q[i-2], q[i-1]})
		case 2:
			i -= 6
			p.Add2(Point{q[i+2], q[i+3]}, Point{q[i-2], q[i-1]})
		case 3:
			i -= 8
			p.Add3(Point{q[i+4], q[i+5]}, Point{q[i+2], q[i+3]}, Point{q[i-2], q[i-1]})
		default:
			panic("freetype/raster: bad path")
		}
	}
}
