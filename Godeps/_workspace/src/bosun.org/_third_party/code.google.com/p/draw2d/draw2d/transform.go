// Copyright 2010 The draw2d Authors. All rights reserved.
// created: 21/11/2010 by Laurent Le Goff

package draw2d

import (
	"bosun.org/_third_party/code.google.com/p/freetype-go/freetype/raster"
	"math"
)

type MatrixTransform [6]float64

const (
	epsilon = 1e-6
)

func (tr MatrixTransform) Determinant() float64 {
	return tr[0]*tr[3] - tr[1]*tr[2]
}

func (tr MatrixTransform) Transform(points ...*float64) {
	for i, j := 0, 1; j < len(points); i, j = i+2, j+2 {
		x := *points[i]
		y := *points[j]
		*points[i] = x*tr[0] + y*tr[2] + tr[4]
		*points[j] = x*tr[1] + y*tr[3] + tr[5]
	}
}

func (tr MatrixTransform) TransformArray(points []float64) {
	for i, j := 0, 1; j < len(points); i, j = i+2, j+2 {
		x := points[i]
		y := points[j]
		points[i] = x*tr[0] + y*tr[2] + tr[4]
		points[j] = x*tr[1] + y*tr[3] + tr[5]
	}
}

func (tr MatrixTransform) TransformRectangle(x0, y0, x2, y2 *float64) {
	x1 := *x2
	y1 := *y0
	x3 := *x0
	y3 := *y2
	tr.Transform(x0, y0, &x1, &y1, x2, y2, &x3, &y3)
	*x0, x1 = minMax(*x0, x1)
	*x2, x3 = minMax(*x2, x3)
	*y0, y1 = minMax(*y0, y1)
	*y2, y3 = minMax(*y2, y3)

	*x0 = min(*x0, *x2)
	*y0 = min(*y0, *y2)
	*x2 = max(x1, x3)
	*y2 = max(y1, y3)
}

func (tr MatrixTransform) TransformRasterPoint(points ...*raster.Point) {
	for _, point := range points {
		x := float64(point.X) / 256
		y := float64(point.Y) / 256
		point.X = raster.Fix32((x*tr[0] + y*tr[2] + tr[4]) * 256)
		point.Y = raster.Fix32((x*tr[1] + y*tr[3] + tr[5]) * 256)
	}
}

func (tr MatrixTransform) InverseTransform(points ...*float64) {
	d := tr.Determinant() // matrix determinant
	for i, j := 0, 1; j < len(points); i, j = i+2, j+2 {
		x := *points[i]
		y := *points[j]
		*points[i] = ((x-tr[4])*tr[3] - (y-tr[5])*tr[2]) / d
		*points[j] = ((y-tr[5])*tr[0] - (x-tr[4])*tr[1]) / d
	}
}

// ******************** Vector transformations ********************

func (tr MatrixTransform) VectorTransform(points ...*float64) {
	for i, j := 0, 1; j < len(points); i, j = i+2, j+2 {
		x := *points[i]
		y := *points[j]
		*points[i] = x*tr[0] + y*tr[2]
		*points[j] = x*tr[1] + y*tr[3]
	}
}

// ******************** Transformations creation ********************

/** Creates an identity transformation. */
func NewIdentityMatrix() MatrixTransform {
	return [6]float64{1, 0, 0, 1, 0, 0}
}

/**
 * Creates a transformation with a translation, that,
 * transform point1 into point2.
 */
func NewTranslationMatrix(tx, ty float64) MatrixTransform {
	return [6]float64{1, 0, 0, 1, tx, ty}
}

/**
 * Creates a transformation with a sx, sy scale factor
 */
func NewScaleMatrix(sx, sy float64) MatrixTransform {
	return [6]float64{sx, 0, 0, sy, 0, 0}
}

/**
 * Creates a rotation transformation.
 */
func NewRotationMatrix(angle float64) MatrixTransform {
	c := math.Cos(angle)
	s := math.Sin(angle)
	return [6]float64{c, s, -s, c, 0, 0}
}

/**
 * Creates a transformation, combining a scale and a translation, that transform rectangle1 into rectangle2.
 */
func NewMatrixTransform(rectangle1, rectangle2 [4]float64) MatrixTransform {
	xScale := (rectangle2[2] - rectangle2[0]) / (rectangle1[2] - rectangle1[0])
	yScale := (rectangle2[3] - rectangle2[1]) / (rectangle1[3] - rectangle1[1])
	xOffset := rectangle2[0] - (rectangle1[0] * xScale)
	yOffset := rectangle2[1] - (rectangle1[1] * yScale)
	return [6]float64{xScale, 0, 0, yScale, xOffset, yOffset}
}

// ******************** Transformations operations ********************

/**
 * Returns a transformation that is the inverse of the given transformation.
 */
func (tr MatrixTransform) GetInverseTransformation() MatrixTransform {
	d := tr.Determinant() // matrix determinant
	return [6]float64{
		tr[3] / d,
		-tr[1] / d,
		-tr[2] / d,
		tr[0] / d,
		(tr[2]*tr[5] - tr[3]*tr[4]) / d,
		(tr[1]*tr[4] - tr[0]*tr[5]) / d}
}

