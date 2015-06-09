package stats

//
// regression_test.go
//
// Author:   Gary Boone
//
// Test:
//   go test stats.go stats_test.go regression.go regression_test.go
//
// Copyright (c) 2011-2013 Gary Boone <gary.boone@gmail.com>.
//
// To test, all code was compared against the R stats package (http://r-project.org)
//
// R test code example:
// x <- c(2000 ,   2001  ,  2002  ,  2003 ,   2004)
// y <- c(9.34 ,   8.50  ,  7.62  ,  6.93  ,  6.60)
// fit <- lm( y ~ x )
// summary(fit)
//
// The summary result contains the information used for the tests below.
//

import (
	"testing"
)

const REG_TOL = 1e-11

//
//
// Test incremental functions
//
//

func TestRegressionUpdate0(t *testing.T) {
	var r Regression
	checkInt(r.Count(), 0, "Count", t)
	checkNaN(r.Slope(), "Slope", t)
	checkNaN(r.Intercept(), "Intercept", t)
	checkNaN(r.RSquared(), "RSquared", t)
	checkNaN(r.SlopeStandardError(), "SlopeStandardError", t)
	checkNaN(r.InterceptStandardError(), "InterceptStandardError", t)
}

func TestRegressionUpdate1(t *testing.T) {
	var r Regression
	r.Update(2000, 9.34)
	checkInt(r.Count(), 1, "Count", t)
	checkNaN(r.Slope(), "Slope", t)
	checkNaN(r.Intercept(), "Intercept", t)
	checkNaN(r.RSquared(), "RSquared", t)
	checkNaN(r.SlopeStandardError(), "SlopeStandardError", t)
	checkNaN(r.InterceptStandardError(), "InterceptStandardError", t)
}

func TestRegressionUpdate2(t *testing.T) {
	var r Regression
	r.Update(2000, 9.34)
	r.Update(2001, 8.50)
	checkInt(r.Count(), 2, "Count", t)
	checkFloat64(r.Slope(), -0.840000000000126, REG_TOL, "Slope", t)
	checkFloat64(r.Intercept(), 1689.340000000251393, REG_TOL, "Intercept", t)
	checkFloat64(r.RSquared(), 1.0, REG_TOL, "RSquared", t)
	checkNaN(r.SlopeStandardError(), "SlopeStandardError", t)
	checkNaN(r.InterceptStandardError(), "InterceptStandardError", t)
}

func TestRegressionUpdate3(t *testing.T) {
	var r Regression
	r.Update(2000, 9.34)
	r.Update(2001, 8.50)
	r.Update(2002, 7.62)
	checkInt(r.Count(), 3, "Count", t)
	checkFloat64(r.Slope(), -0.8600000000004419, REG_TOL, "Slope", t)
	checkFloat64(r.Intercept(), 1729.3466666675515171, REG_TOL, "Intercept", t)
	checkFloat64(r.RSquared(), 0.999819754866627, REG_TOL, "RSquared", t)
	checkFloat64(r.SlopeStandardError(), 0.0115470053835452, 1e-8, "SlopeStandardError", t)
	checkFloat64(r.InterceptStandardError(), 23.1055596960129250, 1e-6, "InterceptStandardError", t)
}

func TestRegressionUpdate5(t *testing.T) {
	var r Regression
	r.Update(2000, 9.34)
	r.Update(2001, 8.50)
	r.Update(2002, 7.62)
	r.Update(2003, 6.93)
	r.Update(2004, 6.60)
	checkInt(r.Count(), 5, "Count", t)
	checkFloat64(r.Slope(), -0.705000000000075, REG_TOL, "Slope", t)
	checkFloat64(r.Intercept(), 1419.208000000151287, REG_TOL, "Intercept", t)
	checkFloat64(r.RSquared(), 0.976304686026756, REG_TOL, "RSquared", t)
	checkFloat64(r.SlopeStandardError(), 0.0634113554499872, 1e-10, "SlopeStandardError", t)
	checkFloat64(r.InterceptStandardError(), 126.9495652848741400, 1e-6, "InterceptStandardError", t)
}

