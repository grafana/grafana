// Copyright 2010 The draw2d Authors. All rights reserved.
// created: 21/11/2010 by Laurent Le Goff

package draw2d

import (
	"math"
)

func distance(x1, y1, x2, y2 float64) float64 {
	dx := x2 - x1
	dy := y2 - y1
	return float64(math.Sqrt(dx*dx + dy*dy))
}

func vectorDistance(dx, dy float64) float64 {
	return float64(math.Sqrt(dx*dx + dy*dy))
}

func squareDistance(x1, y1, x2, y2 float64) float64 {
	dx := x2 - x1
	dy := y2 - y1
	return dx*dx + dy*dy
}

func min(x, y float64) float64 {
	if x < y {
		return x
	}
	return y
}

func max(x, y float64) float64 {
	if x > y {
		return x
	}
	return y
}

func minMax(x, y float64) (min, max float64) {
	if x > y {
		return y, x
	}
	return x, y
}

func minUint32(a, b uint32) uint32 {
	if a < b {
		return a
	}
	return b
}
