// Copyright 2010 The draw2d Authors. All rights reserved.
// created: 21/11/2010 by Laurent Le Goff

package draw2d

import (
	"math"
)

var (
	CurveRecursionLimit        = 32
	CurveCollinearityEpsilon   = 1e-30
	CurveAngleToleranceEpsilon = 0.01
)

/*
	The function has the following parameters:
		approximationScale :
			Eventually determines the approximation accuracy. In practice we need to transform points from the World coordinate system to the Screen one.
			It always has some scaling coefficient.
			The curves are usually processed in the World coordinates, while the approximation accuracy should be eventually in pixels.
			Usually it looks as follows:
			curved.approximationScale(transform.scale());
			where transform is the affine matrix that includes all the transformations, including viewport and zoom.
		angleTolerance :
			You set it in radians.
			The less this value is the more accurate will be the approximation at sharp turns.
			But 0 means that we don't consider angle conditions at all.
		cuspLimit :
			An angle in radians.
			If 0, only the real cusps will have bevel cuts.
			If more than 0, it will restrict the sharpness.
			The more this value is the less sharp turns will be cut.
			Typically it should not exceed 10-15 degrees.
*/
func cubicBezier(v VertexConverter, x1, y1, x2, y2, x3, y3, x4, y4, approximationScale, angleTolerance, cuspLimit float64) {
	cuspLimit = computeCuspLimit(cuspLimit)
	distanceToleranceSquare := 0.5 / approximationScale
	distanceToleranceSquare = distanceToleranceSquare * distanceToleranceSquare
	recursiveCubicBezier(v, x1, y1, x2, y2, x3, y3, x4, y4, 0, distanceToleranceSquare, angleTolerance, cuspLimit)
}

/*
 * see cubicBezier comments for approximationScale and angleTolerance definition
 */
func quadraticBezier(v VertexConverter, x1, y1, x2, y2, x3, y3, approximationScale, angleTolerance float64) {
	distanceToleranceSquare := 0.5 / approximationScale
	distanceToleranceSquare = distanceToleranceSquare * distanceToleranceSquare

	recursiveQuadraticBezierBezier(v, x1, y1, x2, y2, x3, y3, 0, distanceToleranceSquare, angleTolerance)
}

func computeCuspLimit(v float64) (r float64) {
	if v == 0.0 {
		r = 0.0
	} else {
		r = math.Pi - v
	}
	return
}

/**
 * http://www.antigrain.com/research/adaptive_bezier/index.html
 */
func recursiveQuadraticBezierBezier(v VertexConverter, x1, y1, x2, y2, x3, y3 float64, level int, distanceToleranceSquare, angleTolerance float64) {
	if level > CurveRecursionLimit {
		return
	}

	// Calculate all the mid-points of the line segments
	//----------------------
	x12 := (x1 + x2) / 2
	y12 := (y1 + y2) / 2
	x23 := (x2 + x3) / 2
	y23 := (y2 + y3) / 2
	x123 := (x12 + x23) / 2
	y123 := (y12 + y23) / 2

	dx := x3 - x1
	dy := y3 - y1
	d := math.Abs(((x2-x3)*dy - (y2-y3)*dx))

	if d > CurveCollinearityEpsilon {
		// Regular case
		//-----------------
		if d*d <= distanceToleranceSquare*(dx*dx+dy*dy) {
			// If the curvature doesn't exceed the distanceTolerance value
			// we tend to finish subdivisions.
			//----------------------
			if angleTolerance < CurveAngleToleranceEpsilon {
				v.Vertex(x123, y123)
				return
			}

			// Angle & Cusp Condition
			//----------------------
			da := math.Abs(math.Atan2(y3-y2, x3-x2) - math.Atan2(y2-y1, x2-x1))
			if da >= math.Pi {
				da = 2*math.Pi - da
			}

			if da < angleTolerance {
				// Finally we can stop the recursion
				//----------------------
				v.Vertex(x123, y123)
				return
			}
		}
	} else {
		// Collinear case
		//------------------
		da := dx*dx + dy*dy
		if da == 0 {
			d = squareDistance(x1, y1, x2, y2)
		} else {
			d = ((x2-x1)*dx + (y2-y1)*dy) / da
			if d > 0 && d < 1 {
				// Simple collinear case, 1---2---3
				// We can leave just two endpoints
				return
			}
			if d <= 0 {
				d = squareDistance(x2, y2, x1, y1)
			} else if d >= 1 {
				d = squareDistance(x2, y2, x3, y3)
			} else {
				d = squareDistance(x2, y2, x1+d*dx, y1+d*dy)
			}
		}
		if d < distanceToleranceSquare {
			v.Vertex(x2, y2)
			return
		}
	}

	// Continue subdivision
	//----------------------
	recursiveQuadraticBezierBezier(v, x1, y1, x12, y12, x123, y123, level+1, distanceToleranceSquare, angleTolerance)
	recursiveQuadraticBezierBezier(v, x123, y123, x23, y23, x3, y3, level+1, distanceToleranceSquare, angleTolerance)
}

/**
 * http://www.antigrain.com/research/adaptive_bezier/index.html
 */