func TestRegressionUpdateArray5(t *testing.T) {
	var r Regression
	xData := []float64{2000, 2001, 2002, 2003, 2004}
	yData := []float64{9.34, 8.50, 7.62, 6.93, 6.60}
	r.UpdateArray(xData, yData)
	checkInt(r.Count(), 5, "Count", t)
	checkFloat64(r.Slope(), -0.705000000000075, REG_TOL, "Slope", t)
	checkFloat64(r.Intercept(), 1419.208000000151287, REG_TOL, "Intercept", t)
	checkFloat64(r.RSquared(), 0.976304686026756, REG_TOL, "RSquared", t)
	checkFloat64(r.SlopeStandardError(), 0.0634113554499872, 1e-10, "SlopeStandardError", t)
	checkFloat64(r.InterceptStandardError(), 126.9495652848741400, 1e-6, "InterceptStandardError", t)
}

//
//
// Test batch functions
//
//

func TestLinearRegression0(t *testing.T) {
	xData := []float64{}
	yData := []float64{}
	var slope, intercept, rsquared, count, slopeStdErr, intcptStdErr = LinearRegression(xData, yData)
	checkNaN(slope, "Slope", t)
	checkNaN(intercept, "Intercept", t)
	checkNaN(rsquared, "RSquared", t)
	checkInt(count, 0, "Count", t)
	checkNaN(slopeStdErr, "SlopeStandardError", t)
	checkNaN(intcptStdErr, "InterceptStandardError", t)
}

func TestLinearRegression1(t *testing.T) {
	xData := []float64{2000}
	yData := []float64{9.34}
	var slope, intercept, rsquared, count, slopeStdErr, intcptStdErr = LinearRegression(xData, yData)
	checkNaN(slope, "Slope", t)
	checkNaN(intercept, "Intercept", t)
	checkNaN(rsquared, "RSquared", t)
	checkInt(count, 1, "Count", t)
	checkNaN(slopeStdErr, "SlopeStandardError", t)
	checkNaN(intcptStdErr, "InterceptStandardError", t)
}

func TestLinearRegression2(t *testing.T) {
	xData := []float64{2000, 2001}
	yData := []float64{9.34, 8.50}
	var slope, intercept, rsquared, count, slopeStdErr, intcptStdErr = LinearRegression(xData, yData)
	checkFloat64(slope, -0.840000000000126, REG_TOL, "Slope", t)
	checkFloat64(intercept, 1689.340000000251393, REG_TOL, "Intercept", t)
	checkFloat64(rsquared, 1.0, REG_TOL, "RSquared", t)
	checkInt(count, 2, "Count", t)
	checkNaN(slopeStdErr, "SlopeStandardError", t)
	checkNaN(intcptStdErr, "InterceptStandardError", t)
}

func TestLinearRegression3(t *testing.T) {
	xData := []float64{2000, 2001, 2002}
	yData := []float64{9.34, 8.50, 7.62}
	var slope, intercept, rsquared, count, slopeStdErr, intcptStdErr = LinearRegression(xData, yData)
	checkFloat64(slope, -0.8600000000004419, REG_TOL, "Slope", t)
	checkFloat64(intercept, 1729.3466666675515171, REG_TOL, "Intercept", t)
	checkFloat64(rsquared, 0.999819754866627, REG_TOL, "RSquared", t)
	checkInt(count, 3, "Count", t)
	checkFloat64(slopeStdErr, 0.0115470053835452, 1e-8, "SlopeStandardError", t)
	checkFloat64(intcptStdErr, 23.1055596960129250, 1e-6, "InterceptStandardError", t)
}

func TestLinearRegression5(t *testing.T) {
	xData := []float64{2000, 2001, 2002, 2003, 2004}
	yData := []float64{9.34, 8.50, 7.62, 6.93, 6.60}
	var slope, intercept, rsquared, count, slopeStdErr, intcptStdErr = LinearRegression(xData, yData)
	checkFloat64(slope, -0.705000000000075, REG_TOL, "Slope", t)
	checkFloat64(intercept, 1419.208000000151287, REG_TOL, "Intercept", t)
	checkFloat64(rsquared, 0.976304686026756, REG_TOL, "RSquared", t)
	checkInt(count, 5, "Count", t)
	checkFloat64(slopeStdErr, 0.0634113554499872, 1e-10, "SlopeStandardError", t)
	checkFloat64(intcptStdErr, 126.9495652848741400, 1e-6, "InterceptStandardError", t)
}

//
//
// Degenerate examples tests
//
//

func TestLinearRegression01(t *testing.T) {
	xData := []float64{0.0}
	yData := []float64{0.0}
	var slope, intercept, rsquared, count, slopeStdErr, intcptStdErr = LinearRegression(xData, yData)
	checkNaN(slope, "Slope", t)
	checkNaN(intercept, "Intercept", t)
	checkNaN(rsquared, "RSquared", t)
	checkInt(count, 1, "Count", t)
	checkNaN(slopeStdErr, "SlopeStandardError", t)
	checkNaN(intcptStdErr, "InterceptStandardError", t)
}

