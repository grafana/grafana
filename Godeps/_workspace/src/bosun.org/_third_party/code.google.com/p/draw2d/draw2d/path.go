// Copyright 2010 The draw2d Authors. All rights reserved.
// created: 21/11/2010 by Laurent Le Goff

package draw2d

type Path interface {
	// Return the current point of the path
	LastPoint() (x, y float64)
	// Create a new subpath that start at the specified point
	MoveTo(x, y float64)
	// Create a new subpath that start at the specified point
	// relative to the current point
	RMoveTo(dx, dy float64)
	// Add a line to the current subpath
	LineTo(x, y float64)
	// Add a line to the current subpath
	// relative to the current point
	RLineTo(dx, dy float64)

	QuadCurveTo(cx, cy, x, y float64)
	RQuadCurveTo(dcx, dcy, dx, dy float64)
	CubicCurveTo(cx1, cy1, cx2, cy2, x, y float64)
	RCubicCurveTo(dcx1, dcy1, dcx2, dcy2, dx, dy float64)
	ArcTo(cx, cy, rx, ry, startAngle, angle float64)
	RArcTo(dcx, dcy, rx, ry, startAngle, angle float64)
	Close()
}