func recursiveCubicBezier(v VertexConverter, x1, y1, x2, y2, x3, y3, x4, y4 float64, level int, distanceToleranceSquare, angleTolerance, cuspLimit float64) {
	if level > CurveRecursionLimit {
		return
	}

	// Calculate all the mid-points of the line segments
	//----------------------
	x12 := (x1 + x2) / 2
	y12 := (y1 + y2) / 2
	x23 := (x2 + x3) / 2
	y23 := (y2 + y3) / 2
	x34 := (x3 + x4) / 2
	y34 := (y3 + y4) / 2
	x123 := (x12 + x23) / 2
	y123 := (y12 + y23) / 2
	x234 := (x23 + x34) / 2
	y234 := (y23 + y34) / 2
	x1234 := (x123 + x234) / 2
	y1234 := (y123 + y234) / 2

	// Try to approximate the full cubic curve by a single straight line
	//------------------
	dx := x4 - x1
	dy := y4 - y1

	d2 := math.Abs(((x2-x4)*dy - (y2-y4)*dx))
	d3 := math.Abs(((x3-x4)*dy - (y3-y4)*dx))

	switch {
	case d2 <= CurveCollinearityEpsilon && d3 <= CurveCollinearityEpsilon:
		// All collinear OR p1==p4
		//----------------------
		k := dx*dx + dy*dy
		if k == 0 {
			d2 = squareDistance(x1, y1, x2, y2)
			d3 = squareDistance(x4, y4, x3, y3)
		} else {
			k = 1 / k
			da1 := x2 - x1
			da2 := y2 - y1
			d2 = k * (da1*dx + da2*dy)
			da1 = x3 - x1
			da2 = y3 - y1
			d3 = k * (da1*dx + da2*dy)
			if d2 > 0 && d2 < 1 && d3 > 0 && d3 < 1 {
				// Simple collinear case, 1---2---3---4
				// We can leave just two endpoints
				return
			}
			if d2 <= 0 {
				d2 = squareDistance(x2, y2, x1, y1)
			} else if d2 >= 1 {
				d2 = squareDistance(x2, y2, x4, y4)
			} else {
				d2 = squareDistance(x2, y2, x1+d2*dx, y1+d2*dy)
			}

			if d3 <= 0 {
				d3 = squareDistance(x3, y3, x1, y1)
			} else if d3 >= 1 {
				d3 = squareDistance(x3, y3, x4, y4)
			} else {
				d3 = squareDistance(x3, y3, x1+d3*dx, y1+d3*dy)
			}
		}
		if d2 > d3 {
			if d2 < distanceToleranceSquare {
				v.Vertex(x2, y2)
				return
			}
		} else {
			if d3 < distanceToleranceSquare {
				v.Vertex(x3, y3)
				return
			}
		}
		break

	case d2 <= CurveCollinearityEpsilon && d3 > CurveCollinearityEpsilon:
		// p1,p2,p4 are collinear, p3 is significant
		//----------------------
		if d3*d3 <= distanceToleranceSquare*(dx*dx+dy*dy) {
			if angleTolerance < CurveAngleToleranceEpsilon {
				v.Vertex(x23, y23)
				return
			}

			// Angle Condition
			//----------------------
			da1 := math.Abs(math.Atan2(y4-y3, x4-x3) - math.Atan2(y3-y2, x3-x2))
			if da1 >= math.Pi {
				da1 = 2*math.Pi - da1
			}

			if da1 < angleTolerance {
				v.Vertex(x2, y2)
				v.Vertex(x3, y3)
				return
			}

			if cuspLimit != 0.0 {
				if da1 > cuspLimit {
					v.Vertex(x3, y3)
					return
				}
			}
		}
		break

	case d2 > CurveCollinearityEpsilon && d3 <= CurveCollinearityEpsilon:
		// p1,p3,p4 are collinear, p2 is significant
		//----------------------
		if d2*d2 <= distanceToleranceSquare*(dx*dx+dy*dy) {
			if angleTolerance < CurveAngleToleranceEpsilon {
				v.Vertex(x23, y23)
				return
			}

			// Angle Condition
			//----------------------
			da1 := math.Abs(math.Atan2(y3-y2, x3-x2) - math.Atan2(y2-y1, x2-x1))
			if da1 >= math.Pi {
				da1 = 2*math.Pi - da1
			}

			if da1 < angleTolerance {
				v.Vertex(x2, y2)
				v.Vertex(x3, y3)
				return
			}

			if cuspLimit != 0.0 {
				if da1 > cuspLimit {
					v.Vertex(x2, y2)
					return
				}
			}
		}
		break

	case d2 > CurveCollinearityEpsilon && d3 > CurveCollinearityEpsilon:
		// Regular case
		//-----------------
		if (d2+d3)*(d2+d3) <= distanceToleranceSquare*(dx*dx+dy*dy) {
			// If the curvature doesn't exceed the distanceTolerance value
			// we tend to finish subdivisions.
			//----------------------
			if angleTolerance < CurveAngleToleranceEpsilon {
				v.Vertex(x23, y23)
				return
			}

			// Angle & Cusp Condition
			//----------------------
			k := math.Atan2(y3-y2, x3-x2)
			da1 := math.Abs(k - math.Atan2(y2-y1, x2-x1))
			da2 := math.Abs(math.Atan2(y4-y3, x4-x3) - k)
			if da1 >= math.Pi {
				da1 = 2*math.Pi - da1
			}
			if da2 >= math.Pi {
				da2 = 2*math.Pi - da2
			}

			if da1+da2 < angleTolerance {
				// Finally we can stop the recursion
				//----------------------
				v.Vertex(x23, y23)
				return
			}

			if cuspLimit != 0.0 {
				if da1 > cuspLimit {
					v.Vertex(x2, y2)
					return
				}

				if da2 > cuspLimit {
					v.Vertex(x3, y3)
					return
				}
			}
		}
		break
	}

	// Continue subdivision
	//----------------------
	recursiveCubicBezier(v, x1, y1, x12, y12, x123, y123, x1234, y1234, level+1, distanceToleranceSquare, angleTolerance, cuspLimit)
	recursiveCubicBezier(v, x1234, y1234, x234, y234, x34, y34, x4, y4, level+1, distanceToleranceSquare, angleTolerance, cuspLimit)

}