func TestLinearRegression2Same(t *testing.T) {
	xData := []float64{2.0, 2.0}
	yData := []float64{0.3, 0.3}
	var slope, intercept, rsquared, count, slopeStdErr, intcptStdErr = LinearRegression(xData, yData)
	checkNaN(slope, "Slope", t)
	checkNaN(intercept, "Intercept", t)
	checkNaN(rsquared, "RSquared", t)
	checkInt(count, 2, "Count", t)
	checkNaN(slopeStdErr, "SlopeStandardError", t)
	checkNaN(intcptStdErr, "InterceptStandardError", t)
}

func TestLinearRegression2SameX(t *testing.T) {
	xData := []float64{2.0, 2.0}
	yData := []float64{0.5, 0.3}
	var slope, intercept, rsquared, count, slopeStdErr, intcptStdErr = LinearRegression(xData, yData)
	checkNaN(slope, "Slope", t)
	checkNaN(intercept, "Intercept", t)
	checkNaN(rsquared, "RSquared", t)
	checkInt(count, 2, "Count", t)
	checkNaN(slopeStdErr, "SlopeStandardError", t)
	checkNaN(intcptStdErr, "InterceptStandardError", t)
}

func TestLinearRegression2SameY(t *testing.T) {
	xData := []float64{2.2, 0.7}
	yData := []float64{0.3, 0.3}
	var slope, intercept, rsquared, count, slopeStdErr, intcptStdErr = LinearRegression(xData, yData)
	checkFloat64Abs(slope, 0.0, REG_TOL, "Slope", t)
	checkFloat64(intercept, 0.3, REG_TOL, "Intercept", t)
	checkInf(rsquared, "RSquared", t)
	checkInt(count, 2, "Count", t)
	checkNaN(slopeStdErr, "SlopeStandardError", t)
	checkNaN(intcptStdErr, "InterceptStandardError", t)
}

func TestLinearRegression3WithSame(t *testing.T) {
	xData := []float64{20, 21, 20}
	yData := []float64{9.3, 8.5, 9.3}
	var slope, intercept, rsquared, count, slopeStdErr, intcptStdErr = LinearRegression(xData, yData)
	checkFloat64(slope, -0.8, REG_TOL, "Slope", t)
	checkFloat64(intercept, 25.3, REG_TOL, "Intercept", t)
	checkFloat64(rsquared, 1.0, REG_TOL, "RSquared", t)
	checkInt(count, 3, "Count", t)
	checkFloat64(slopeStdErr, 5.03103783538893e-15, 1e-8, "SlopeStandardError", t)
	checkFloat64(intcptStdErr, 1.02325257636427e-13, 1e-6, "InterceptStandardError", t)
}

func TestLinearRegression3WithSameX(t *testing.T) {
	xData := []float64{2000, 2001, 2000}
	yData := []float64{9.34, 8.50, 7.62}
	var slope, intercept, rsquared, count, slopeStdErr, intcptStdErr = LinearRegression(xData, yData)
	checkFloat64(slope, 0.0200000000016344, 1e-9, "Slope", t)
	checkFloat64(intercept, -31.5200000032693488, 1e-9, "Intercept", t)
	checkFloat64(rsquared, 0.000180245133410639, 1e-9, "RSquared", t)
	checkInt(count, 3, "Count", t)
	checkFloat64(slopeStdErr, 1.4895636945101514, 1e-9, "SlopeStandardError", t)
	checkFloat64(intcptStdErr, 2979.6239929915545872, 1e-6, "InterceptStandardError", t)
}

func TestLinearRegression3WithSameY(t *testing.T) {
	xData := []float64{2000, 2001, 2002}
	yData := []float64{9.34, 8.50, 9.34}
	var slope, intercept, rsquared, count, slopeStdErr, intcptStdErr = LinearRegression(xData, yData)
	checkFloat64(slope, 0.0, REG_TOL, "Slope", t)
	checkFloat64Abs(intercept, 9.05999999971740, 1e-9, "Intercept", t)
	checkFloat64Abs(rsquared, 8.69423995966795e-26, REG_TOL, "RSquared", t)
	checkInt(count, 3, "Count", t)
	checkFloat64(slopeStdErr, 4.84974226119533e-01, 1e-9, "SlopeStandardError", t)
	checkFloat64(intcptStdErr, 9.70433507253826e+02, 1e-6, "InterceptStandardError", t)
}