func (tr1 MatrixTransform) Multiply(tr2 MatrixTransform) MatrixTransform {
	return [6]float64{
		tr1[0]*tr2[0] + tr1[1]*tr2[2],
		tr1[1]*tr2[3] + tr1[0]*tr2[1],
		tr1[2]*tr2[0] + tr1[3]*tr2[2],
		tr1[3]*tr2[3] + tr1[2]*tr2[1],
		tr1[4]*tr2[0] + tr1[5]*tr2[2] + tr2[4],
		tr1[5]*tr2[3] + tr1[4]*tr2[1] + tr2[5]}
}

func (tr *MatrixTransform) Scale(sx, sy float64) *MatrixTransform {
	tr[0] = sx * tr[0]
	tr[1] = sx * tr[1]
	tr[2] = sy * tr[2]
	tr[3] = sy * tr[3]
	return tr
}

func (tr *MatrixTransform) Translate(tx, ty float64) *MatrixTransform {
	tr[4] = tx*tr[0] + ty*tr[2] + tr[4]
	tr[5] = ty*tr[3] + tx*tr[1] + tr[5]
	return tr
}

func (tr *MatrixTransform) Rotate(angle float64) *MatrixTransform {
	c := math.Cos(angle)
	s := math.Sin(angle)
	t0 := c*tr[0] + s*tr[2]
	t1 := s*tr[3] + c*tr[1]
	t2 := c*tr[2] - s*tr[0]
	t3 := c*tr[3] - s*tr[1]
	tr[0] = t0
	tr[1] = t1
	tr[2] = t2
	tr[3] = t3
	return tr
}

func (tr MatrixTransform) GetTranslation() (x, y float64) {
	return tr[4], tr[5]
}

func (tr MatrixTransform) GetScaling() (x, y float64) {
	return tr[0], tr[3]
}

func (tr MatrixTransform) GetScale() float64 {
	x := 0.707106781*tr[0] + 0.707106781*tr[1]
	y := 0.707106781*tr[2] + 0.707106781*tr[3]
	return math.Sqrt(x*x + y*y)
}

func (tr MatrixTransform) GetMaxAbsScaling() (s float64) {
	sx := math.Abs(tr[0])
	sy := math.Abs(tr[3])
	if sx > sy {
		return sx
	}
	return sy
}

func (tr MatrixTransform) GetMinAbsScaling() (s float64) {
	sx := math.Abs(tr[0])
	sy := math.Abs(tr[3])
	if sx > sy {
		return sy
	}
	return sx
}

// ******************** Testing ********************

/**
 * Tests if a two transformation are equal. A tolerance is applied when
 * comparing matrix elements.
 */
func (tr1 MatrixTransform) Equals(tr2 MatrixTransform) bool {
	for i := 0; i < 6; i = i + 1 {
		if !fequals(tr1[i], tr2[i]) {
			return false
		}
	}
	return true
}

/**
 * Tests if a transformation is the identity transformation. A tolerance
 * is applied when comparing matrix elements.
 */
func (tr MatrixTransform) IsIdentity() bool {
	return fequals(tr[4], 0) && fequals(tr[5], 0) && tr.IsTranslation()
}

/**
 * Tests if a transformation is is a pure translation. A tolerance
 * is applied when comparing matrix elements.
 */
func (tr MatrixTransform) IsTranslation() bool {
	return fequals(tr[0], 1) && fequals(tr[1], 0) && fequals(tr[2], 0) && fequals(tr[3], 1)
}

/**
 * Compares two floats.
 * return true if the distance between the two floats is less than epsilon, false otherwise
 */
func fequals(float1, float2 float64) bool {
	return math.Abs(float1-float2) <= epsilon
}

// this VertexConverter apply the Matrix transformation tr
type VertexMatrixTransform struct {
	tr   MatrixTransform
	Next VertexConverter
}

func NewVertexMatrixTransform(tr MatrixTransform, converter VertexConverter) *VertexMatrixTransform {
	return &VertexMatrixTransform{tr, converter}
}

// Vertex Matrix Transform
func (vmt *VertexMatrixTransform) NextCommand(command VertexCommand) {
	vmt.Next.NextCommand(command)
}

func (vmt *VertexMatrixTransform) Vertex(x, y float64) {
	u := x*vmt.tr[0] + y*vmt.tr[2] + vmt.tr[4]
	v := x*vmt.tr[1] + y*vmt.tr[3] + vmt.tr[5]
	vmt.Next.Vertex(u, v)
}

// this adder apply a Matrix transformation to points
type MatrixTransformAdder struct {
	tr   MatrixTransform
	next raster.Adder
}

func NewMatrixTransformAdder(tr MatrixTransform, adder raster.Adder) *MatrixTransformAdder {
	return &MatrixTransformAdder{tr, adder}
}

// Start starts a new curve at the given point.
func (mta MatrixTransformAdder) Start(a raster.Point) {
	mta.tr.TransformRasterPoint(&a)
	mta.next.Start(a)
}

// Add1 adds a linear segment to the current curve.
func (mta MatrixTransformAdder) Add1(b raster.Point) {
	mta.tr.TransformRasterPoint(&b)
	mta.next.Add1(b)
}

// Add2 adds a quadratic segment to the current curve.
func (mta MatrixTransformAdder) Add2(b, c raster.Point) {
	mta.tr.TransformRasterPoint(&b, &c)
	mta.next.Add2(b, c)
}

// Add3 adds a cubic segment to the current curve.
func (mta MatrixTransformAdder) Add3(b, c, d raster.Point) {
	mta.tr.TransformRasterPoint(&b, &c, &d)
	mta.next.Add3(b, c, d)
}
