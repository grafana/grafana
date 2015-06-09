package stats

//
// regression.go
//
// Author:   Gary Boone
//
// Copyright (c) 2011-2013 Gary Boone <gary.boone@gmail.com>.
//
// Changes:
//           20110618:    initial version
//
// Source:
// https://github.com/GaryBoone/GoStats
//
// Descriptions of the statistics and their calculation can be found here:
//
// http://mathworld.wolfram.com/LeastSquaresFitting.html
// http://mathworld.wolfram.com/CorrelationCoefficient.html
//

import (
	"math"
)

// structure to contain the accumulating regression components
type Regression struct {
	n, sx, sy, sxx, sxy, syy float64
}

//
//
// Accessor Functions
//
//

func (r *Regression) Count() int {
	return int(r.n)
}

func (r *Regression) Size() int {
	return int(r.n)
}

//
//
// Incremental Functions
//
//

// Update the stats with a new point.
func (r *Regression) Update(x, y float64) {
	r.n++
	r.sx += x
	r.sy += y
	r.sxx += x * x
	r.sxy += x * y
	r.syy += y * y
}

// Update the stats with arrays of x and y values.
func (r *Regression) UpdateArray(xData, yData []float64) {
	if len(xData) != len(yData) {
		panic("array lengths differ in UpdateArray()")
	}
	for i := 0; i < len(xData); i++ {
		r.Update(xData[i], yData[i])
	}
}

func (r *Regression) Slope() float64 {
	ss_xy := r.n*r.sxy - r.sx*r.sy
	ss_xx := r.n*r.sxx - r.sx*r.sx
	return ss_xy / ss_xx
}

func (r *Regression) Intercept() float64 {
	return (r.sy - r.Slope()*r.sx) / r.n
}

func (r *Regression) RSquared() float64 {
	ss_xy := r.n*r.sxy - r.sx*r.sy
	ss_xx := r.n*r.sxx - r.sx*r.sx
	ss_yy := r.n*r.syy - r.sy*r.sy
	return ss_xy * ss_xy / ss_xx / ss_yy
}

func (r *Regression) SlopeStandardError() float64 {
	if r.n <= 2 {
		return math.NaN()
	}
	ss_xy := r.n*r.sxy - r.sx*r.sy
	ss_xx := r.n*r.sxx - r.sx*r.sx
	ss_yy := r.n*r.syy - r.sy*r.sy
	s := math.Sqrt((ss_yy - ss_xy*ss_xy/ss_xx) / (r.n - 2.0))
	return s / math.Sqrt(ss_xx)
}

func (r *Regression) InterceptStandardError() float64 {
	if r.n <= 2 {
		return math.NaN()
	}
	ss_xy := r.n*r.sxy - r.sx*r.sy
	ss_xx := r.n*r.sxx - r.sx*r.sx
	ss_yy := r.n*r.syy - r.sy*r.sy
	s := math.Sqrt((ss_yy - ss_xy*ss_xy/ss_xx) / (r.n - 2.0))
	mean_x := r.sx / r.n
	return s * math.Sqrt(1.0/r.n+mean_x*mean_x/ss_xx)
}

//
//
// Batch Functions
//
//

func LinearRegression(xData, yData []float64) (slope, intercept, rsquared float64,
	count int, slopeStdErr, interceptStdErr float64) {
	var r Regression
	r.UpdateArray(xData, yData)
	ss_xy := r.n*r.sxy - r.sx*r.sy
	ss_xx := r.n*r.sxx - r.sx*r.sx
	ss_yy := r.n*r.syy - r.sy*r.sy
	slope = ss_xy / ss_xx
	intercept = (r.sy - r.Slope()*r.sx) / r.n
	rsquared = ss_xy * ss_xy / ss_xx / ss_yy
	if r.n <= 2 {
		slopeStdErr = math.NaN()
		interceptStdErr = math.NaN()
	} else {
		s := math.Sqrt((ss_yy - ss_xy*ss_xy/ss_xx) / (r.n - 2.0))
		slopeStdErr = s / math.Sqrt(ss_xx)
		mean_x := r.sx / r.n
		interceptStdErr = s * math.Sqrt(1.0/r.n+mean_x*mean_x/ss_xx)
	}
	count = int(r.n)
	return
}
