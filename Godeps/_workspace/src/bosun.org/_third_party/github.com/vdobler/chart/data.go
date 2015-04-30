package chart

import (
	"math"
)

// Values is an interface for any type of data representable by a real.
// Its standard implementation here is Real (float64).
type Value interface {
	XVal() float64
}

// A simple real value implemnting the Value interface
type Real float64

func (r Real) XVal() float64 { return float64(r) }

// XY-Value is an interface for any type of data which is point-like and has
// a x- and y-coordinate. Its standard implementationhere is Point.
type XYValue interface {
	XVal() float64
	YVal() float64
}

// Point is a point in two dimensions (x,y) implementing XYValue.
type Point struct{ X, Y float64 }

func (p Point) XVal() float64            { return p.X }
func (p Point) YVal() float64            { return p.Y }
func (p Point) XErr() (float64, float64) { return math.NaN(), math.NaN() }
func (p Point) YErr() (float64, float64) { return math.NaN(), math.NaN() }

// XYErrValue is an interface any type of data which is point-like (x,y) and
// has some measurement error.
type XYErrValue interface {
	XVal() float64
	YVal() float64
	XErr() (float64, float64) // X-range [min,max], error intervall. Use NaN to indicate "no error"
	YErr() (float64, float64) // Same for y
}

// EPoint represents a point in two dimensions (X,Y) with possible error ranges
// in both dimensions. To faciliate common symetric errors, OffX/Y default to 0 and
// only DeltaX/Y needs to be set up.
type EPoint struct {
	X, Y           float64
	DeltaX, DeltaY float64 // Full range of x and y error, NaN for no errorbar
	OffX, OffY     float64 // Offset of error range (must be < Delta)
}

func (p EPoint) XVal() float64 { return p.X }
func (p EPoint) YVal() float64 { return p.Y }
func (p EPoint) XErr() (float64, float64) {
	xl, _, xh, _ := p.BoundingBox()
	return xl, xh
}
func (p EPoint) YErr() (float64, float64) {
	_, yl, _, yh := p.BoundingBox()
	return yl, yh
}
func (p EPoint) BoundingBox() (xl, yl, xh, yh float64) { // bounding box
	xl, xh, yl, yh = p.X, p.X, p.Y, p.Y
	if !math.IsNaN(p.DeltaX) {
		xl -= p.DeltaX/2 - p.OffX
		xh += p.DeltaX/2 + p.OffX
	}
	if !math.IsNaN(p.DeltaY) {
		yl -= p.DeltaY/2 - p.OffY
		yh += p.DeltaY/2 + p.OffY
	}
	return
}

// CategoryValue is an interface for any type of data which is category-real-pair.
type CategoryValue interface {
	Category() string
	Value() float64
	Flaged() bool
}

// CatValue is the standard implementation for CategoryValue
type CatValue struct {
	Cat  string
	Val  float64
	Flag bool
}

func (c CatValue) Category() string { return c.Cat }
func (c CatValue) Value() float64   { return c.Val }
func (c CatValue) Flaged() bool     { return c.Flag }

// Box represents a box in an boxplot.
type Box struct {
	X           float64   // x-position of the box
	Avg         float64   // "average" value (uncommon in std. box plots, but sometimes useful)
	Q1, Med, Q3 float64   // lower quartil, median and upper quartil
	Low, High   float64   // low and hig end of whiskers (normaly last point in the 1.5*IQR range of Q1/3)
	Outliers    []float64 // list of y-values of outliers
}

func (p Box) XVal() float64 { return p.X }
func (p Box) YVal() float64 { return p.Med }
func (p Box) XErr() float64 { return p.Med - p.Q1 }
func (p Box) YErr() float64 { return p.Q3 - p.Med }
